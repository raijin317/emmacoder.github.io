import { MAX_SPEECH_CHARS, PRAISE, TROPHY_WON, TRY_AGAIN, normalizeSpeech } from "./voices.js";
import { speechPlan } from "./speechPlan.js";
import { ALBUM } from "./stickers.js";
import { gameSpeakables } from "./games.js";
function fromQuestion(q, out) {
    const n = (text, slow = false) => out.push({ text, slow });
    switch (q.kind) {
        case "mc":
            n(q.prompt);
            q.options.forEach((o) => n(o));
            break;
        case "picture":
            n(q.prompt);
            n(q.prompt, true);
            break;
        case "tf":
            n(q.statement);
            break;
        case "fill":
            q.options.forEach((o) => n(q.sentence.replace("___", o)));
            break;
        case "match":
            n(q.prompt);
            q.pairs.forEach((p) => n(p.word));
            break;
        case "order":
            n(q.words.join(" "));
            break;
    }
}
export function speakablesFor(item) {
    const out = [];
    const n = (text, slow = false) => text && out.push({ text, slow });
    const d = item.data;
    switch (item.type) {
        case "vocabulary":
            for (const w of d.words) {
                n(w.word);
                n(w.word, true);
                n(w.example);
            }
            break;
        case "listening": {
            const l = d;
            for (const t of l.tasks) {
                n(t.say);
                n(t.say, true);
            }
            break;
        }
        case "speaking":
            for (const p of d.prompts) {
                n(p.mode === "answer" && p.question ? p.question : p.text);
                n(p.text, true);
            }
            break;
        case "grammar": {
            const g = d;
            g.examples.forEach((e) => n(e.text));
            g.practice.forEach((q) => fromQuestion(q, out));
            break;
        }
        case "reading": {
            const r = d;
            n(r.passage);
            new Set(r.passage.split(/\s+/).map((t) => t.replace(/[^\w'-]/g, "")).filter(Boolean)).forEach((w) => n(w));
            r.questions.forEach((q) => fromQuestion(q, out));
            break;
        }
        case "quiz":
            d.questions.forEach((q) => fromQuestion(q, out));
            break;
        case "test":
            d.sections.forEach((s) => s.questions.forEach((q) => fromQuestion(q, out)));
            break;
        case "game": {
            const g = d;
            out.push(...gameSpeakables(g.game, g.words.map((w) => w.word)));
            break;
        }
    }
    return dedupe(out);
}
export function commonSpeakables() {
    return [...Object.values(PRAISE), TRY_AGAIN, TROPHY_WON, ...ALBUM.flatMap((p) => [p.title, ...p.stickers.map((s) => s.name)])].map((text) => ({ text, slow: false }));
}
/**
 * What the voice engine actually makes: a text read in parts (a passage, "Hi. I'm Mai.") is played part by part,
 * so each part is its own clip — the first sentence plays at once, and a sentence shared by two lessons is made once.
 */
export function speechUnits(list) {
    const seen = new Set();
    const out = [];
    for (const s of list) {
        // Exactly what the player asks the server for: each part's spoken text (labels, blanks and emoji already handled).
        for (const { say: text } of speechPlan(s.text)) {
            const key = `${s.slow}|${normalizeSpeech(text)}`;
            if (!seen.has(key)) {
                seen.add(key);
                out.push({ text: normalizeSpeech(text), slow: s.slow });
            }
        }
    }
    return out;
}
function dedupe(list) {
    const seen = new Set();
    return list
        .map((s) => ({ text: normalizeSpeech(s.text), slow: s.slow }))
        .filter((s) => s.text && s.text.length <= MAX_SPEECH_CHARS && !seen.has(`${s.slow}|${s.text}`) && seen.add(`${s.slow}|${s.text}`));
}
