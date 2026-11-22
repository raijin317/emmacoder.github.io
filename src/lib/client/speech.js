import { DEFAULT_VOICE, normalizeSpeech, speechSpeed } from "../voices.js";
import { speechUnits } from "../speakables.js";
import { originalIndex, speechPlan, wordTimeline } from "../speechPlan.js";
import { getClip, naturalVoiceAllowed } from "./tts.js";
/**
 * American English speech.
 * - "natural": Kokoro neural voice made in this browser (src/lib/client/tts.js) — human-like, expressive.
 * - "browser": Web Speech API (the default, and the fallback when the natural voice is not ready).
 */
let settings = { engine: "browser", voice: DEFAULT_VOICE, voiceName: "", childRate: 0.85 };
let naturalFailures = 0;
export function configureSpeech(s) {
    settings = { ...settings, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) };
    naturalFailures = 0;
}
export function speechSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
}
/** How long a tap waits for the natural voice before the browser voice takes over (the clip is still made and cached). */
const NATURAL_WAIT_MS = 6000;
let token = 0;
let current = null;
let ticker = null;
let doneCb = null;
/** The natural-voice clip (object URL) for a text — made in this browser and cached. */
export function naturalClip(text, slow = false, voice = settings.voice, priority = "now") {
    return getClip(normalizeSpeech(text), voice, speechSpeed(settings.childRate, slow), priority);
}
/**
 * Says a text. Texts read in parts (sentences / lines, see speechPlan) are played part by part:
 * the first sentence starts as soon as it is ready, the next one is fetched while the first plays,
 * and the planned pause is left between them.
 */
export async function speak(text, opts = {}) {
    stopSpeaking();
    const my = ++token;
    doneCb = opts.onDone ?? null;
    const plan = speechPlan(text);
    if (!plan.length)
        return finish(my, opts);
    if ((settings.engine === "natural" || opts.voice) && naturalFailures < 3 && naturalVoiceAllowed()) {
        const r = await playNaturalFrom(text, plan, 0, opts, my);
        if (r === "ok" || my !== token)
            return;
    }
    if (my === token)
        browserSpeak(text, plan, 0, opts, my);
}
function finish(my, opts) {
    if (my !== token)
        return;
    doneCb = null;
    opts.onEnd?.();
    opts.onDone?.();
}
export function stopSpeaking() {
    token++;
    if (ticker)
        clearInterval(ticker);
    ticker = null;
    if (current) {
        current.onended = current.onerror = current.onplaying = null;
        current.pause();
        current = null;
    }
    if (speechSupported())
        window.speechSynthesis.cancel();
    const cb = doneCb;
    doneCb = null;
    cb?.();
}
/** Starts one part; resolves with the playing element, or null if the natural voice can't play it (soon enough). */
function playPart(part, opts, my) {
    return new Promise((resolve) => {
        let a = null;
        let settled = false;
        const settle = (ok) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve(ok ? a : null);
        };
        // Too slow (the clip is still being made): let the browser voice answer now; the clip is cached for next time.
        const timer = setTimeout(() => {
            if (my === token)
                a?.pause();
            settle(false);
        }, NATURAL_WAIT_MS);
        naturalClip(part.say, !!opts.slow, opts.voice ?? settings.voice, "now").then((url) => {
            if (settled || my !== token)
                return settle(false);
            a = new Audio(url);
            current = a;
            a.onplaying = () => {
                naturalFailures = 0;
                settle(true);
            };
            a.onerror = () => {
                if (!settled)
                    naturalFailures++;
                settle(false);
            };
            a.play().catch(() => settle(false));
        }, () => {
            if (!settled)
                naturalFailures++;
            settle(false);
        });
    });
}
async function playNaturalFrom(text, plan, k, opts, my) {
    const part = plan[k];
    const a = await playPart(part, opts, my);
    if (my !== token) {
        a?.pause();
        return "ok";
    }
    if (!a)
        return "fallback";
    if (k === 0)
        opts.onStart?.();
    const speed = speechSpeed(settings.childRate, !!opts.slow);
    if (opts.onBoundary)
        followPart(a, text, part, speed, opts.onBoundary);
    // Fetch the next sentence while this one plays.
    const next = plan[k + 1];
    if (next)
        void naturalClip(next.say, !!opts.slow, opts.voice ?? settings.voice, "soon").catch(() => { });
    a.onended = () => {
        if (ticker)
            clearInterval(ticker);
        ticker = null;
        if (my !== token)
            return;
        if (!next)
            return finish(my, opts);
        setTimeout(async () => {
            if (my !== token)
                return;
            const r = await playNaturalFrom(text, plan, k + 1, opts, my);
            if (r === "fallback" && my === token)
                browserSpeak(text, plan, k + 1, opts, my);
        }, part.pause / speed);
    };
    return "ok";
}
/** Word highlighting inside one playing part (words share its time by length). */
function followPart(a, text, part, speed, onBoundary) {
    const piece = text.slice(part.start, part.end);
    let timeline = null;
    let last = -1;
    if (ticker)
        clearInterval(ticker);
    ticker = setInterval(() => {
        if (!a.duration || !isFinite(a.duration))
            return;
        timeline ??= wordTimeline(piece, speed, a.duration);
        if (!timeline.length)
            return;
        const idx = Math.max(0, timeline.findLastIndex((w) => w.at <= a.currentTime));
        if (idx !== last) {
            last = idx;
            onBoundary(part.start + timeline[idx].start);
        }
    }, 60);
}
/* ------------------------------- browser voice ------------------------------- */
const PREFERRED = [/Ana.*Natural/i, /Ava.*Natural.*United States/i, /Jenny.*Natural/i, /Aria.*Natural/i, /Natural.*English \(United States\)/i, /Google US English/i, /Samantha/i];
let cachedVoices = [];
export function loadVoices() {
    if (!speechSupported())
        return Promise.resolve([]);
    const list = () => window.speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("en-us"));
    const now = list();
    if (now.length)
        return Promise.resolve((cachedVoices = now));
    return new Promise((resolve) => {
        const done = () => resolve((cachedVoices = list()));
        window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
        setTimeout(done, 1500);
    });
}
export function pickVoice(voices = cachedVoices) {
    if (settings.voiceName) {
        const chosen = voices.find((v) => v.name === settings.voiceName);
        if (chosen)
            return chosen;
    }
    for (const re of PREFERRED) {
        const v = voices.find((x) => re.test(x.name));
        if (v)
            return v;
    }
    return voices[0] ?? null;
}
/** Browser voice: the same sentence/line parts as the natural voice, with the same pauses between them. */
async function browserSpeak(text, plan, from, opts, my) {
    if (!speechSupported())
        return finish(my, opts);
    if (!cachedVoices.length)
        await loadVoices();
    if (my !== token)
        return;
    const rate = speechSpeed(settings.childRate, !!opts.slow);
    const say = (k) => {
        if (my !== token)
            return;
        const part = plan[k];
        const u = new SpeechSynthesisUtterance(part.say);
        u.lang = "en-US";
        const v = pickVoice();
        if (v)
            u.voice = v;
        u.rate = rate;
        u.pitch = 1.1;
        if (k === from)
            u.onstart = () => my === token && opts.onStart?.();
        if (opts.onBoundary)
            u.onboundary = (e) => opts.onBoundary(originalIndex(text, part, e.charIndex));
        u.onend = () => {
            if (my !== token)
                return;
            if (k + 1 < plan.length)
                setTimeout(() => say(k + 1), part.pause / rate);
            else
                finish(my, opts);
        };
        u.onerror = () => finish(my, opts);
        window.speechSynthesis.speak(u);
    };
    say(from);
}
/* ------------------------------- prefetching ------------------------------- */
/**
 * Warms the voice cache for the activity on screen: clip by clip (passages as their sentences),
 * short things first. Queued as "soon", so the voice engine makes them only after anything the child taps.
 */
