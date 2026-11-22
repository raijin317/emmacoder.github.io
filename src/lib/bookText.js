import { picKey } from "./pictures.js";
/** Lower case, letters/digits/apostrophes only, single spaces — for comparing texts. */
export function normText(s) {
    return s
        .toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/[^a-z0-9'\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
/**
 * The texts a child can read from this unit of the book: its reading texts,
 * or — when the unit has none — its printed sentences put together.
 */
export function bookTexts(unit) {
    const readings = (unit.readings ?? []).filter((r) => r.text.trim());
    if (readings.length)
        return readings;
    const sentences = (unit.sentences ?? []).filter((s) => s.trim());
    return sentences.length >= 2 ? [{ title: "From the book", text: sentences.slice(0, 10).join("\n") }] : [];
}
/** True when the passage is (part of) one of the book's texts. */
export function isFromBook(passage, texts) {
    const p = normText(passage);
    return p.length >= 3 && texts.some((t) => normText(t.text).includes(p));
}
const hasWord = (sentence, word) => new RegExp(`(^|[^a-z])${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(s|es)?($|[^a-z])`).test(sentence.toLowerCase());
/** A sentence from the book that uses this word (shortest first), if any. */
export function bookSentenceFor(word, sentences, maxWords = 99) {
    return sentences
        .filter((s) => hasWord(s, word) && s.split(/\s+/).length <= maxWords)
        .sort((a, b) => a.length - b.length)[0];
}
/** Word-level labels used by an item (picture options, pairs, cards, game words). */
function itemWords(item) {
    const out = [];
    const q = (x) => {
        if (x.kind === "picture")
            out.push(...x.options.map((o) => o.label));
        if (x.kind === "match")
            out.push(...x.pairs.map((p) => p.word));
    };
    switch (item.type) {
        case "vocabulary":
            out.push(...item.data.words.map((w) => w.word));
            break;
        case "listening":
            item.data.tasks.forEach((t) => out.push(...t.options.map((o) => o.label)));
            break;
        case "game":
            out.push(...item.data.words.map((w) => w.word));
            break;
        case "quiz":
            item.data.questions.forEach(q);
            break;
        case "test":
            item.data.sections.forEach((s) => s.questions.forEach(q));
            break;
        case "grammar":
            item.data.practice.forEach(q);
            break;
        case "reading":
            item.data.questions.forEach(q);
            break;
    }
    return out;
}
/** Labels in the item that are not words of the book (unit + earlier units). */
export function wordsOutsideBook(item, allowed) {
    const ok = new Set(allowed.map(picKey));
    const known = (w) => {
        const k = picKey(w);
        return ok.has(k) || ok.has(k.replace(/es$/, "")) || ok.has(k.replace(/s$/, ""));
    };
    return [...new Set(itemWords(item).filter((w) => !known(w)))];
}
