import { html } from "@/lib/html.js";
import { useEffect, useMemo, useRef } from "react";
import { speak } from "@/lib/client/speech.js";
import { shuffleOnce } from "./quiz.js";
/** Readers see the words in the games; pre-readers play by listening. */
export const canRead = (stage) => stage !== "pre-reader";
/** Sparkles (or any emoji) flying out from a point inside a `relative` parent. Re-mount (key) to play again. */
export function Burst({ x = "50%", y = "50%", bits = ["✨", "⭐", "🌟", "💫", "✨", "⭐", "🎉", "✨", "🌟"], size = 30, spread = 90 }) {
    const parts = useMemo(() => bits.map((b, k) => {
        const a = (k / bits.length) * Math.PI * 2 + 0.4;
        const r = spread * (0.75 + (k % 3) * 0.2);
        return { b, dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r), rot: (k % 2 ? 1 : -1) * (90 + k * 20) };
    }), [bits, spread]);
    return (html`<span aria-hidden className="pointer-events-none absolute z-40" style=${{ left: x, top: y }}>
      ${parts.map((p, k) => (html`<span key=${k} className="burst-bit" style=${{ "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.rot}deg`, fontSize: size }}>
          ${p.b}
        </span>`))}
    </span>`);
}
/** The words of the rounds (shuffled once per game), at most `max`. */
export function useRounds(words, seed, max = 6) {
    return useMemo(() => shuffleOnce(words, seed).slice(0, Math.min(max, words.length)), [words, seed, max]);
}
/** The target plus `n` other words, in a shuffled order. */
export function withOthers(words, target, n, seed) {
    const others = shuffleOnce(words.filter((w) => w.word !== target.word), seed).slice(0, n);
    return shuffleOnce([target, ...others], "mix" + seed);
}
/** Says `text` a moment after it changes (a new round). */
export function useSayOnChange(text, delay = 450) {
    useEffect(() => {
        if (!text)
            return;
        const t = setTimeout(() => speak(text), delay);
        return () => clearTimeout(t);
    }, [text, delay]);
}
/** setTimeout that is cleared when the game closes (no state updates after unmount). */
export function useTimers() {
    const ids = useRef([]);
    useEffect(() => {
        const list = ids.current;
        return () => list.forEach(clearTimeout);
    }, []);
    return useMemo(() => ({
        after: (ms, fn) => {
            ids.current.push(setTimeout(fn, ms));
        },
        clear: () => {
            ids.current.forEach(clearTimeout);
            ids.current = [];
        },
    }), []);
}
/** Keeps score the same way in every game: right the first time = 1 point; otherwise the word counts as missed. */
export function scoreRound(s, word, misses) {
    return misses === 0 ? { score: s.score + 1, missed: s.missed } : { score: s.score, missed: s.missed.includes(word) ? s.missed : [...s.missed, word] };
}
/** Bright, kid-friendly fills used by the games. */
export const FUN_COLORS = ["#ff6b9a", "#4fc3f7", "#ffc83d", "#66bb6a", "#9c6ade", "#ff8a3d"];
