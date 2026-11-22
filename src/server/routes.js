/**
 * The app's API, answered inside the browser (the desktop app had these as Next.js route handlers).
 * installApi() makes fetch("/api/…") reach these handlers, so the screens work unchanged.
 */
import { z } from "zod";
import { route, ok, fail, body, sse, blobResponse } from "./api.js";
import {
  checkPin, childStats, createItem, createTopic, deleteBook, deleteChild, deleteItem, deleteTopic, deleteUnit, exportAll, getAppSettings, getBook, getChild,
  getItem, getLessonRules, getSetting, getTopic, getUnit, importAll, listBooks, listChildren, listItems, listTopics, listUnits, recordAttempt, saveChild,
  setActiveBook, setLessonRules, setPin, setSetting, topicChildren, updateItem, updateTopic, updateUnit, upsertBook, upsertUnit,
} from "./repo.js";
import { migrateAgain, newId, saveNow, tx } from "./db.js";
import { reassessBook, quickPackForUnit } from "./content.js";
import { picturesForItem, unitCovers } from "./pictures.js";
import { generateBookResources, generateUnitResources } from "./books/resources.js";
import { bookIdFor, cropBlob, fileHash, gradeHintFromName, hasPages, pageBlob, removePages, renderPdfPages } from "./books/pages.js";
import { buildTopicItems, topicGames } from "./topics.js";
import { topUpGames } from "./gameRefresh.js";
import { childFit, PROFILES, assessBook } from "@/lib/assessment.js";
import { CHILD_TYPES } from "@/lib/contentMeta.js";
import { DEFAULT_RULES, LessonRules, RULE, ruleOn } from "@/lib/rules.js";
import { ContentType, InspirationPack, Stage, validateItemData } from "@/lib/schemas/content.js";
import { UnitExtract } from "@/lib/schemas/book.js";
import { isNaturalVoice } from "@/lib/voices.js";
import { prepareVoices, warmState, warmVoices } from "@/lib/client/tts.js";

const R = [];
const on = (method, pattern, handler) => R.push({ method, keys: [...pattern.matchAll(/:(\w+)/g)].map((m) => m[1]), re: new RegExp("^" + pattern.replace(/:(\w+)/g, "([^/]+)") + "$"), handler: route(handler) });

/* ------------------------------- attempts ------------------------------- */

on("POST", "/api/attempts", async (req) => {
  const b = await body(req);
  if (!b.childId || !getChild(b.childId)) return fail("Child not found", 404);
  if (!b.itemId || !getItem(b.itemId)) return fail("Item not found", 404);
  const max = Math.max(0, Number(b.maxScore) || 0);
  const score = Math.min(max, Math.max(0, Number(b.score) || 0));
  return ok(
    recordAttempt({
      childId: b.childId,
      itemId: b.itemId,
      score,
      maxScore: max,
      durationSec: Math.min(3600, Number(b.durationSec) || 0),
      missed: Array.isArray(b.missed) ? b.missed.filter((m) => typeof m === "string").map((m) => m.slice(0, 60)) : [],
    }),
  );
});

/* -------------------------------- backup -------------------------------- */

on("GET", "/api/backup", async () => {
  const dump = exportAll();
  return new Response(JSON.stringify(dump, null, 1), { headers: { "Content-Type": "application/json" } });
});

on("POST", "/api/backup", async (req) => {
  const b = await body(req);
  // "sunny-english-studio" = backups made before the app was renamed.
  if (!["emma-english-studio", "sunny-english-studio"].includes(b.app ?? "") || !b.tables) return fail("This is not an Emma English Studio backup file.");
  importAll({ tables: b.tables });
  migrateAgain();
  await saveNow();
  return ok({ ok: true });
});

/* --------------------------------- books -------------------------------- */

on("GET", "/api/books", async () => ok({ books: listBooks().map((b) => ({ ...b, hasPages: hasPages(b.id) })) }));

