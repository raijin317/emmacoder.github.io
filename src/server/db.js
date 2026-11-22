/**
 * SQLite in the browser (sql.js / WebAssembly) with the same tables as the desktop app,
 * saved to IndexedDB after every change. `db()` mimics node:sqlite's DatabaseSync
 * (prepare(sql).all/get/run, exec), so the repository code is the same as before.
 */
import { kvGet, kvSet } from "./vfs.js";
import { STARS_PER_STICKER, STICKERS } from "@/lib/stickers.js";
import { refreshGames } from "./gameRefresh.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_hash TEXT,
  title TEXT NOT NULL,
  series TEXT,
  book_type TEXT,
  grade INTEGER,
  page_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  status_detail TEXT,
  meta TEXT,
  assessment TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  ord INTEGER NOT NULL,
  title TEXT NOT NULL,
  topic TEXT,
  page_start INTEGER,
  page_end INTEGER,
  extract TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs-review'
);
CREATE INDEX IF NOT EXISTS units_book ON units(book_id, ord);

CREATE TABLE IF NOT EXISTS inspiration_topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  pictures TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  book_id TEXT,
  unit_id TEXT,
  inspiration_topic_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  stage TEXT NOT NULL,
  data TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS items_unit ON content_items(unit_id);
CREATE INDEX IF NOT EXISTS items_topic ON content_items(inspiration_topic_id);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  age INTEGER NOT NULL,
  active_book_id TEXT,
  book_ids TEXT,
  topic_ids TEXT,
  daily_goal_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  content_item_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  missed TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_child ON attempts(child_id, created_at);

