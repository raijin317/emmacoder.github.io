import { bookSentenceFor } from "./bookText.js";
import { fillPattern } from "./quickPack.js";

/**
 * A grammar lesson made without AI from a unit's sentence pattern ("I have a ___."):
 * a short kid-friendly explanation, examples (the book's own sentences first, then the pattern filled
 * with the unit's words) and practice (fill the gap, put the words in order).
 */
function rng(seedText) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function grammarItem(unit, profile, o = { seed: "x" }) {
  const patterns = (unit.patterns ?? []).filter((p) => (p.text.match(/_{2,}/g) ?? []).length === 1);
  const words = (unit.vocabulary ?? [])
    .filter((v) => v.word.trim())
    .slice(0, 10)
    .map((v) => ({ word: v.word.trim(), emoji: v.emoji?.trim() || "⭐" }));
  if (!patterns.length || words.length < 3) return null;
  const rand = rng(o.seed);
  const shuffle = (a) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const k = Math.floor(rand() * (i + 1));
      [b[i], b[k]] = [b[k], b[i]];
    }
    return b;
  };
  const { text: pattern, function: use } = patterns[0];
  const sentences = (o.sentences ?? unit.sentences ?? []).map((s) => s.trim()).filter(Boolean);
  const example = (w) => bookSentenceFor(w.word, sentences, profile.maxSentenceWords + 2) ?? fillPattern(pattern, w.word);
  const young = !profile.allowReadingInstructions;
  const said = pattern.replace(/_{2,}/, "…");
  const explanation = `Say “${said}” and put a word in the gap${use ? ` — we use it for ${use.replace(/\.$/, "")}` : ""}.`;
  const examples = shuffle(words)
    .slice(0, young ? 3 : 4)
    .map((w) => ({ text: example(w), emoji: w.emoji }));
  const others = (w, n) => shuffle(words.filter((x) => x.word !== w.word)).slice(0, n);
  const practice = shuffle(words)
    .slice(0, young ? 2 : 3)
    .map((w) => ({ kind: "fill", sentence: pattern.replace(/_{2,}/, "___"), options: shuffle([w.word, ...others(w, young ? 1 : 2).map((x) => x.word)]), answer: w.word }));
  if (!young) {
    const s = examples.find((e) => {
      const n = e.text.replace(/[.?!]$/, "").split(/\s+/).length;
      return n >= 3 && n <= 8;
    });
    if (s) practice.push({ kind: "order", prompt: "Put the words in order.", emoji: s.emoji, words: s.text.replace(/[.?!]$/, "").split(/\s+/) });
  }
  return { type: "grammar", title: `${unit.title}: ${said}`, data: { pattern, explanation, examples, practice } };
}