/** A new book without a PDF (the parent types the units in). */
on("POST", "/api/books", async (req) => {
  const b = await body(req);
  const title = String(b.title ?? "").trim().slice(0, 120);
  if (!title) return fail("Please enter the book's title.");
  const grade = b.grade === null || b.grade === undefined || b.grade === "" ? null : Math.min(5, Math.max(0, Number(b.grade) || 0));
  const id = `${title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "book"}-${newId().slice(0, 8)}`;
  upsertBook({ id, fileName: "(no PDF)", title, series: null, bookType: "student-book", grade, pageCount: 0, status: "needs-review", isDemo: false, importedAt: new Date().toISOString() });
  return ok({ book: getBook(id) });
});

/**
 * Adds a textbook PDF: its pages are drawn in this browser and kept on this device (never uploaded).
 * Form fields: file, optional bookId (attach the PDF to a book that is already there, e.g. after a restore).
 */
on("POST", "/api/books/upload", async (req) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Please choose a PDF file.");
  if (!/\.pdf$/i.test(file.name)) return fail("Only PDF files can be added.");
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== "%PDF-") return fail("This file is not a real PDF.");
  const target = typeof form.get("bookId") === "string" ? String(form.get("bookId")) : null;
  return sse(async (send, signal) => {
    send("status", { msg: `Reading ${file.name}…`, progress: 0 });
    const hash = await fileHash(file);
    const known = target ? getBook(target) : listBooks().find((x) => x.fileHash === hash) ?? null;
    const bookId = known?.id ?? bookIdFor(file.name, hash);
    if (!known) {
      const title = file.name.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").trim() || "My book";
      upsertBook({ id: bookId, fileName: file.name, fileHash: hash, title, series: null, bookType: "student-book", grade: gradeHintFromName(file.name), pageCount: 0, status: "rendering", isDemo: false, importedAt: new Date().toISOString() });
    } else upsertBook({ ...known, fileName: file.name, fileHash: hash, status: "rendering" });
    send("book", { bookId, duplicate: !!known && !target });
    try {
      const total = await renderPdfPages(file, bookId, {
        signal,
        onPage: (n, t) => {
          if (n === 1 || n % 2 === 0 || n === t) send("status", { msg: `Preparing page ${n} of ${t}…`, progress: Math.round((n / t) * 100) });
        },
      });
      const cur = getBook(bookId);
      const units = listUnits(bookId);
      upsertBook({ ...cur, pageCount: total, status: units.some((u) => listItems({ unitId: u.id, status: "approved" }).length) ? "ready" : "needs-review", statusDetail: null });
      send("done", { bookId, pages: total, msg: `✅ ${total} pages are ready. Now add the book's units.` });
    } catch (e) {
      upsertBook({ ...getBook(bookId), status: "error", statusDetail: e.message });
      throw e;
    }
  }, req);
});

/** (Re)makes the learning resources of a book's units (offline builder), streamed as SSE. */
on("POST", "/api/books/import", async (req) => {
  const b = await body(req);
  const book = b.target ? getBook(b.target) : null;
  if (!book) return fail("Book not found", 404);
  return sse(async (send) => {
    const r = await generateBookResources(book.id, { force: !!b.force, log: (msg, progress) => send("status", { msg, progress }) });
    send("done", { msg: `✅ ${r.made} unit(s) got their lessons.`, progress: 100 });
    warmVoices();
  }, req);
});

on("GET", "/api/books/:bookId", async (_req, { bookId }) => {
  const book = getBook(bookId);
  if (!book) return fail("Book not found", 404);
  return ok({ book: { ...book, hasPages: hasPages(bookId) }, units: listUnits(bookId) });
});

on("PATCH", "/api/books/:bookId", async (req, { bookId }) => {
  const book = getBook(bookId);
  if (!book) return fail("Book not found", 404);
  const b = await body(req);
  upsertBook({ ...book, title: b.title?.trim() || book.title, grade: b.grade === undefined ? book.grade : b.grade, status: b.status ?? book.status });
  return ok({ book: reassessBook(bookId) });
});

