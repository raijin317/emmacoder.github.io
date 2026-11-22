import { html } from "@/lib/html.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { speak } from "@/lib/client/speech.js";
import { sfx } from "@/lib/client/sfx.js";
import { PRAISE, TROPHY_WON } from "@/lib/voices.js";
import { ALBUM } from "@/lib/stickers.js";
import { StickerArt, Trophy } from "./Sticker.js";
export { StickerArt, Trophy, RobotArt } from "./Sticker.js";
/* ------------------------------- Mascot ------------------------------- */
/** One heart-shaped clover leaf with its tip at the centre (60,52); rotated for the four leaves. */
const LEAF = "M60 52 C42 42 34 20 48 14 C55 11 60 16 60 22 C60 16 65 11 72 14 C86 20 78 42 60 52 Z";
/** Emma's mascot: a smiling four-leaf clover (original artwork). */
export function CloverMascot({ size = 96, className = "motion-safe:animate-float shrink-0" }) {
    return (html`<svg width=${size} height=${size} viewBox="0 0 120 120" role="img" aria-label="Four-leaf clover mascot" className=${className}>
      <path d="M62 64 C64 82 72 96 84 110" stroke="#2e7d32" strokeWidth="6" fill="none" strokeLinecap="round" />
      ${[0, 90, 180, 270].map((deg) => (html`<g key=${deg} transform=${`rotate(${deg} 60 52)`}>
          <path d=${LEAF} fill="#66bb6a" stroke="#2b2d42" strokeWidth="3" strokeLinejoin="round" />
          <path d="M60 46 L60 24" stroke="#a5d6a7" strokeWidth="3" strokeLinecap="round" />
        </g>`))}
      <circle cx="60" cy="52" r="15" fill="#a5d6a7" stroke="#2b2d42" strokeWidth="3" />
      <circle cx="54.5" cy="49" r="2.8" fill="#2b2d42" />
      <circle cx="65.5" cy="49" r="2.8" fill="#2b2d42" />
      <circle cx="55.4" cy="48" r="0.9" fill="#fff" />
      <circle cx="66.4" cy="48" r="0.9" fill="#fff" />
      <circle cx="50.5" cy="55" r="2.6" fill="#ff6b9a" opacity=".6" />
      <circle cx="69.5" cy="55" r="2.6" fill="#ff6b9a" opacity=".6" />
      <path d="M55.5 55 Q60 59.5 64.5 55" stroke="#2b2d42" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>`);
}
export function Mascot({ size = 96, say, className = "" }) {
    return (html`<div className=${`flex items-end gap-3 ${className}`}>
      <${CloverMascot} size=${size} />

      ${say && (html`<div className="relative mb-6 rounded-3xl border-[3px] border-ink bg-paper px-5 py-3 text-lg font-bold shadow-sm motion-safe:animate-pop">
          ${say}
          <span className="absolute -left-3 bottom-4 h-5 w-5 rotate-45 border-b-[3px] border-l-[3px] border-ink bg-paper" />
        </div>`)}
    </div>`);
}
/* ------------------------------ BigButton ----------------------------- */
const COLORS = {
    sun: "bg-sun text-ink [--shadow:#e09b00]",
    sky: "bg-sky text-ink [--shadow:#0277bd]",
    grass: "bg-grass text-ink [--shadow:#2e7d32]",
    berry: "bg-berry text-ink [--shadow:#c2185b]",
    grape: "bg-grape text-white [--shadow:#6a3fb5]",
    orange: "bg-orange text-ink [--shadow:#d9480f]",
    white: "bg-paper text-ink [--shadow:#e3d3ad]",
};
export function BigButton({ color = "sun", size = "md", className = "", children, onClick, ...rest }) {
    const sz = size === "lg" ? "min-h-20 px-8 text-2xl" : size === "sm" ? "min-h-12 px-4 text-lg" : "min-h-16 px-6 text-xl";
    return (html`<button ...${rest} onClick=${(e) => {
        sfx("tap");
        onClick?.(e);
    }} className=${`btn-3d font-display inline-flex items-center justify-center gap-2 rounded-[22px] border-[3px] border-ink font-bold disabled:opacity-50 ${COLORS[color]} ${sz} ${className}`}>
      ${children}
    </button>`);
}
/* ----------------------------- SpeakButton ---------------------------- */
export function SpeakButton({ text, label, slow = false, size = 56, className = "" }) {
    // wait = the voice is being made (shows ⏳ at once, so a tap never feels ignored); on = speaking
    const [state, setState] = useState("idle");
    const run = useRef(0);
    return (html`<button type="button" aria-label=${label ?? `Listen: ${text}`} aria-busy=${state === "wait"} title=${slow ? "Slow" : "Listen"} onClick=${(e) => {
        e.stopPropagation();
        const me = ++run.current; // a second tap replaces the first one's callbacks
        setState("wait");
        speak(text, { slow, onStart: () => run.current === me && setState("on"), onDone: () => run.current === me && setState("idle") });
    }} style=${{ width: size, height: size }} className=${`btn-3d inline-flex shrink-0 items-center justify-center rounded-full border-[3px] border-ink bg-sky text-2xl [--shadow:#0277bd] ${state === "on" ? "motion-safe:animate-wiggle" : ""} ${state === "wait" ? "motion-safe:animate-pulse" : ""} ${className}`}>
      ${state === "wait" ? "⏳" : slow ? "🐢" : "🔊"}
    </button>`);
}
/* ---------------------------- ProgressDots ---------------------------- */
export function ProgressDots({ total, current, results = [] }) {
    return (html`<div className="flex flex-wrap items-center justify-center gap-2" aria-label=${`Question ${current + 1} of ${total}`}>
      ${Array.from({ length: total }, (_, i) => (html`<span key=${i} className=${`h-4 rounded-full border-2 border-ink transition-all ${i === current ? "w-10 bg-sun" : "w-4"} ${results[i] === true ? "bg-grass" : results[i] === false ? "bg-berry" : i === current ? "" : "bg-paper"}`} />`))}
    </div>`);
}
/* ------------------------------ Stars ------------------------------ */
export function StarRow({ stars, max = 3, size = "text-4xl" }) {
    return (html`<div className=${`flex gap-1 ${size}`} aria-label=${`${stars} of ${max} stars`}>
      ${Array.from({ length: max }, (_, i) => (html`<span key=${i} className=${i < stars ? "motion-safe:animate-pop" : "opacity-25 grayscale"} style=${{ animationDelay: `${i * 150}ms` }}>
          ⭐
        </span>`))}
    </div>`);
}
/* ---------------------------- Celebration ---------------------------- */
export function Confetti() {
    const bits = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ left: (i * 37) % 100, delay: (i % 7) * 0.25, emoji: ["⭐", "🎉", "🌟", "🎈", "✨"][i % 5], size: 18 + ((i * 13) % 22) })), []);
    return (html`<div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      ${bits.map((b, i) => (html`<span key=${i} className="absolute motion-safe:animate-rise" style=${{ left: `${b.left}%`, bottom: "-40px", animationDelay: `${b.delay}s`, fontSize: b.size }}>
          ${b.emoji}
        </span>`))}
    </div>`);
}
export function Celebration({ stars, title, newStickers = [], newTrophies = [], level = 0, children, }) {
    const trophy = newTrophies.length > 0;
    useEffect(() => {
        sfx("win");
        const praise = stars >= 3 ? PRAISE.great : stars === 2 ? PRAISE.good : PRAISE.try;
        speak(praise, trophy ? { onEnd: () => setTimeout(() => speak(TROPHY_WON), 200) } : {});
    }, [stars, trophy]);
    const trophyPages = newTrophies.map((id) => ALBUM.findIndex((p) => p.id === id)).filter((k) => k >= 0);
    return (html`<div className="flex flex-col items-center gap-5 py-6 text-center motion-safe:animate-pop">
      ${(stars >= 2 || trophy) && html`<${Confetti} />`}
      <${Mascot} size=${120} />
      <h2 className="text-4xl font-extrabold">${title ?? (stars >= 3 ? "Amazing!" : stars === 2 ? "Well done!" : "Good try!")}</h2>
      <${StarRow} stars=${stars} size="text-6xl" />
      ${newStickers.length > 0 && (html`<div className="rounded-3xl border-[3px] border-ink bg-sun-soft px-6 py-4">
          <p className="text-xl font-bold">New sticker!</p>
          <p className="flex justify-center gap-2 text-6xl motion-safe:animate-wiggle">
            ${newStickers.map((id) => (html`<${StickerArt} key=${id} id=${id} />`))}
          </p>
        </div>`)}
      ${trophyPages.map((k) => (html`<div key=${k} className="flex flex-col items-center gap-2 rounded-3xl border-[3px] border-ink bg-grape-soft px-8 py-4 motion-safe:animate-pop-in">
          <p className="font-display text-2xl font-extrabold">🏆 You won a trophy!</p>
          <${Trophy} page=${ALBUM[k]} level=${k + 1} size=${130} label=${false} className="motion-safe:animate-bob" />
          <p className="font-display text-xl font-bold">
            ${ALBUM[k].title} — Level ${Math.max(level, k + 1)}!
          </p>
        </div>`))}
      ${children}
    </div>`);
}
/* ------------------------------ helpers ------------------------------ */
export function KidCard({ children, className = "" }) {
    return html`<div className=${`rounded-[var(--radius-blob)] border-[3px] border-ink bg-paper p-5 shadow-[0_6px_0_0_#e3d3ad] ${className}`}>${children}</div>`;
}
export function Loading({ text = "Loading…" }) {
    return (html`<div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-ink-soft" role="status">
      <${CloverMascot} size=${64} />
      <span className="font-display text-xl">${text}</span>
    </div>`);
}
export function ErrorBox({ message, onRetry }) {
    return (html`<div role="alert" className="m-4 rounded-3xl border-[3px] border-berry-deep bg-berry-soft p-5 text-ink">
      <p className="font-bold">Oops! ${message}</p>
      ${onRetry && (html`<button className="mt-2 underline" onClick=${onRetry}>
          Try again
        </button>`)}
    </div>`);
}