CREATE TABLE IF NOT EXISTS stickers (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  code TEXT NOT NULL,
  earned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  claude_session_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  pack_json TEXT,
  files TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_thread ON chat_messages(thread_id, created_at);
`;

const DB_KEY = "app.db";
let SQL = null;
let raw = null;
let adapter = null;
let saveTimer = null;
let version = 0;
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("emma-db") : null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

async function loadSqlJs() {
  if (SQL) return SQL;
  const base = new URL("vendor/", document.baseURI).href;
  if (!window.initSqlJs) await loadScript(base + "sql-wasm.js");
  SQL = await window.initSqlJs({ locateFile: (f) => base + f });
  return SQL;
}

const toParam = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
const params = (args) => (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0]) && !(args[0] instanceof Uint8Array) ? args[0] : args.map(toParam));

/** A statement in the style of node:sqlite (each call prepares, runs and frees — nothing is kept open). */
class Statement {
  constructor(sql) {
    this.sql = sql;
  }
  all(...args) {
    const st = raw.prepare(this.sql);
    try {
      st.bind(params(args));
      const rows = [];
      while (st.step()) rows.push(st.getAsObject());
      return rows;
    } finally {
      st.free();
    }
  }
  get(...args) {
    const st = raw.prepare(this.sql);
    try {
      st.bind(params(args));
      return st.step() ? st.getAsObject() : undefined;
    } finally {
      st.free();
    }
  }
  run(...args) {
    raw.run(this.sql, params(args));
    changed();
    return { changes: raw.getRowsModified() };
  }
}

function makeAdapter() {
  return {
    prepare: (sql) => new Statement(sql),
    exec: (sql) => {
      raw.exec(sql);
      if (!/^\s*(SELECT|PRAGMA table_info)/i.test(sql)) changed();
    },
  };
}

/** Saves the database a moment after the last change (all changes are synchronous, so a transaction is never cut). */
function changed() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveNow(), 250);
}

/** Saves now if there are unsaved changes (the API calls it before answering a change, so a reload never loses it). */
export async function flushSave() {
  if (saveTimer) await saveNow();
}

export async function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!raw) return;
  const bytes = raw.export();
  version = Date.now();
  await kvSet(DB_KEY, bytes);
  await kvSet(DB_KEY + ".version", version);
  channel?.postMessage({ type: "saved", version });
}

function create(bytes) {
  raw = bytes ? new SQL.Database(bytes) : new SQL.Database();
  adapter = makeAdapter();
  adapter.exec(SCHEMA);
  migrate(adapter);
}

/** Opens the family's database (or a new one) — call once before anything else. */
export async function openDb() {
  if (adapter) return adapter;
  await loadSqlJs();
  const bytes = await kvGet(DB_KEY);
  version = (await kvGet(DB_KEY + ".version")) ?? 0;
  try {
    create(bytes ? new Uint8Array(bytes) : null);
  } catch (e) {
    console.error("[db] could not open the saved database — starting a new one", e);
    create(null);
  }
  // Another tab of the app saved: use its data (changes are small and rare).
  channel?.addEventListener("message", async (e) => {
    if (e.data?.type !== "saved" || e.data.version <= version || saveTimer) return;
    const b = await kvGet(DB_KEY);
    if (b) {
      version = e.data.version;
      raw.close();
      raw = new SQL.Database(new Uint8Array(b));
      window.dispatchEvent(new Event("emma-data-changed"));
    }
  });
  window.addEventListener("pagehide", () => saveTimer && void saveNow());
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && saveTimer && void saveNow());
  return adapter;
}

export function db() {
  if (!adapter) throw new Error("The database is not open yet.");
  return adapter;
}

/** Small additive migrations (backups from older versions) + the album/games updates of the desktop app. */
function migrate(d) {
  const cols = (table) => d.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  const childCols = cols("children");
  if (childCols.length && !childCols.includes("book_ids")) {
    d.exec("ALTER TABLE children ADD COLUMN book_ids TEXT");
    d.exec("UPDATE children SET book_ids = json_array(active_book_id) WHERE active_book_id IS NOT NULL");
  }
  const msgCols = cols("chat_messages");
  if (msgCols.length && !msgCols.includes("files")) d.exec("ALTER TABLE chat_messages ADD COLUMN files TEXT");
  if (childCols.length && !cols("children").includes("topic_ids")) {
    d.exec("ALTER TABLE children ADD COLUMN topic_ids TEXT");
    if (cols("inspiration_topics").length) d.exec("UPDATE children SET topic_ids = (SELECT json_group_array(id) FROM inspiration_topics WHERE status = 'approved')");
  }
  const topicCols = cols("inspiration_topics");
  if (topicCols.length && !topicCols.includes("pictures")) d.exec("ALTER TABLE inspiration_topics ADD COLUMN pictures TEXT");
  syncStickers(d);
  refreshGames(d);
}

/**
 * The sticker album (src/lib/stickers.js): a child owns the first N album stickers, one row each, in order.
 * Rewrites rows from an older sticker list (or an old backup) to the album's ids, and adds the stickers the
 * child's stars already pay for. Safe to run any number of times.
 */
export function syncStickers(d) {
  if (!d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stickers'").get()) return;
  const rows = d.prepare("SELECT rowid AS r, child_id AS c, code FROM stickers ORDER BY child_id, earned_at, rowid").all();
  const have = new Map();
  for (const row of rows) {
    const k = have.get(row.c) ?? 0;
    have.set(row.c, k + 1);
    if (k >= STICKERS.length) d.prepare("DELETE FROM stickers WHERE rowid = ?").run(row.r);
    else if (row.code !== STICKERS[k]) d.prepare("UPDATE stickers SET code = ? WHERE rowid = ?").run(STICKERS[k], row.r);
  }
  if (!d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='attempts'").get()) return;
  const stars = d.prepare("SELECT child_id AS c, SUM(stars) AS s FROM attempts GROUP BY child_id").all();
  const at = new Date().toISOString();
  for (const { c, s } of stars) {
    const want = Math.min(STICKERS.length, Math.floor(Number(s) / STARS_PER_STICKER));
    for (let k = Math.min(have.get(c) ?? 0, STICKERS.length); k < want; k++)
      d.prepare("INSERT INTO stickers(id, child_id, code, earned_at) VALUES(?,?,?,?)").run(`st_${c}_${k}_${Date.now().toString(36)}`, c, STICKERS[k], at);
  }
}

/** Runs the album/games updates again (after a backup was restored). */
export function migrateAgain() {
  migrate(db());
}

export function tx(fn) {
  const d = db();
  d.exec("BEGIN");
  try {
    const r = fn();
    d.exec("COMMIT");
    return r;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export const now = () => new Date().toISOString();

function randomHex(n) {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, "").slice(0, n);
  const b = new Uint8Array(Math.ceil(n / 2));
  globalThis.crypto?.getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.floor(Math.random() * 256)));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, n);
}
export const newId = (prefix = "") => prefix + randomHex(12);