on("DELETE", "/api/books/:bookId", async (_req, { bookId }) => {
  deleteBook(bookId);
  await removePages(bookId);
  return ok({ ok: true });
});

/** A new unit typed in by the parent (title + the pages it covers). */
on("POST", "/api/books/:bookId/units", async (req, { bookId }) => {
  const book = getBook(bookId);
  if (!book) return fail("Book not found", 404);
  const b = await body(req);
  const title = String(b.title ?? "").trim().slice(0, 120);
  if (!title) return fail("Please enter the unit's title.");
  const units = listUnits(bookId);
  const order = Math.max(0, ...units.map((u) => u.order)) + 1;
  const start = Math.max(1, Number(b.startPage) || 1);
  const end = Math.max(start, Number(b.endPage) || start);
  const id = `${bookId}-u${String(order).padStart(2, "0")}${units.some((u) => u.id === `${bookId}-u${String(order).padStart(2, "0")}`) ? "-" + newId().slice(0, 4) : ""}`;
  const parsed = UnitExtract.safeParse({ id, bookId, order, pages: [start, end], title, topic: String(b.topic ?? "").trim() || title, confidence: 1 });
  if (!parsed.success) return fail("Please check the unit details.", 400, z.prettifyError(parsed.error));
  upsertUnit(parsed.data, "needs-review");
  return ok({ unit: getUnit(id) });
});

on("GET", "/api/books/:bookId/pages/:page", async (req, { bookId, page }) => {
  const n = Number(page);
  if (!Number.isInteger(n) || n < 1) return fail("Bad page", 400);
  const thumb = new URL(req.url, location.href).searchParams.get("thumb") === "1";
  const blob = await pageBlob(bookId, n, thumb);
  return blob ? blobResponse(blob) : fail("Page not rendered", 404);
});

on("GET", "/api/books/:bookId/crop", async (req, { bookId }) => {
  const q = new URL(req.url, location.href).searchParams;
  const page = Number(q.get("p"));
  const box = (q.get("b") ?? "").split(",").map(Number);
  const size = Math.min(800, Math.max(64, Number(q.get("s")) || 400));
  if (!Number.isInteger(page) || page < 1) return fail("Bad page", 400);
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n) || n < 0 || n > 1) || box[2] <= 0 || box[3] <= 0) return fail("Bad box", 400);
  const blob = await cropBlob(bookId, page, box, size);
  return blob ? blobResponse(blob) : fail("Page not rendered", 404);
});

/* ------------------------------- children ------------------------------- */

on("GET", "/api/children", async () => ok({ children: listChildren().map((c) => ({ ...c, stats: childStats(c.id) })) }));

on("POST", "/api/children", async (req) => {
  const b = await body(req);
  const name = b.name?.trim();
  const age = Number(b.age);
  if (!name) return fail("Please enter a name.");
  if (!Number.isInteger(age) || age < 2 || age > 14) return fail("Age should be between 2 and 14.");
  const bookIds = (Array.isArray(b.bookIds) ? b.bookIds : b.activeBookId ? [b.activeBookId] : []).filter((id) => typeof id === "string" && getBook(id));
  // Inspiration topics are given to a child here — Children → Edit.
  const topicIds = Array.isArray(b.topicIds) ? b.topicIds.filter((id) => typeof id === "string" && getTopic(id)) : undefined;
  const child = saveChild({
    id: b.id,
    name: name.slice(0, 30),
    avatar: b.avatar || "🐻",
    age,
    bookIds,
    topicIds,
    activeBookId: b.activeBookId ?? null,
    dailyGoalMinutes: Math.min(60, Math.max(5, Number(b.dailyGoalMinutes) || 15)),
  });
  return ok({ child });
});

on("GET", "/api/children/:childId", async (_req, { childId }) => {
  const child = getChild(childId);
  if (!child) return fail("Child not found", 404);
  const books = child.bookIds.map(getBook).filter((b) => b !== null);
  const book = books.find((b) => b.id === child.activeBookId) ?? null;
  return ok({
    child,
    stats: childStats(childId),
    book,
    fit: book?.assessment ? childFit(child.age, book.assessment) : null,
    books: books.map((b) => ({ id: b.id, title: b.title, fit: b.assessment ? childFit(child.age, b.assessment) : null })),
  });
});

