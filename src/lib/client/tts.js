/**
 * The natural voice in the browser: clips are made by Kokoro in a Web Worker (tts-worker.js)
 * and saved in the browser's Cache Storage, so every sentence is made once and then plays at once.
 * Like the desktop app, the queue has priorities:
 *   now  — the child tapped 🔊 / a word (played right away)
 *   soon — prefetch of the activity on screen, "Prepare voices"
 *   idle — background warm-up of all lessons
 * The model (~90 MB) is downloaded only after the parent turns the natural voice on in Settings.
 */
import { normalizeSpeech, speechSpeed } from "../voices.js";
import { PLAN_VERSION, speechPlan } from "../speechPlan.js";
import { commonSpeakables, speakablesFor, speechUnits } from "../speakables.js";
import { sha256Hex } from "@/server/sha256.js";
import { getAppSettings, getTopic, listBooks, listItems, listUnits } from "@/server/repo.js";

const CACHE = "emma-tts-v1";
const ALLOW_KEY = "emma.naturalVoice";
const RANK = { now: 0, soon: 1, idle: 2 };

/* ------------------------------ model state ------------------------------ */

let worker = null;
let model = { status: "off", loaded: 0, total: 0, error: null };
const listeners = new Set();
const setModel = (patch) => {
  model = { ...model, ...patch };
  listeners.forEach((cb) => cb(model));
};
export const modelState = () => model;
export function onModelState(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function naturalVoiceAllowed() {
  try {
    return localStorage.getItem(ALLOW_KEY) === "1";
  } catch {
    return false;
  }
}

/** The parent agreed to download the natural voice (Settings) — or turned it off again. */
export function allowNaturalVoice(on) {
  try {
    if (on) localStorage.setItem(ALLOW_KEY, "1");
    else localStorage.removeItem(ALLOW_KEY);
  } catch {
    /* ignore */
  }
  if (on) loadModel();
}

let readyPromise = null;
let readyResolve = null;
let readyReject = null;
const pending = new Map();
let nextId = 1;

function startWorker() {
  const w = new Worker(new URL("./tts-worker.js", import.meta.url), { type: "module" });
  w.onmessage = (e) => {
    const m = e.data;
    if (m.type === "progress") setModel({ status: "loading", loaded: m.loaded, total: m.total });
    if (m.type === "ready") {
      setModel({ status: "ready", error: null });
      readyResolve?.();
    }
    if (m.type === "fatal") {
      setModel({ status: "error", error: m.error });
      readyReject?.(new Error(m.error));
      readyPromise = null;
    }
    if (m.type === "clip") {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.wav) p.resolve(new Blob([m.wav], { type: "audio/wav" }));
      else p.reject(new Error(m.error || "The voice could not be made."));
    }
  };
  w.onerror = (e) => {
    setModel({ status: "error", error: e.message || "The voice engine stopped." });
    readyReject?.(new Error("The voice engine stopped."));
    readyPromise = null;
    for (const p of pending.values()) p.reject(new Error("The voice engine stopped."));
    pending.clear();
    worker = null;
  };
  return w;
}

/** Loads (downloads the first time) the voice model. */
export function loadModel() {
  if (!naturalVoiceAllowed()) return Promise.reject(new Error("The natural voice is off."));
  if (readyPromise) return readyPromise;
  worker ??= startWorker();
  if (model.status !== "ready") setModel({ status: "loading", error: null });
  readyPromise = new Promise((res, rej) => ((readyResolve = res), (readyReject = rej)));
  readyPromise.catch(() => {});
  worker.postMessage({ type: "load" });
  return readyPromise;
}

/* ------------------------------- clip cache ------------------------------ */

/** Cache key of a text (a word or one plain sentence keeps its key; texts read in parts carry the plan version). */
function clipKey(text, voice, speed) {
  const n = normalizeSpeech(text);
  const plan = speechPlan(n);
  const style = plan.length === 1 && plan[0].say === n ? "" : `${PLAN_VERSION}|`;
  return `${voice}/${sha256Hex(`${style}${speed.toFixed(2)}|${n}`).slice(0, 20)}`;
}
const cacheUrl = (key) => new URL(`tts-cache/${key}.wav`, document.baseURI).href;
const memory = new Map();

async function openCache() {
  try {
    return globalThis.caches ? await caches.open(CACHE) : null;
  } catch {
    return null;
  }
}

async function cached(key) {
  if (memory.has(key)) return memory.get(key);
  const c = await openCache();
  const hit = c && (await c.match(cacheUrl(key)));
  if (!hit) return null;
  const url = URL.createObjectURL(await hit.blob());
  memory.set(key, url);
  return url;
}

/* ---------------------------------- queue --------------------------------- */

const q = { jobs: [], busy: null, seq: 0 };

/** URL of the audio for this text (from the cache, or made now — in priority order). */
export async function getClip(text, voice, speed, priority = "now") {
  if (!naturalVoiceAllowed()) throw new Error("The natural voice is off.");
  const n = normalizeSpeech(text);
  const key = clipKey(n, voice, speed);
  const hit = await cached(key);
  if (hit) return hit;
  return new Promise((resolve, reject) => {
    const rank = RANK[priority] ?? 0;
    const same = q.busy?.key === key ? q.busy : q.jobs.find((j) => j.key === key);
    if (same) {
      same.waiters.push({ resolve, reject });
      same.rank = Math.min(same.rank, rank); // a tap on something already queued for later moves it up
    } else q.jobs.push({ key, text: n, voice, speed, rank, seq: q.seq++, waiters: [{ resolve, reject }] });
    pump();
  });
}

