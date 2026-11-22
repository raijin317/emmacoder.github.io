import { html, Fragment } from "@/lib/html.js";
import { stickerById, trophyTier } from "@/lib/stickers.js";
const INK = "#2b2d42";
/** One sticker: its emoji, or an original robot drawing. Sized in `em` like an emoji. */
export function StickerArt({ id, className = "" }) {
    const s = stickerById(id);
    if (!s)
        return html`<span className=${className}>⭐</span>`;
    if (s.robot)
        return html`<${RobotArt} look=${s.robot} name=${s.name} className=${className} />`;
    return (html`<span role="img" aria-label=${s.name} className=${className}>
      ${s.emoji}
    </span>`);
}
/** Original robot artwork (flat cartoon, thick outline) from a few simple parts. */
export function RobotArt({ look, name, className = "" }) {
    const { color, accent } = look;
    const line = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" };
    return (html`<svg viewBox="0 0 100 100" role="img" aria-label=${name} className=${`inline-block h-[1.3em] w-[1.3em] align-middle ${className}`}>
      ${look.antenna === "ball" && (html`<${Fragment}>
          <line x1="50" y1="20" x2="50" y2="9" ...${line} />
          <circle cx="50" cy="8" r="4.5" fill=${accent} ...${line} />
        <//>`)}
      ${look.antenna === "bolt" && html`<path d="M52 4 L44 13 L51 13 L46 21" fill="none" ...${line} stroke=${accent} strokeWidth=${4} />`}
      ${look.head === "box" && html`<rect x="26" y="20" width="48" height="32" rx="6" fill=${color} ...${line} />`}
      ${look.head === "round" && html`<ellipse cx="50" cy="36" rx="27" ry="17" fill=${color} ...${line} />`}
      ${look.head === "tv" && (html`<${Fragment}>
          <rect x="16" y="30" width="7" height="12" rx="3" fill=${accent} ...${line} />
          <rect x="77" y="30" width="7" height="12" rx="3" fill=${accent} ...${line} />
          <rect x="22" y="19" width="56" height="34" rx="10" fill=${color} ...${line} />
        <//>`)}
      ${look.eyes === "round" && (html`<${Fragment}>
          <circle cx="40" cy="33" r="6.5" fill="#fff" ...${line} />
          <circle cx="60" cy="33" r="6.5" fill="#fff" ...${line} />
          <circle cx="41" cy="34" r="2.8" fill=${INK} />
          <circle cx="61" cy="34" r="2.8" fill=${INK} />
        <//>`)}
      ${look.eyes === "visor" && (html`<${Fragment}>
          <rect x="31" y="27" width="38" height="11" rx="5.5" fill=${INK} />
          <circle cx="41" cy="32.5" r="2.6" fill=${accent} />
          <circle cx="59" cy="32.5" r="2.6" fill=${accent} />
        <//>`)}
      ${look.eyes === "one" && (html`<${Fragment}>
          <circle cx="50" cy="33" r="9" fill="#fff" ...${line} />
          <circle cx="51" cy="34" r="4" fill=${accent} stroke=${INK} strokeWidth=${1.5} />
        <//>`)}
      ${look.mouth === "smile" && html`<path d="M41 43 Q50 50 59 43" fill="none" ...${line} />`}
      ${look.mouth === "o" && html`<circle cx="50" cy="45" r="3" fill=${INK} />`}
      ${look.mouth === "grill" && (html`<${Fragment}>
          <rect x="39" y="42" width="22" height="6" rx="2" fill="#fff" ...${line} strokeWidth=${2} />
          <path d="M45 42 V48 M50 42 V48 M55 42 V48" ...${line} strokeWidth=${1.5} />
        <//>`)}
      <rect x="45" y="52" width="10" height="5" fill=${accent} ...${line} strokeWidth=${2} />
      <rect x="18" y="60" width="11" height="7" rx="3.5" fill=${color} ...${line} />
      <rect x="71" y="60" width="11" height="7" rx="3.5" fill=${color} ...${line} />
      <rect x="28" y="56" width="44" height="30" rx="7" fill=${color} ...${line} />
      <rect x="39" y="62" width="22" height="11" rx="3" fill=${accent} ...${line} strokeWidth=${2} />
      <circle cx="44" cy="79" r="2.2" fill=${INK} />
      <circle cx="50" cy="79" r="2.2" fill=${INK} />
      <circle cx="56" cy="79" r="2.2" fill=${INK} />
      ${look.wheels ? (html`<${Fragment}>
          <circle cx="38" cy="91" r="6.5" fill=${INK} />
          <circle cx="62" cy="91" r="6.5" fill=${INK} />
          <circle cx="38" cy="91" r="2.2" fill="#fff" />
          <circle cx="62" cy="91" r="2.2" fill="#fff" />
        <//>`) : (html`<${Fragment}>
          <rect x="35" y="86" width="9" height="9" rx="2" fill=${accent} ...${line} strokeWidth=${2} />
          <rect x="56" y="86" width="9" height="9" rx="2" fill=${accent} ...${line} strokeWidth=${2} />
        <//>`)}
    </svg>`);
}
const METAL = {
    bronze: { light: "#f0b27a", dark: "#b0652b" },
    silver: { light: "#f1f5f8", dark: "#90a4ae" },
    gold: { light: "#ffe58a", dark: "#e09b00" },
};
/** A trophy cup for a finished sticker page, with the page's picture and the level it marks. */
export function Trophy({ page, level, size = 96, label = true, className = "" }) {
    const m = METAL[trophyTier(level)];
    const gid = `cup-${page.id}`;
    return (html`<div className=${`inline-flex flex-col items-center ${className}`} title=${`${page.title} — Level ${level}`}>
      <div className="relative" style=${{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width=${size} height=${size} role="img" aria-label=${`Trophy: ${page.title}, level ${level}`}>
          <defs>
            <linearGradient id=${gid} x1="0" x2="1">
              <stop offset="0" stopColor=${m.light} />
              <stop offset="1" stopColor=${m.dark} />
            </linearGradient>
          </defs>
          <path d="M24 16 C8 16 8 42 30 44" fill="none" stroke=${INK} strokeWidth="6" strokeLinecap="round" />
          <path d="M24 16 C8 16 8 42 30 44" fill="none" stroke=${m.dark} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M76 16 C92 16 92 42 70 44" fill="none" stroke=${INK} strokeWidth="6" strokeLinecap="round" />
          <path d="M76 16 C92 16 92 42 70 44" fill="none" stroke=${m.dark} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M22 10 H78 V30 C78 50 64 60 50 60 C36 60 22 50 22 30 Z" fill=${`url(#${gid})`} stroke=${INK} strokeWidth="3" strokeLinejoin="round" />
          <rect x="44" y="60" width="12" height="12" fill=${m.dark} stroke=${INK} strokeWidth="3" />
          <rect x="30" y="72" width="40" height="8" rx="3" fill=${`url(#${gid})`} stroke=${INK} strokeWidth="3" />
          <rect x="24" y="80" width="52" height="12" rx="3" fill="#6d4c41" stroke=${INK} strokeWidth="3" />
          <path d="M30 16 C30 30 34 40 40 46" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".6" />
        </svg>
        <span className="absolute left-1/2 -translate-x-1/2 leading-none" style=${{ top: size * 0.17, fontSize: size * 0.26 }} aria-hidden>
          ${page.icon}
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 font-display font-extrabold leading-none text-white" style=${{ top: size * 0.81, fontSize: size * 0.12 }} aria-hidden>
          ${level}
        </span>
      </div>
      ${label && html`<span className="mt-1 text-center font-display text-sm font-bold leading-tight">Level ${level}</span>`}
    </div>`);
}
