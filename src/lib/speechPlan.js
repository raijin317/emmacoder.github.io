/** Pauses in ms at speed 1. */
export const PAUSE = { comma: 200, sentence: 360, line: 480, paragraph: 850 };
/** Changes whenever the way texts are split or paused changes, so cached audio is made again. */
export const PLAN_VERSION = "plan1";
const ABBR = new Set(["mr", "mrs", "ms", "dr", "st", "mt", "etc", "vs", "e.g", "i.e"]);
/** "Mai: Hello!", "A: Is it…", "Mr Brown: …" at the start of a line. */
const LABEL = /^\p{Lu}[\p{L}'.-]{0,15}(?: \p{Lu}[\p{L}'.-]{0,15})?\s*:[^\S\n]+(?=\S)/u;
const BLANK = /_{2,}/g;
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
const LONG = 180;
export function speechPlan(text) {
    const lines = logicalLines(text);
    // Speaker labels are only dropped in real dialogues (two or more labelled lines).
    const dialogue = lines.filter((l) => LABEL.test(text.slice(l.start, l.end))).length >= 2;
    const parts = [];
    for (const line of lines) {
        let start = line.start;
        if (dialogue)
            start += LABEL.exec(text.slice(start, line.end))?.[0].length ?? 0;
        const mine = sentences(text, start, line.end)
            .flatMap((r) => splitLong(text, r))
            .map((r) => ({ say: voiceText(text.slice(r.start, r.end)), start: r.start, end: r.end, pause: r.pause ?? PAUSE.sentence }))
            .filter((p) => p.say);
        if (!mine.length)
            continue;
        mine[mine.length - 1].pause = line.blankAfter ? PAUSE.paragraph : PAUSE.line;
        parts.push(...mine);
    }
    if (parts.length)
        parts[parts.length - 1].pause = 0;
    // Several parts: each one ends like a sentence (falling voice, no run-on).
    if (parts.length > 1)
        for (const p of parts)
            if (/[\p{L}\p{N}]$/u.test(p.say))
                p.say += ".";
    return parts;
}
/** When each word starts (seconds) in audio made from `speechPlan(text)`, given the audio's real length. */
export function wordTimeline(text, speed, duration) {
    let parts = speechPlan(text);
    if (!parts.length)
        parts = [{ say: text, start: 0, end: text.length, pause: 0 }];
    const words = parts.map((p) => [...text.slice(p.start, p.end).matchAll(/\S+/g)].map((m) => ({ start: p.start + m.index, weight: m[0].length + 2 })));
    const pauses = parts.reduce((s, p) => s + p.pause, 0) / 1000 / speed;
    const weight = words.flat().reduce((s, w) => s + w.weight, 0) || 1;
    const talk = Math.max(duration - pauses, duration * 0.5);
    const out = [];
    let t = 0;
    parts.forEach((p, k) => {
        for (const w of words[k]) {
            out.push({ start: w.start, at: t });
            t += (w.weight / weight) * talk;
        }
        t += p.pause / 1000 / speed;
    });
    return out;
}
/** The words of a part as the voice says them, mapped back to the original text (browser voice). */
export function originalIndex(text, part, sayIndex) {
    const said = [...part.say.matchAll(/\S+/g)];
    const k = Math.max(0, said.findLastIndex((m) => m.index <= sayIndex));
    const words = [...text.slice(part.start, part.end).matchAll(/\S+/g)];
    return part.start + (words[Math.min(k, words.length - 1)]?.index ?? 0);
}
/* --------------------------------- helpers --------------------------------- */
/** Lines of text; a line that clearly goes on ("I am eight\nyears old.") is joined with the next. */
function logicalLines(text) {
    const raw = [];
    let pos = 0;
    for (const l of text.split("\n")) {
        const start = pos + (l.length - l.trimStart().length);
        const end = pos + l.trimEnd().length;
        pos += l.length + 1;
        if (end > start)
            raw.push({ start, end, blankAfter: false });
        else if (raw.length)
            raw[raw.length - 1].blankAfter = true;
    }
    const out = [];
    for (const l of raw) {
        const prev = out[out.length - 1];
        if (prev && !prev.blankAfter && !/[.!?…:;]["'”’)\]]*$/.test(text.slice(prev.start, prev.end)) && /^\p{Ll}/u.test(text.slice(l.start, l.end))) {
            prev.end = l.end;
            prev.blankAfter = l.blankAfter;
        }
        else
            out.push({ ...l });
    }
    return out;
}
/** Sentence ranges inside [from, to): split after . ! ? (not after Mr. / 3.5 / "..." / before a small letter). */
function sentences(text, from, to) {
    const out = [];
    let s = from;
    for (let k = from; k < to; k++) {
        if (!/[.!?]/.test(text[k]))
            continue;
        let e = k;
        while (e + 1 < to && /[.!?…]/.test(text[e + 1]))
            e++;
        while (e + 1 < to && /["'”’)\]]/.test(text[e + 1]))
            e++;
        const run = text.slice(k, e + 1);
        const next = e + 1;
        if (next >= to)
            break;
        if (!/\s/.test(text[next]) || /^\.{2,}/.test(run)) {
            k = e;
            continue;
        }
        if (text[k] === "." && !/[!?]/.test(run)) {
            const word = /(\S+)$/.exec(text.slice(s, k))?.[1].toLowerCase() ?? "";
            const after = /\S/.exec(text.slice(next, to))?.[0] ?? "";
            if (ABBR.has(word) || /\p{Ll}/u.test(after)) {
                k = e;
                continue;
            }
        }
        out.push({ start: s, end: e + 1 });
        s = next;
        k = e;
    }
    out.push({ start: s, end: to });
    return out.map((r) => trim(text, r)).filter((r) => r.end > r.start);
}
/** Very long sentences are cut at the comma nearest the middle (the voice model reads ~500 sounds at once). */
function splitLong(text, r) {
    if (r.end - r.start <= LONG)
        return [r];
    const mid = (r.start + r.end) / 2;
    let best = -1;
    for (let k = r.start + 20; k < r.end - 20; k++)
        if (/[,;]/.test(text[k]) && /\s/.test(text[k + 1] ?? "") && (best < 0 || Math.abs(k - mid) < Math.abs(best - mid)))
            best = k;
    if (best < 0)
        return [r];
    return [...splitLong(text, { start: r.start, end: best + 1, pause: PAUSE.comma }), ...splitLong(text, trim(text, { start: best + 1, end: r.end, pause: r.pause }))];
}
function trim(text, r) {
    let { start, end } = r;
    while (start < end && /\s/.test(text[start]))
        start++;
    while (end > start && /\s/.test(text[end - 1]))
        end--;
    return { ...r, start, end };
}
/** What the voice should say for a piece of text: blanks become a short pause, emoji are dropped. */
function voiceText(s) {
    const out = s.replace(BLANK, "…").replace(EMOJI, "").replace(/\s+/g, " ").replace(/ +([,.!?])/g, "$1").trim();
    return /[\p{L}\p{N}]/u.test(out) ? out : "";
}