export function prefetchSpeech(list, signal) {
    if (settings.engine !== "natural" || typeof window === "undefined" || !naturalVoiceAllowed())
        return;
    const units = speechUnits(list);
    const queue = [...units.filter((u) => u.text.length <= 60), ...units.filter((u) => u.text.length > 60)];
    const worker = async () => {
        while (queue.length && !signal?.aborted) {
            const s = queue.shift();
            try {
                await naturalClip(s.text, s.slow, settings.voice, "soon");
            }
            catch {
                return;
            }
        }
    };
    void worker();
}
export function recognitionSupported() {
    if (typeof window === "undefined")
        return false;
    const w = window;
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}
/** Listens once and resolves with the alternatives heard (lower-cased). */
export function listenOnce(timeoutMs = 7000) {
    return new Promise((resolve, reject) => {
        const w = window;
        const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (!Ctor)
            return reject(new Error("Speech recognition is not available in this browser."));
        const rec = new Ctor();
        rec.lang = "en-US";
        rec.interimResults = false;
        rec.maxAlternatives = 5;
        let heard = [];
        const timer = setTimeout(() => rec.stop(), timeoutMs);
        rec.onresult = (e) => {
            const r = e.results[0];
            heard = Array.from({ length: r.length }, (_, i) => r[i].transcript.toLowerCase().trim());
        };
        rec.onerror = (e) => {
            clearTimeout(timer);
            if (e.error === "no-speech")
                resolve([]);
            else
                reject(new Error(e.error === "not-allowed" ? "Please allow the microphone." : e.error));
        };
        rec.onend = () => {
            clearTimeout(timer);
            resolve(heard);
        };
        rec.start();
    });
}
const norm = (s) => s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
/** Lenient match for young children: share of expected words that were heard. Returns 0–3 stars. */
export function speechStars(expected, heard) {
    const target = norm(expected).split(" ").filter(Boolean);
    if (!target.length || !heard.length)
        return 0;
    let best = 0;
    for (const h of heard) {
        const got = new Set(norm(h).split(" "));
        const hit = target.filter((w) => got.has(w) || [...got].some((g) => g.length > 2 && (g.startsWith(w.slice(0, 3)) || w.startsWith(g.slice(0, 3))))).length;
        best = Math.max(best, hit / target.length);
    }
    return best >= 0.85 ? 3 : best >= 0.5 ? 2 : best > 0 ? 1 : 0;
}