on("PATCH", "/api/children/:childId", async (req, { childId }) => {
  const b = await body(req);
  if (b.activeBookId) setActiveBook(childId, b.activeBookId);
  return ok({ child: getChild(childId) });
});

on("DELETE", "/api/children/:childId", async (_req, { childId }) => {
  deleteChild(childId);
  return ok({ ok: true });
});

/* --------------------------------- items -------------------------------- */

on("GET", "/api/items", async (req) => {
  const p = new URL(req.url, location.href).searchParams;
  return ok({ items: listItems({ unitId: p.get("unitId") ?? undefined, topicId: p.get("topicId") ?? undefined, bookId: p.get("bookId") ?? undefined, status: p.get("status") ?? undefined, type: p.get("type") ?? undefined }) });
});

on("GET", "/api/items/:itemId", async (_req, { itemId }) => {
  const item = getItem(itemId);
  if (!item) return fail("Item not found", 404);
  const parent = item.unitId ? { kind: "unit", id: item.unitId, title: getUnit(item.unitId)?.title ?? "" } : item.inspirationTopicId ? { kind: "topic", id: item.inspirationTopicId, title: getTopic(item.inspirationTopicId)?.title ?? "" } : null;
  return ok({ item, parent, pictures: picturesForItem(item) });
});

on("PATCH", "/api/items/:itemId", async (req, { itemId }) => {
  const item = getItem(itemId);
  if (!item) return fail("Item not found", 404);
  const b = await body(req);
  if (b.data !== undefined) {
    const r = validateItemData(item.type, b.data);
    if (!r.success) return fail("The content has problems.", 400, z.prettifyError(r.error));
    b.data = r.data;
  }
  const updated = updateItem(itemId, b);
  if (updated?.status === "approved") warmVoices(); // new or changed sentences get their voice in the background
  return ok({ item: updated });
});

on("DELETE", "/api/items/:itemId", async (_req, { itemId }) => {
  deleteItem(itemId);
  return ok({ ok: true });
});

/* ------------------------------ child world ----------------------------- */

/** Everything the child's "My World" needs: the child's books with their ready resources (approved items only). */
on("GET", "/api/learn/:childId", async (_req, { childId }) => {
  const child = getChild(childId);
  if (!child) return fail("Child not found", 404);
  const playable = (items) => items.filter((i) => CHILD_TYPES.includes(i.type)).map((i) => ({ id: i.id, type: i.type, title: i.title, data: i.type === "game" ? { game: i.data.game } : undefined }));
  const bookPics = ruleOn(getLessonRules(), RULE.bookPictures);
  const books = child.bookIds
    .map(getBook)
    .filter((b) => b !== null)
    .map((book) => ({
      id: book.id,
      title: book.title,
      status: book.status,
      // The real cover (page 1) is what the child knows from school.
      cover: !book.isDemo && book.pageCount > 0 && hasPages(book.id) ? `/api/books/${book.id}/pages/1?thumb=1` : null,
      units: listUnits(book.id)
        .filter((u) => u.status === "approved")
        .map((u) => ({
          id: u.id,
          order: u.order,
          title: u.title,
          topic: u.topic,
          emoji: u.extract.vocabulary.find((v) => v.emoji)?.emoji ?? "⭐",
          emojis: u.extract.vocabulary.flatMap((v) => (v.emoji ? [v.emoji] : [])).slice(0, 4),
          pics: bookPics ? unitCovers(u) : [],
          items: playable(listItems({ unitId: u.id, status: "approved" })),
        }))
        .filter((u) => u.items.length),
    }));
  // Only the inspiration topics the parent gave to this child (Children → Edit), and only when approved.
  const topics = child.topicIds
    .map(getTopic)
    .filter((t) => t?.status === "approved")
    .map((t) => ({ id: t.id, title: t.title, emoji: t.emoji, pic: null, items: playable(listItems({ topicId: t.id, status: "approved" })) }))
    .filter((t) => t.items.length);
  const s = getAppSettings();
  return ok({ child, books, topics, stats: childStats(childId), settings: { breakMinutes: s.breakMinutes } });
});