function pump() {
  if (q.busy || !q.jobs.length) return;
  q.jobs.sort((a, b) => a.rank - b.rank || a.seq - b.seq);
  const job = q.jobs.shift();
  q.busy = job;
  make(job)
    .then(
      (url) => job.waiters.forEach((w) => w.resolve(url)),
      (e) => job.waiters.forEach((w) => w.reject(e)),
    )
    .finally(() => {
      q.busy = null;
      pump();
    });
}

async function make(job) {
  const hit = await cached(job.key);
  if (hit) return hit;
  await loadModel();
  const parts = speechPlan(job.text).map((p) => ({ say: p.say, pause: p.pause }));
  if (!parts.length) throw new Error("Nothing to say.");
  const id = nextId++;
  const blob = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("The voice took too long."));
    }, 90_000 + job.text.length * 150);
    pending.set(id, {
      resolve: (b) => (clearTimeout(timer), resolve(b)),
      reject: (e) => (clearTimeout(timer), reject(e)),
    });
    worker.postMessage({ type: "gen", id, parts, voice: job.voice, speed: job.speed });
  });
  const c = await openCache();
  if (c) await c.put(cacheUrl(job.key), new Response(blob, { headers: { "Content-Type": "audio/wav" } })).catch(() => {});
  const url = URL.createObjectURL(blob);
  memory.set(job.key, url);
  return url;
}

/** Throws away all saved voice clips (e.g. to free space). */
export async function clearVoiceCache() {
  memory.forEach((u) => URL.revokeObjectURL(u));
  memory.clear();
  try {
    await caches?.delete(CACHE);
  } catch {
    /* ignore */
  }
}

/* --------------------------- warm-up / prepare --------------------------- */

const state = { gen: 0, running: false, done: 0, total: 0 };
let warmTimer = null;

export const warmState = () => ({ running: state.running, done: state.done, total: state.total });

/** Lessons in the order a child meets them: unit 1 of every book first, then unit 2, …, then the extra topics. */
function lessonsInOrder() {
  const order = new Map();
  for (const b of listBooks()) for (const u of listUnits(b.id)) order.set(u.id, u.order);
  return listItems({ status: "approved" }).sort((a, b) => (a.unitId ? (order.get(a.unitId) ?? 99) : 999) - (b.unitId ? (order.get(b.unitId) ?? 99) : 999));
}

async function missing(units, voice, childRate) {
  const c = await openCache();
  const keys = c ? new Set((await c.keys()).map((r) => r.url)) : new Set();
  return units.filter((u) => {
    const key = clipKey(u.text, voice, speechSpeed(childRate, u.slow));
    return !memory.has(key) && !keys.has(cacheUrl(key));
  });
}

/** (Re)starts the background warm-up soon — only when the natural voice is on. */
export function warmVoices(delayMs = 2000) {
  clearTimeout(warmTimer);
  warmTimer = setTimeout(() => void runWarm(++state.gen), delayMs);
}

async function runWarm(gen) {
  try {
    const s = getAppSettings();
    if (s.ttsEngine !== "natural" || !naturalVoiceAllowed()) return;
    const units = speechUnits([...commonSpeakables(), ...lessonsInOrder().flatMap((i) => speakablesFor(i))]);
    const todo = await missing(units, s.ttsVoice, s.childRate);
    Object.assign(state, { running: todo.length > 0, done: 0, total: todo.length });
    for (const u of todo) {
      if (gen !== state.gen) return; // settings or lessons changed: a newer run took over
      try {
        await getClip(u.text, s.ttsVoice, speechSpeed(s.childRate, u.slow), "idle");
      } catch (e) {
        if (model.status === "error") return;
      }
      state.done++;
    }
  } catch (e) {
    console.error("[voice warm-up]", e?.message);
  } finally {
    if (gen === state.gen) state.running = false;
  }
}

/** "Prepare voices": all approved lessons, or one book / one topic; reports progress. */
export async function prepareVoices(target, report, signal) {
  const s = getAppSettings();
  if (!naturalVoiceAllowed()) throw new Error("Turn on the natural voice first (Settings → Voice).");
  let items = lessonsInOrder();
  if (target && target !== "all") items = items.filter((i) => i.bookId === target || i.inspirationTopicId === target);
  const label = target && target !== "all" ? (getTopic(target)?.title ?? listBooks().find((b) => b.id === target)?.title ?? target) : "all lessons";
  const units = speechUnits([...(target === "all" ? commonSpeakables() : []), ...items.flatMap((i) => speakablesFor(i))]);
  const todo = await missing(units, s.ttsVoice, s.childRate);
  if (!todo.length) return report(`✅ The voice for ${label} is ready.`, 100);
  report(`Preparing ${todo.length} sentences for ${label}…`, 0);
  let done = 0;
  for (const u of todo) {
    if (signal?.aborted) return;
    try {
      await getClip(u.text, s.ttsVoice, speechSpeed(s.childRate, u.slow), "soon");
    } catch (e) {
      if (model.status === "error") throw new Error(`The voice engine could not start: ${model.error}`);
    }
    done++;
    if (done % 3 === 0 || done === todo.length) report(`${done}/${todo.length} sentences ready`, Math.round((done / todo.length) * 100));
  }
  report(`✅ The voice for ${label} is ready.`, 100);
}