/* --------------------------------- rules -------------------------------- */

on("GET", "/api/rules", async () => ok({ rules: getLessonRules(), defaults: DEFAULT_RULES }));

on("PUT", "/api/rules", async (req) => {
  const b = await body(req);
  if (b.reset) return ok({ rules: setLessonRules(DEFAULT_RULES) });
  const parsed = LessonRules.safeParse(b.rules);
  if (!parsed.success) return fail("Please check the rules.", 400, z.prettifyError(parsed.error));
  return ok({ rules: setLessonRules(parsed.data) });
});

/* ------------------------------- settings ------------------------------- */

on("GET", "/api/settings", async () => ok({ settings: getAppSettings(), voiceWarmUp: warmState() }));

on("PATCH", "/api/settings", async (req) => {
  const b = await body(req);
  const before = getAppSettings();
  if (b.ttsEngine === "natural" || b.ttsEngine === "browser") setSetting("ttsEngine", b.ttsEngine);
  if (typeof b.ttsVoice === "string" && isNaturalVoice(b.ttsVoice)) setSetting("ttsVoice", b.ttsVoice);
  if (typeof b.voiceName === "string") setSetting("voiceName", b.voiceName.slice(0, 200));
  if (b.childRate !== undefined) setSetting("childRate", String(Math.min(1.2, Math.max(0.6, Number(b.childRate) || 0.85))));
  if (typeof b.soundOn === "boolean") setSetting("soundOn", b.soundOn ? "1" : "0");
  if (b.breakMinutes !== undefined) setSetting("breakMinutes", String(Math.min(90, Math.max(5, Number(b.breakMinutes) || 20))));
  const after = getAppSettings();
  // A new voice or speed means new audio: make it in the background so taps stay quick.
  if (after.ttsEngine !== before.ttsEngine || after.ttsVoice !== before.ttsVoice || after.childRate !== before.childRate) warmVoices(2000, after);
  return ok({ settings: after });
});

/** Parent PIN: a simple child lock (not real security). */
on("POST", "/api/settings/pin", async (req) => {
  const b = await body(req);
  const pin = String(b.pin ?? "");
  if (b.action === "verify") {
    if (!getSetting("pinHash")) return ok({ ok: true, needsSetup: true });
    return checkPin(pin) ? ok({ ok: true }) : fail("Wrong PIN", 401);
  }
  if (b.action === "set") {
    if (!/^\d{4}$/.test(pin)) return fail("The PIN must be 4 digits.");
    if (getSetting("pinHash") && !checkPin(String(b.currentPin ?? ""))) return fail("The current PIN is wrong.", 401);
    setPin(pin);
    return ok({ ok: true });
  }
  return fail("Unknown action");
});

/* -------------------------------- topics -------------------------------- */

on("GET", "/api/topics", async (req) => {
  const status = new URL(req.url, location.href).searchParams.get("status") ?? undefined;
  return ok({ topics: listTopics(status).map((t) => ({ ...t, children: topicChildren(t.id) })) });
});

const NewTopic = z.object({
  title: z.string().trim().min(1, "Please enter a title.").max(80),
  emoji: z.string().trim().min(1).max(16).default("✨"),
  description: z.string().trim().max(400).default(""),
  stage: Stage,
  words: z
    .array(z.object({ word: z.string().trim().min(1).max(40), emoji: z.string().trim().max(16).default(""), vi: z.string().trim().max(60).optional() }))
    .min(3, "Add at least 3 words (with an emoji each).")
    .max(16),
  pattern: z.string().trim().max(120).optional(),
  sentences: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  reading: z.string().trim().max(1200).optional(),
});

/**
 * Saves a new draft topic (never touches book content):
 * - { topic: {title, emoji, description, stage, words, pattern?, sentences?, reading?} } — made by the offline builder;
 * - { pack } — an "inspiration-pack" JSON (the format AI Studio used), saved as it is.
 */
on("POST", "/api/topics", async (req) => {
  const b = await body(req);
  if (b.pack !== undefined) {
    const parsed = InspirationPack.safeParse(b.pack);
    if (!parsed.success) return fail("This pack is not valid.", 400, z.prettifyError(parsed.error));
    const pack = parsed.data;
    const extra = topUpGames(pack.items, { title: pack.topic.title, description: pack.topic.description, stage: pack.topic.stage, seed: pack.topic.title, recent: topicGames() });
    const topic = tx(() => {
      const t = createTopic(pack.topic);
      for (const it of [...pack.items, ...extra])
        createItem({ source: "inspiration", bookId: null, unitId: null, inspirationTopicId: t.id, type: it.type, title: it.title, status: "draft", stage: pack.topic.stage, data: it.data, createdBy: "parent" });
      return t;
    });
    return ok({ topic, addedGames: extra.map((i) => i.title) });
  }
  const parsed = NewTopic.safeParse(b.topic);
  if (!parsed.success) return fail("Please check the topic.", 400, z.prettifyError(parsed.error));
  const t = parsed.data;
  if (t.pattern && (t.pattern.match(/_{2,}/g) ?? []).length !== 1) return fail("Write the sentence pattern with one gap ___ (e.g. “I like ___.”).");
  const items = buildTopicItems(t);
  if (!items.length) return fail("Add at least 3 words (with an emoji each).");
  const topic = tx(() => {
    const created = createTopic({ title: t.title, emoji: t.emoji, description: t.description || `Words: ${t.words.map((w) => w.word).slice(0, 6).join(", ")}.`, stage: t.stage });
    for (const it of items)
      createItem({ source: "inspiration", bookId: null, unitId: null, inspirationTopicId: created.id, type: it.type, title: it.title, status: "draft", stage: t.stage, data: it.data, createdBy: "parent" });
    return created;
  });
  return ok({ topic, created: items.length });
});

on("GET", "/api/topics/:topicId", async (_req, { topicId }) => {
  const topic = getTopic(topicId);
  if (!topic) return fail("Topic not found", 404);
  return ok({ topic: { ...topic, children: topicChildren(topicId) }, items: listItems({ topicId }) });
});

on("PATCH", "/api/topics/:topicId", async (req, { topicId }) => {
  const b = await body(req);
  const topic = updateTopic(topicId, b);
  if (!topic) return fail("Topic not found", 404);
  if (b.status === "approved") warmVoices();
  return ok({ topic });
});

on("DELETE", "/api/topics/:topicId", async (_req, { topicId }) => {
  deleteTopic(topicId);
  return ok({ ok: true });
});

/* ------------------------------ natural voice ---------------------------- */

/** Prepares the natural voice for all approved lessons (or one book/topic), streamed as SSE. */
on("POST", "/api/tts/prepare", async (req) => {
  const b = await body(req);
  return sse((send, signal) => prepareVoices(b.target || "all", (msg, progress) => send("status", { msg, progress }), signal), req);
});

/* --------------------------------- units -------------------------------- */

on("GET", "/api/units/:unitId", async (_req, { unitId }) => {
  const unit = getUnit(unitId);
  if (!unit) return fail("Unit not found", 404);
  const siblings = listUnits(unit.bookId).map((u) => ({ id: u.id, order: u.order, title: u.title }));
  const book = getBook(unit.bookId);
  return ok({ unit, book: book && { ...book, hasPages: hasPages(book.id) }, items: listItems({ unitId }), siblings });
});

on("PATCH", "/api/units/:unitId", async (req, { unitId }) => {
  const unit = getUnit(unitId);
  if (!unit) return fail("Unit not found", 404);
  const b = await body(req);
  if (b.extract !== undefined) {
    const pages = Array.isArray(b.pages) && b.pages.length === 2 ? [Math.max(1, Number(b.pages[0]) || 1), Math.max(Number(b.pages[0]) || 1, Number(b.pages[1]) || 1)] : unit.pages;
    const parsed = UnitExtract.safeParse({ ...b.extract, id: unit.id, bookId: unit.bookId, order: unit.order, pages });
    if (!parsed.success) return fail("Please check the unit details.", 400, z.prettifyError(parsed.error));
    updateUnit(unitId, { extract: parsed.data });
    if (pages !== unit.pages) upsertUnit(parsed.data, b.status ?? unit.status);
  }
  if (b.status) updateUnit(unitId, { status: b.status });
  reassessBook(unit.bookId);
  return ok({ unit: getUnit(unitId) });
});

on("DELETE", "/api/units/:unitId", async (_req, { unitId }) => {
  const unit = getUnit(unitId);
  if (!unit) return fail("Unit not found", 404);
  deleteUnit(unitId);
  reassessBook(unit.bookId);
  return ok({ ok: true });
});

/** Offline practice (no AI) from the unit's words and patterns, saved as drafts. */
on("POST", "/api/units/:unitId/quick-pack", async (req, { unitId }) => {
  const unit = getUnit(unitId);
  if (!unit) return fail("Unit not found", 404);
  if (unit.extract.vocabulary.length < 3) return fail("This unit needs at least 3 words first.");
  const b = await body(req);
  const types = z.array(ContentType).safeParse(b.types);
  const items = quickPackForUnit(unit, types.success ? types.data : undefined);
  if (!items.length) return fail("These lesson types can't be made from this unit yet (grammar needs a sentence pattern with ___; reading needs a text or 2+ sentences).");
  return ok({ created: items.length });
});

/** Remakes the whole learning-resource set of one unit (replaces its current items). */
on("POST", "/api/units/:unitId/resources", async (req, { unitId }) => {
  const unit = getUnit(unitId);
  const book = unit ? getBook(unit.bookId) : null;
  if (!unit || !book) return fail("Unit not found", 404);
  if (unit.extract.vocabulary.filter((v) => v.word.trim()).length < 3) return fail("This unit needs at least 3 words first.");
  return sse(async (send) => {
    send("status", { message: "Making lessons with the offline builder…" });
    const old = listItems({ unitId });
    if (unit.status !== "approved") updateUnit(unitId, { status: "approved" });
    const r = await generateUnitResources(unit, book, { log: (msg) => send("status", { message: msg }) });
    for (const it of old) deleteItem(it.id);
    const others = listUnits(book.id);
    if (book.status !== "ready" && others.some((u) => listItems({ unitId: u.id, status: "approved" }).length)) upsertBook({ ...getBook(book.id), status: "ready", statusDetail: null });
    send("done", { created: r.created, mode: r.mode });
    warmVoices();
  }, req);
});

/* ------------------------------- dispatcher ------------------------------ */

/** Answers an /api/… request in the browser (null when no route matches). */
export async function handleApi(req) {
  const url = new URL(req.url, location.href);
  const path = url.pathname.replace(/^.*?(\/api\/)/, "/api/").replace(/\/+$/, "");
  for (const r of R) {
    if (r.method !== req.method) continue;
    const m = r.re.exec(path);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    return r.handler(req, params);
  }
  return fail(`Not found: ${req.method} ${path}`, 404);
}

/** Makes fetch("/api/…") (and fetch of the same URL with this site's path in front) answer from the browser. */
export function installApi() {
  const realFetch = window.fetch.bind(window);
  const isApi = (u) => typeof u === "string" && (u.startsWith("/api/") || new URL(u, location.href).pathname.includes("/api/")) && new URL(u, location.href).origin === location.origin;
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!isApi(url)) return realFetch(input, init);
    const req = input instanceof Request ? input : new Request(new URL(url, location.href), init);
    return handleApi(req);
  };
}

export { getAppSettings, PROFILES, assessBook };
