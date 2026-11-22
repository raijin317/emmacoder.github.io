import { html, Fragment } from "@/lib/html.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProgressDots, SpeakButton } from "@/components/kids/index.js";
import { speak } from "@/lib/client/speech.js";
import { sfx } from "@/lib/client/sfx.js";
import { Pic } from "@/components/Pic.js";
import { GAME_LINES, GAME_SAY } from "@/lib/games.js";
import { AnswerFeedback, HINT_AFTER, sayTryAgain, shuffleOnce } from "./quiz.js";
import { Burst, FUN_COLORS, canRead, scoreRound, useRounds, useSayOnChange, useTimers, withOthers } from "./gameKit.js";
const START = { score: 0, missed: [] };
const css = (o) => o;
/* ================================ Go fishing ================================ */
/** Where the fish swim (a fallback place when motion is reduced). */
const LANES = [
    { top: 7, left: 8 },
    { top: 30, left: 56 },
    { top: 53, left: 26 },
    { top: 75, left: 66 },
];
function FishBody({ color, flip }) {
    return (html`<svg viewBox="0 0 170 104" aria-hidden className="h-[84px] w-[138px] md:h-[98px] md:w-[160px]" style=${{ transform: flip ? "scaleX(-1)" : undefined }}>
      <g className="tail">
        <path d="M36 52 L4 18 Q16 52 4 86 Z" fill=${color} stroke="#2b2d42" strokeWidth="4" strokeLinejoin="round" />
      </g>
      <path d="M82 18 Q98 0 120 18" fill=${color} stroke="#2b2d42" strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="98" cy="54" rx="64" ry="38" fill=${color} stroke="#2b2d42" strokeWidth="4" />
      <path d="M100 76 Q112 96 126 80" fill=${color} stroke="#2b2d42" strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="142" cy="44" r="8.5" fill="#fff" stroke="#2b2d42" strokeWidth="3" />
      <circle cx="144" cy="44" r="3.8" fill="#2b2d42" />
      <path d="M147 64 Q153 67 158 61" stroke="#2b2d42" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>`);
}
function PondDecor() {
    return (html`<${Fragment}>
      <div aria-hidden className="absolute inset-x-0 top-0 h-7 overflow-hidden">
        <div className="wave-x flex h-7 w-[200%]">
          ${[0, 1].map((k) => (html`<svg key=${k} viewBox="0 0 200 20" preserveAspectRatio="none" className="h-7 w-1/2">
              <path d="M0 8 Q12.5 18 25 8 T50 8 T75 8 T100 8 T125 8 T150 8 T175 8 T200 8 V0 H0 Z" fill="#dff4fd" />
            </svg>`))}
        </div>
      </div>
      ${[7, 20, 41, 60, 79, 91].map((x, k) => (html`<span key=${k} aria-hidden className="bubble absolute bottom-8 h-4 w-4 rounded-full border-2 border-white/80 bg-white/25" style=${css({ left: `${x}%`, "--dur": `${4 + (k % 3)}s`, "--delay": `${-k * 0.9}s` })} />`))}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-9 rounded-t-[50%] bg-[#f6d38b]" />
      ${[5, 22, 80, 93].map((x, k) => (html`<svg key=${k} aria-hidden viewBox="0 0 30 90" className="sway absolute bottom-3 h-[84px] w-7" style=${css({ left: `${x}%`, "--dur": `${2.6 + k * 0.5}s` })}>
          <path d="M15 90 C2 68 28 50 14 30 C6 18 20 8 15 0" stroke=${k % 2 ? "#2e7d32" : "#66bb6a"} strokeWidth="8" fill="none" strokeLinecap="round" />
        </svg>`))}
    <//>`);
}
export function FishingGame({ data, onDone, seed }) {
    const rounds = useRounds(data.words, seed, 6);
    const timers = useTimers();
    const [r, setR] = useState(0);
    const [caught, setCaught] = useState(null);
    const [out, setOut] = useState([]);
    const [wrong, setWrong] = useState(null);
    const [misses, setMisses] = useState(0);
    const [tally, setTally] = useState(START);
    const [bucket, setBucket] = useState([]);
    const target = rounds[r];
    const say = GAME_SAY.fishing(target.word);
    const fish = useMemo(() => withOthers(data.words, target, 3, seed + r), [data.words, target, seed, r]);
    useSayOnChange(say);
    const hint = misses >= HINT_AFTER;
    const tap = (w) => {
        if (caught || out.includes(w.word))
            return;
        if (w.word !== target.word) {
            setMisses((m) => m + 1);
            setOut((o) => [...o, w.word]);
            setWrong(w.word);
            timers.after(650, () => setWrong(null));
            sayTryAgain(say);
            return;
        }
        const t = scoreRound(tally, target.word, misses);
        setTally(t);
        setCaught({ word: w.word, reel: false });
        sfx("splash");
        timers.after(480, () => {
            setCaught({ word: w.word, reel: true });
            sfx("whoosh");
            speak(target.word);
        });
        timers.after(1500, () => {
            setBucket((b) => [...b, target]);
            sfx("pop");
            if (r + 1 >= rounds.length) {
                speak(GAME_LINES.fishingDone);
                timers.after(1600, () => onDone({ score: t.score, max: rounds.length, missed: t.missed }));
            }
            else {
                setR(r + 1);
                setCaught(null);
                setMisses(0);
                setOut([]);
            }
        });
    };
    return (html`<div className="flex flex-col items-center gap-4">
      <${ProgressDots} total=${rounds.length} current=${r} />
      <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <${SpeakButton} text=${say} size=${64} />
          <p className="font-display text-2xl font-bold md:text-3xl">Listen and catch! 🎣</p>
        </div>
        <div className="flex items-end gap-1 rounded-2xl border-[3px] border-ink bg-paper px-3 py-1" aria-label=${`${bucket.length} fish caught`}>
          <span className="text-4xl">🪣</span>
          <span key=${bucket.length} className="flex text-2xl motion-safe:animate-pop">
            ${bucket.map((w) => (html`<${Pic} key=${w.word} emoji=${w.emoji} word=${w.word} scale=${1} />`))}
          </span>
        </div>
      </div>
      <div className="relative h-[380px] w-full max-w-3xl overflow-hidden rounded-[36px] border-4 border-ink bg-gradient-to-b from-[#8fdcfa] via-[#3fa9e0] to-[#1f6fb5]" data-testid="pond">
        <${PondDecor} />
        ${fish.map((w, k) => {
        const dir = k % 2 ? "l" : "r";
        const dur = 15 + ((k * 2.7) % 5);
        // Start every fish somewhere inside the pond (not off at the edge).
        const startAt = [0.3, 0.5, 0.45, 0.68][k] ?? 0.4;
        const isCaught = caught?.word === w.word;
        const isHint = hint && w.word === target.word && !caught;
        const gone = out.includes(w.word);
        return (html`<button key=${`${r}-${w.word}`} type="button" aria-label=${w.word} disabled=${gone || !!caught} onClick=${() => tap(w)} className=${`absolute z-10 ${dir === "r" ? "swim-r" : "swim-l"} ${isCaught || isHint ? "paused" : ""}`} style=${css({ top: `${LANES[k].top}%`, left: `${LANES[k].left}%`, "--dur": `${dur}s`, "--delay": `${-(startAt * dur).toFixed(2)}s` })}>
              <span className=${`relative block transition-transform duration-[900ms] ease-in ${isCaught && caught?.reel ? "-translate-y-[440px] -rotate-12" : ""} ${wrong === w.word ? "shake-no" : ""}`}>
                <span aria-hidden className=${`line-drop absolute bottom-1/2 h-[440px] w-[3px] bg-ink ${isCaught ? "on" : ""}`} style=${{ left: dir === "r" ? "54%" : "46%" }} />
                <span className=${gone ? "block opacity-40 grayscale" : "block"}>
                  <${FishBody} color=${FUN_COLORS[(k + r) % FUN_COLORS.length]} flip=${dir === "l"} />
                </span>
                <span className=${`absolute top-1/2 flex h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-[3px] border-ink bg-white text-4xl md:h-[66px] md:w-[66px] ${isHint ? "ring-4 ring-sun motion-safe:animate-glow" : ""}`} style=${{ left: dir === "r" ? "54%" : "46%" }}>
                  <${Pic} emoji=${w.emoji} word=${w.word} />
                </span>
                ${gone && (html`<span aria-hidden className="absolute -right-1 -top-2 text-3xl">
                    ❌
                  </span>`)}
                ${isCaught && html`<${Burst} x="50%" y="40%" bits=${["💦", "✨", "💧", "⭐", "💦", "✨"]} size=${26} spread=${70} />`}
              </span>
            </button>`);
    })}
      </div>
      <${AnswerFeedback} misses=${misses} solved=${!!caught} hint="The fish that stopped is the one! ✨" />
    </div>`);
}
/** Munchy: a friendly purple monster (original artwork). */
function Munchy({ mood, size = 200 }) {
    const ink = "#2b2d42";
    return (html`<svg viewBox="0 0 220 210" width=${size} height=${(size * 210) / 220} role="img" aria-label="Munchy the hungry monster" className=${mood === "chomp" ? "chomp" : mood === "no" ? "shake-no" : "breathe"}>
      <path d="M84 40 Q70 12 56 14" stroke=${ink} strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="54" cy="14" r="10" fill="#ffc83d" stroke=${ink} strokeWidth="4" />
      <path d="M136 40 Q150 12 164 14" stroke=${ink} strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="166" cy="14" r="10" fill="#ffc83d" stroke=${ink} strokeWidth="4" />
      <ellipse cx="76" cy="196" rx="28" ry="11" fill="#6a3fb5" stroke=${ink} strokeWidth="4" />
      <ellipse cx="144" cy="196" rx="28" ry="11" fill="#6a3fb5" stroke=${ink} strokeWidth="4" />
      <path d="M26 128 Q4 118 10 96" stroke=${ink} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M194 128 Q216 118 210 96" stroke=${ink} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M110 30 C168 30 200 72 200 122 C200 168 162 194 110 194 C58 194 20 168 20 122 C20 72 52 30 110 30 Z" fill="#9c6ade" stroke=${ink} strokeWidth="5" />
      <circle cx="50" cy="98" r="9" fill="#b892ea" />
      <circle cx="174" cy="142" r="11" fill="#b892ea" />
      <circle cx="162" cy="66" r="6" fill="#b892ea" />
      ${mood === "chomp" ? (html`<${Fragment}>
          <path d="M64 88 Q82 72 100 88" stroke=${ink} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M120 88 Q138 72 156 88" stroke=${ink} strokeWidth="5" fill="none" strokeLinecap="round" />
        <//>`) : (html`<${Fragment}>
          <g className="blink">
            <circle cx="82" cy="86" r="22" fill="#fff" stroke=${ink} strokeWidth="4" />
            <circle cx="138" cy="86" r="22" fill="#fff" stroke=${ink} strokeWidth="4" />
          </g>
          <circle cx=${mood === "no" ? 82 : 86} cy=${mood === "no" ? 86 : 95} r="9" fill=${ink} />
          <circle cx=${mood === "no" ? 138 : 142} cy=${mood === "no" ? 86 : 95} r="9" fill=${ink} />
          <circle cx=${mood === "no" ? 85 : 89} cy=${mood === "no" ? 82 : 91} r="3" fill="#fff" />
          <circle cx=${mood === "no" ? 141 : 145} cy=${mood === "no" ? 82 : 91} r="3" fill="#fff" />
        <//>`)}
      <ellipse cx="58" cy="126" rx=${mood === "chomp" ? 15 : 11} ry=${mood === "chomp" ? 10 : 7} fill="#ff6b9a" opacity=".6" />
      <ellipse cx="162" cy="126" rx=${mood === "chomp" ? 15 : 11} ry=${mood === "chomp" ? 10 : 7} fill="#ff6b9a" opacity=".6" />
      ${mood === "open" && (html`<${Fragment}>
          <ellipse cx="110" cy="138" rx="40" ry="30" fill="#7a1035" stroke=${ink} strokeWidth="5" />
          <ellipse cx="110" cy="154" rx="22" ry="9" fill="#ff6b9a" />
          <path d="M92 110 L98 122 L104 110 Z" fill="#fff" stroke=${ink} strokeWidth="2" />
          <path d="M116 110 L122 122 L128 110 Z" fill="#fff" stroke=${ink} strokeWidth="2" />
        <//>`)}
      ${mood === "idle" && (html`<${Fragment}>
          <path d="M78 126 Q110 160 142 126 Q110 137 78 126 Z" fill="#7a1035" stroke=${ink} strokeWidth="4" strokeLinejoin="round" />
          <path d="M98 131 L104 141 L110 132 Z" fill="#fff" />
        <//>`)}
      ${mood === "chomp" && html`<path d="M80 134 Q110 152 140 134" stroke=${ink} strokeWidth="5" fill="none" strokeLinecap="round" />`}
      ${mood === "no" && html`<path d="M84 144 Q110 126 136 144" stroke=${ink} strokeWidth="5" fill="none" strokeLinecap="round" />`}
    </svg>`);
}
export function FeedGame({ data, onDone, seed, stage }) {
    const rounds = useRounds(data.words, seed, 6);
    const timers = useTimers();
    const [r, setR] = useState(0);
    const [mood, setMood] = useState("idle");
    const [flying, setFlying] = useState(null);
    const [eaten, setEaten] = useState(null);
    const [out, setOut] = useState([]);
    const [misses, setMisses] = useState(0);
    const [tally, setTally] = useState(START);
    const [drag, setDrag] = useState(null);
    const mouth = useRef(null);
    const munchy = useRef(null);
    const press = useRef(null);
    const target = rounds[r];
    const say = GAME_SAY.feed(target.word);
    const plates = useMemo(() => withOthers(data.words, target, 3, seed + r), [data.words, target, seed, r]);
    useSayOnChange(say);
    const busy = !!flying || !!eaten;
    const give = (w, el, offset = { x: 0, y: 0 }) => {
        if (busy || out.includes(w.word))
            return;
        if (w.word !== target.word) {
            setDrag(null);
            setMood("no");
            setMisses((m) => m + 1);
            setOut((o) => [...o, w.word]);
            sayTryAgain(say);
            timers.after(700, () => setMood("idle"));
            return;
        }
        const m = mouth.current?.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        const dx = m ? m.left + m.width / 2 - (b.left + b.width / 2 - offset.x) : 0;
        const dy = m ? m.top + m.height / 2 - (b.top + b.height / 2 - offset.y) : -200;
        const t = scoreRound(tally, target.word, misses);
        setTally(t);
        setFlying({ word: w.word, dx, dy });
        setMood("open");
        sfx("whoosh");
        timers.after(650, () => {
            setEaten(w.word);
            setFlying(null);
            setDrag(null);
            setMood("chomp");
            sfx("chomp");
            speak(GAME_LINES.feedThanks);
        });
        timers.after(2100, () => {
            if (r + 1 >= rounds.length)
                onDone({ score: t.score, max: rounds.length, missed: t.missed });
            else {
                setR(r + 1);
                setEaten(null);
                setMood("idle");
                setMisses(0);
                setOut([]);
            }
        });
    };
    const down = (w) => (e) => {
        if (busy || out.includes(w.word))
            return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        press.current = { word: w.word, x: e.clientX, y: e.clientY, moved: false };
    };
    const move = (w) => (e) => {
        const p = press.current;
        if (!p || p.word !== w.word)
            return;
        const x = e.clientX - p.x;
        const y = e.clientY - p.y;
        if (!p.moved && Math.hypot(x, y) < 10)
            return;
        p.moved = true;
        setDrag({ word: w.word, x, y });
    };
    const up = (w) => (e) => {
        const p = press.current;
        press.current = null;
        if (!p || p.word !== w.word)
            return;
        if (!p.moved)
            return give(w, e.currentTarget);
        const box = munchy.current?.getBoundingClientRect();
        const over = !!box && e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
        if (over)
            give(w, e.currentTarget, { x: e.clientX - p.x, y: e.clientY - p.y });
        else
            setDrag(null); // back to the table
    };
    return (html`<div className="flex flex-col items-center gap-4">
      <${ProgressDots} total=${rounds.length} current=${r} />
      <div className="relative flex w-full max-w-3xl flex-col items-center rounded-[36px] border-4 border-ink bg-gradient-to-b from-sun-soft to-orange-soft px-3 pb-5 pt-3">
        <div className="flex flex-wrap items-end justify-center gap-2">
          <div ref=${munchy} className="relative">
            <${Munchy} mood=${mood} size=${190} />
            <span ref=${mouth} aria-hidden className="absolute left-1/2 top-[64%] h-4 w-4 -translate-x-1/2" />
            ${eaten && (html`<span key=${r} aria-hidden className="pointer-events-none absolute inset-x-0 top-6 flex justify-center gap-4 text-3xl">
                ${["💖", "💛", "💜"].map((h, k) => (html`<span key=${k} className="float-up" style=${{ animationDelay: `${k * 0.15}s` }}>
                    ${h}
                  </span>`))}
              </span>`)}
          </div>
          <div className="relative mb-20 flex max-w-[260px] items-center gap-2 rounded-3xl border-[3px] border-ink bg-paper px-3 py-2 shadow-sm motion-safe:animate-pop" key=${r}>
            <${SpeakButton} text=${say} size=${50} />
            <p className="font-display text-xl font-bold leading-tight">${eaten ? GAME_LINES.feedThanks : canRead(stage) ? say : "I'm hungry! 😋"}</p>
            <span className="absolute -left-3 bottom-4 h-5 w-5 rotate-45 border-b-[3px] border-l-[3px] border-ink bg-paper" />
          </div>
        </div>
        <div aria-hidden className="mb-4 h-4 w-full rounded-full border-[3px] border-ink bg-[#c8875a]" />
        <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
          ${plates.map((w) => {
        const gone = out.includes(w.word);
        const isFlying = flying?.word === w.word;
        const dragging = drag?.word === w.word;
        const hint = misses >= HINT_AFTER && w.word === target.word && !busy;
        if (eaten === w.word)
            return html`<span key=${w.word} className="aspect-square rounded-full border-4 border-dashed border-ink/30" />`;
        return (html`<button key=${`${r}-${w.word}`} type="button" aria-label=${w.word} disabled=${gone || busy} onPointerDown=${down(w)} onPointerMove=${move(w)} onPointerUp=${up(w)} onPointerCancel=${() => {
            press.current = null;
            setDrag(null);
        }} onClick=${(e) => e.detail === 0 && give(w, e.currentTarget)} className=${`relative flex aspect-square touch-none select-none items-center justify-center rounded-full border-4 border-ink bg-paper text-6xl shadow-[0_6px_0_0_#d9480f] ${gone ? "opacity-40 grayscale" : ""} ${isFlying ? "fly-to" : dragging ? "z-30 scale-110 cursor-grabbing" : "cursor-grab transition-transform duration-300 hover:-translate-y-1"} ${hint ? "ring-4 ring-sun-deep motion-safe:animate-glow" : ""}`} style=${css({
            transform: dragging || isFlying ? `translate(${drag?.x ?? 0}px, ${drag?.y ?? 0}px)` : undefined,
            "--dx": `${flying?.dx ?? 0}px`,
            "--dy": `${flying?.dy ?? 0}px`,
        })}>
                <span className="pointer-events-none flex h-[78%] w-[78%] items-center justify-center overflow-hidden rounded-full bg-white">
                  <${Pic} emoji=${w.emoji} word=${w.word} scale=${1.25} />
                </span>
                ${gone && (html`<span aria-hidden className="absolute -right-1 -top-1 text-3xl">
                    ❌
                  </span>`)}
              </button>`);
    })}
        </div>
      </div>
      <${AnswerFeedback} misses=${misses} solved=${!!eaten} hint="Give Munchy the glowing one! ✨" />
      <p className="text-sm font-bold text-ink-soft">Tap a picture — or drag it to Munchy!</p>
    </div>`);
}
/* ================================== I spy ================================== */
const SPY_BG = ["bg-berry", "bg-sky", "bg-sun", "bg-grass"];
export function SpyGame({ data, onDone, seed, stage }) {
    const rounds = useRounds(data.words, seed, 6);
    const timers = useTimers();
    const [r, setR] = useState(0);
    const [open, setOpen] = useState([]);
    const [solved, setSolved] = useState(false);
    const [misses, setMisses] = useState(0);
    const [tally, setTally] = useState(START);
    const target = rounds[r];
    const say = GAME_SAY.spy(target.word);
    const cards = useMemo(() => withOthers(data.words, target, 3, seed + r), [data.words, target, seed, r]);
    useSayOnChange(say);
    const tap = (w) => {
        if (solved || open.includes(w.word))
            return;
        setOpen((o) => [...o, w.word]);
        if (w.word !== target.word) {
            setMisses((m) => m + 1);
            sayTryAgain(say);
            return;
        }
        const t = scoreRound(tally, target.word, misses);
        setTally(t);
        setSolved(true);
        sfx("sparkle");
        speak(target.word);
        timers.after(1800, () => {
            if (r + 1 >= rounds.length)
                onDone({ score: t.score, max: rounds.length, missed: t.missed });
            else {
                setR(r + 1);
                setOpen([]);
                setSolved(false);
                setMisses(0);
            }
        });
    };
    return (html`<div className="flex flex-col items-center gap-5">
      <${ProgressDots} total=${rounds.length} current=${r} />
      <div className="flex items-center gap-3">
        <${SpeakButton} text=${say} size=${64} />
        <p className="font-display text-2xl font-bold md:text-3xl">🔍 ${canRead(stage) ? say : "What can you spy?"}</p>
      </div>
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        ${cards.map((w, k) => {
        const shown = open.includes(w.word);
        const right = shown && w.word === target.word;
        const hint = !shown && misses >= HINT_AFTER && w.word === target.word;
        const v = ["a", "b", "c"][(k + r) % 3];
        const delay = `${-(k * 1.7 + r)}s`;
        return (html`<button key=${`${r}-${w.word}`} type="button" aria-label=${shown ? w.word : `Hidden picture ${k + 1}`} disabled=${shown || solved} onClick=${() => tap(w)} className=${`relative aspect-square overflow-hidden rounded-[30px] border-4 border-ink ${SPY_BG[k % SPY_BG.length]} shadow-[0_6px_0_0_#2b2d42] motion-safe:animate-pop-in ${hint ? "ring-4 ring-sun-deep motion-safe:animate-glow" : ""} ${right ? "hop" : ""}`} style=${{ animationDelay: `${k * 80}ms` }}>
              <span aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,.22)_0_12px,transparent_12px_24px)]" />
              <span className=${`absolute inset-3 flex items-center justify-center rounded-[22px] bg-white text-[5.5rem] md:text-[6.5rem] ${shown || hint ? "" : `spy-${v}`}`} style=${css({
            clipPath: shown ? "circle(75% at 50% 50%)" : hint ? "circle(34% at 50% 50%)" : "circle(21% at 50% 50%)",
            transition: "clip-path 0.7s ease-out",
            "--delay": delay,
        })}>
                <${Pic} emoji=${w.emoji} word=${w.word} scale=${1.2} />
              </span>
              ${!shown && (html`<span aria-hidden className=${`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[7px] border-ink shadow-[inset_0_0_0_4px_rgba(255,255,255,.85)] ${hint ? "h-[72%] w-[72%]" : `rim-${v} h-[46%] w-[46%]`}`} style=${css({ left: "50%", top: "50%", "--delay": delay })}>
                  <span className="absolute -bottom-6 -right-4 h-9 w-3.5 -rotate-45 rounded-full border-2 border-ink bg-orange-deep" />
                </span>`)}
              ${shown && !right && (html`<span aria-hidden className="absolute right-2 top-2 text-4xl">
                  ❌
                </span>`)}
              ${right && (html`<${Fragment}>
                  <${Burst} />
                  ${canRead(stage) && html`<span className="absolute inset-x-2 bottom-2 rounded-xl border-2 border-ink bg-paper font-display text-xl font-extrabold motion-safe:animate-pop">${w.word}</span>`}
                <//>`)}
            </button>`);
    })}
      </div>
      <${AnswerFeedback} misses=${misses} solved=${solved} hint="Look at the glowing one — the glass is bigger! ✨" />
    </div>`);
}
const CRITTER = ["#c98a55", "#b0bec5", "#ffb74d", "#a1887f", "#f48fb1", "#90caf9"];
function Critter({ w, color }) {
    return (html`<span className="relative flex w-[112px] flex-col items-center">
      <svg viewBox="0 0 116 60" aria-hidden className="-mb-4 h-[50px] w-[98px]">
        <circle cx="26" cy="22" r="13" fill=${color} stroke="#2b2d42" strokeWidth="4" />
        <circle cx="26" cy="22" r="6" fill="#ffc1d3" />
        <circle cx="90" cy="22" r="13" fill=${color} stroke="#2b2d42" strokeWidth="4" />
        <circle cx="90" cy="22" r="6" fill="#ffc1d3" />
        <ellipse cx="58" cy="42" rx="44" ry="30" fill=${color} stroke="#2b2d42" strokeWidth="4" />
        <circle cx="42" cy="36" r="5" fill="#2b2d42" />
        <circle cx="74" cy="36" r="5" fill="#2b2d42" />
        <circle cx="43.6" cy="34.4" r="1.7" fill="#fff" />
        <circle cx="75.6" cy="34.4" r="1.7" fill="#fff" />
        <ellipse cx="58" cy="47" rx="7" ry="5" fill="#ff6b9a" stroke="#2b2d42" strokeWidth="2.5" />
      </svg>
      <span className="relative flex h-[92px] w-[104px] items-center justify-center rounded-b-[18px] rounded-t-[52px] border-4 border-ink" style=${{ background: color }}>
        <span className="flex h-[74px] w-[74px] items-center justify-center overflow-hidden rounded-full border-[3px] border-ink bg-white text-5xl">
          <${Pic} emoji=${w.emoji} word=${w.word} />
        </span>
      </span>
    </span>`);
}
function rng(seed) {
    let h = 2166136261;
    for (const c of seed)
        h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
        h = Math.imul(h ^ (h >>> 15), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
}
export function PopupGame({ data, onDone, seed, stage }) {
    const rounds = useRounds(data.words, seed, 5);
    const timers = useTimers();
    const young = !canRead(stage);
    const [r, setR] = useState(0);
    const [holes, setHoles] = useState(() => Array(6).fill(null));
    const [solved, setSolved] = useState(false);
    const [misses, setMisses] = useState(0);
    const [tally, setTally] = useState(START);
    const target = rounds[r];
    const say = GAME_SAY.popup(target.word);
    useSayOnChange(say, 300);
    const live = useRef({ holes, misses, target, solved, since: 1, id: 0, rand: rng(seed) });
    useEffect(() => {
        Object.assign(live.current, { holes, misses, target, solved });
    });
    // Pictures pop up one after another; the right one comes at least every third pop.
    useEffect(() => {
        if (solved)
            return;
        const L = live.current;
        L.since = 1;
        const tick = () => {
            const cur = L.holes;
            if (L.solved || cur.filter(Boolean).length >= 2)
                return;
            const free = cur.flatMap((h, k) => (h ? [] : [k]));
            const k = free[Math.floor(L.rand() * free.length)];
            const hinted = L.misses >= HINT_AFTER;
            const showTarget = L.since >= 2 || L.rand() < (hinted ? 0.7 : 0.4);
            const others = data.words.filter((w) => w.word !== L.target.word && !cur.some((h) => h?.w.word === w.word));
            const w = showTarget || !others.length ? L.target : others[Math.floor(L.rand() * others.length)];
            L.since = w.word === L.target.word ? 0 : L.since + 1;
            const id = ++L.id;
            const next = cur.map((h, i) => (i === k ? { w, id, state: "up" } : h));
            L.holes = next;
            setHoles(next);
            const stay = (young ? 2600 : 2000) + (hinted && w.word === L.target.word ? 1800 : 0);
            setTimeout(() => {
                const now = L.holes;
                if (now[k]?.id !== id || now[k]?.state !== "up")
                    return;
                const after = now.map((h, i) => (i === k ? null : h));
                L.holes = after;
                setHoles(after);
            }, stay);
        };
        const first = setTimeout(tick, 700);
        const every = setInterval(tick, young ? 1150 : 900);
        return () => {
            clearTimeout(first);
            clearInterval(every);
        };
    }, [r, solved, young, data.words]);
    const tap = (k) => {
        const h = holes[k];
        if (!h || h.state !== "up" || solved)
            return;
        if (h.w.word !== target.word) {
            sfx("wrong");
            setMisses((m) => m + 1);
            const next = holes.map((x, i) => (i === k ? { ...h, state: "miss" } : x));
            live.current.holes = next;
            setHoles(next);
            if (misses % 2 === 0)
                sayTryAgain(say);
            timers.after(450, () => {
                const after = live.current.holes.map((x, i) => (i === k && x?.id === h.id ? null : x));
                live.current.holes = after;
                setHoles(after);
            });
            return;
        }
        const t = scoreRound(tally, target.word, misses);
        setTally(t);
        setSolved(true);
        sfx("boing");
        speak(target.word);
        const next = holes.map((x, i) => (i === k ? { ...h, state: "hit" } : x));
        live.current.holes = next;
        setHoles(next);
        timers.after(1500, () => {
            if (r + 1 >= rounds.length)
                return onDone({ score: t.score, max: rounds.length, missed: t.missed });
            const empty = Array(6).fill(null);
            live.current.holes = empty;
            setHoles(empty);
            setR(r + 1);
            setSolved(false);
            setMisses(0);
        });
    };
    return (html`<div className="flex flex-col items-center gap-4">
      <${ProgressDots} total=${rounds.length} current=${r} />
      <div className="flex items-center gap-3">
        <${SpeakButton} text=${say} size=${64} />
        <p className="font-display text-2xl font-bold md:text-3xl">${canRead(stage) ? say : "Tap it when it pops up!"}</p>
      </div>
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[36px] border-4 border-ink bg-gradient-to-b from-[#c8ecff] via-[#e3f4e4] to-[#8bd18f] px-3 pb-3 pt-6">
        <span aria-hidden className="cloud-drift absolute top-2 text-5xl opacity-90" style=${css({ "--dur": "38s", "--delay": "-12s" })}>
          ☁️
        </span>
        <span aria-hidden className="absolute right-6 top-3 text-5xl motion-safe:animate-float">
          🌼
        </span>
        <div className="grid grid-cols-3 gap-x-2 gap-y-1">
          ${holes.map((h, k) => {
        const isUp = !!h && h.state !== "miss";
        const glow = h && h.state === "up" && misses >= HINT_AFTER && h.w.word === target.word;
        return (html`<div key=${k} className="relative h-[168px]">
                <div aria-hidden className="absolute inset-x-[10%] bottom-3 h-9 rounded-[50%] border-[3px] border-ink/60 bg-[#5d3a1a]" />
                <div className="absolute inset-x-0 bottom-7 top-0 overflow-hidden">
                  <button type="button" aria-label=${h ? h.w.word : `Hole ${k + 1}`} disabled=${!h || h.state !== "up" || solved} onClick=${() => tap(k)} className=${`absolute bottom-0 left-1/2 transition-transform duration-300 ease-[cubic-bezier(.3,1.6,.5,1)] ${glow ? "rounded-[40px] ring-4 ring-sun-deep motion-safe:animate-glow" : ""}`} style=${{ transform: `translate(-50%, ${isUp ? "0%" : "110%"})` }}>
                    ${h && (html`<span className=${`block ${h.state === "hit" ? "spin-jump" : ""}`}>
                        <${Critter} w=${h.w} color=${CRITTER[(k + h.id) % CRITTER.length]} />
                      </span>`)}
                  </button>
                </div>
                ${h?.state === "hit" && html`<${Burst} x="50%" y="40%" />`}
                ${h?.state === "miss" && (html`<span aria-hidden className="absolute left-1/2 top-6 -translate-x-1/2 text-4xl motion-safe:animate-pop">
                    ❌
                  </span>`)}
                <div aria-hidden className="absolute inset-x-[2%] bottom-0 h-8 rounded-[50%] border-[3px] border-ink bg-grass" />
              </div>`);
    })}
        </div>
      </div>
      <${AnswerFeedback} misses=${misses} solved=${solved} hint="The glowing friend is the one! ✨" />
    </div>`);
}
/* ============================== Copy the parrot ============================== */
function Parrot({ talking, happy }) {
    const ink = "#2b2d42";
    return (html`<svg viewBox="0 0 160 170" width=${130} height=${138} role="img" aria-label="Pip the parrot" className=${happy ? "hop" : "motion-safe:animate-float"}>
      <path d="M4 152 H156" stroke="#8d5a35" strokeWidth="10" strokeLinecap="round" />
      <path d="M68 124 L50 168 L80 150 L98 168 L90 120 Z" fill="#4fc3f7" stroke=${ink} strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="82" cy="98" rx="40" ry="48" fill="#66bb6a" stroke=${ink} strokeWidth="4" />
      <ellipse cx="90" cy="110" rx="21" ry="30" fill="#c5e8c7" />
      <g className=${talking ? "talk" : ""}>
        <path d="M50 84 Q34 118 66 138 Q76 108 64 84 Z" fill="#2e7d32" stroke=${ink} strokeWidth="3.5" strokeLinejoin="round" />
      </g>
      <path d="M84 22 Q88 0 100 18 Q108 0 112 24" fill="#ffc83d" stroke=${ink} strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="96" cy="52" r="32" fill="#ef5350" stroke=${ink} strokeWidth="4" />
      <circle cx="104" cy="46" r="10" fill="#fff" stroke=${ink} strokeWidth="3" />
      <circle cx="106.5" cy="46" r="4.6" fill=${ink} />
      <circle cx="108" cy="44" r="1.5" fill="#fff" />
      <path d="M120 52 Q144 54 138 76 Q129 65 118 64 Z" fill="#ffc83d" stroke=${ink} strokeWidth="3.5" strokeLinejoin="round" />
      <g className=${talking ? "talk" : ""}>
        <path d="M118 66 Q131 68 133 77 Q122 81 116 72 Z" fill="#e09b00" stroke=${ink} strokeWidth="3" strokeLinejoin="round" />
      </g>
      <path d="M76 144 v10 M92 144 v10" stroke="#e09b00" strokeWidth="6" strokeLinecap="round" />
    </svg>`);
}
export function EchoGame({ data, onDone, seed, stage }) {
    const tiles = useMemo(() => shuffleOnce(data.words, seed).slice(0, 6), [data.words, seed]);
    const seqs = useMemo(() => {
        const lengths = canRead(stage) && tiles.length >= 4 ? [2, 2, 3, 3] : [2, 2, 3];
        return lengths.map((n, k) => shuffleOnce(tiles, `${seed}s${k}`).slice(0, Math.min(n, tiles.length)));
    }, [tiles, seed, stage]);
    const timers = useTimers();
    const [r, setR] = useState(0);
    const [phase, setPhase] = useState("listen");
    const [saying, setSaying] = useState(null);
    const [pos, setPos] = useState(0);
    const [wrong, setWrong] = useState(null);
    const [hopped, setHopped] = useState(null);
    const [misses, setMisses] = useState(0);
    const [tally, setTally] = useState(START);
    const run = useRef(0);
    const seq = seqs[r];
    const hint = misses >= HINT_AFTER;
    /** The parrot says the words one by one (after an optional line), then it's the child's turn. */
    const sayWords = useCallback((preface) => {
        const me = ++run.current;
        const step = (i) => {
            if (run.current !== me)
                return;
            if (i >= seq.length) {
                setSaying(null);
                setPhase("play");
                speak(GAME_LINES.echoTurn);
                return;
            }
            setSaying(i);
            let moved = false;
            const go = () => {
                if (moved || run.current !== me)
                    return;
                moved = true;
                setTimeout(() => step(i + 1), 450);
            };
            speak(seq[i].word, { onEnd: go });
            setTimeout(go, 3500); // go on even if the voice never says it finished
        };
        let started = false;
        const begin = () => {
            if (started || run.current !== me)
                return;
            started = true;
            setTimeout(() => step(0), 350);
        };
        if (preface) {
            speak(preface, { onEnd: begin });
            setTimeout(begin, 5000);
        }
        else
            begin();
    }, [seq]);
    useEffect(() => {
        sayWords(r === 0 ? GAME_LINES.echoIntro : undefined);
    }, [r, sayWords]);
    useEffect(() => () => {
        run.current++; // stop the parrot when the game closes
    }, []);
    const tap = (w) => {
        if (phase !== "play")
            return;
        if (w.word === seq[pos].word) {
            sfx("tap");
            speak(w.word);
            setHopped({ word: w.word, n: pos });
            const p = pos + 1;
            setPos(p);
            if (p < seq.length)
                return;
            // Right the first time = 1 point; otherwise the words of this round count as missed.
            const t = misses === 0 ? { score: tally.score + 1, missed: tally.missed } : { score: tally.score, missed: [...new Set([...tally.missed, ...seq.map((x) => x.word)])] };
            setTally(t);
            setPhase("done");
            sfx("correct");
            timers.after(1600, () => {
                if (r + 1 >= seqs.length)
                    onDone({ score: t.score, max: seqs.length, missed: t.missed });
                else {
                    setR(r + 1);
                    setPos(0);
                    setMisses(0);
                    setHopped(null);
                    setPhase("listen");
                }
            });
            return;
        }
        sfx("wrong");
        setWrong(w.word);
        timers.after(650, () => setWrong(null));
        setMisses((m) => m + 1);
        setPos(0);
        setHopped(null);
        setPhase("listen");
        sayWords(GAME_LINES.echoAgain);
    };
    const order = (word) => seq.slice(0, pos).findIndex((x) => x.word === word);
    return (html`<div className="flex flex-col items-center gap-4">
      <${ProgressDots} total=${seqs.length} current=${r} />
      <div className="relative flex w-full max-w-3xl flex-wrap items-center justify-center gap-4 rounded-[36px] border-4 border-ink bg-gradient-to-b from-grass-soft to-sky-soft p-4">
        <span aria-hidden className="absolute left-4 top-3 text-4xl">
          🌴
        </span>
        <${Parrot} talking=${saying !== null} happy=${phase === "done"} />
        <div className="flex flex-col items-center gap-2">
          <p className="font-display text-2xl font-bold">${phase === "play" ? "Your turn! 👆" : phase === "done" ? "Yes! 🎉" : "Listen… 👂"}</p>
          <div className="flex gap-2" aria-label=${`${pos} of ${seq.length}`}>
            ${seq.map((_, k) => (html`<span key=${k} className=${`h-7 w-7 rounded-full border-[3px] border-ink ${k < pos || phase === "done" ? "bg-grass" : saying === k ? "bg-sun motion-safe:animate-pop" : "bg-paper"}`} />`))}
          </div>
          <button type="button" disabled=${phase !== "play"} onClick=${() => {
        setPos(0);
        setHopped(null);
        setPhase("listen");
        sayWords();
    }} className="btn-3d rounded-2xl border-[3px] border-ink bg-sky px-4 py-1 font-display text-lg font-bold [--shadow:#0277bd] disabled:opacity-40">
            🔁 Listen again
          </button>
        </div>
      </div>
      <div className="grid w-full max-w-3xl grid-cols-3 gap-3">
        ${tiles.map((w) => {
        const n = order(w.word);
        const lit = hint && phase === "listen" && saying !== null && seq[saying]?.word === w.word;
        return (html`<button key=${w.word} type="button" aria-label=${w.word} disabled=${phase !== "play"} onClick=${() => tap(w)} data-seq=${seq.findIndex((x) => x.word === w.word)} className=${`btn-3d relative flex aspect-[4/3] items-center justify-center rounded-3xl border-4 border-ink bg-paper text-6xl [--shadow:#e3d3ad] disabled:cursor-default ${n >= 0 ? "bg-grass-soft" : ""} ${lit ? "ring-4 ring-sun-deep motion-safe:animate-glow" : ""} ${wrong === w.word ? "shake-no !bg-berry-soft" : ""}`}>
              <span key=${hopped?.word === w.word ? `h${hopped.n}` : "s"} className=${hopped?.word === w.word ? "hop" : ""}>
                <${Pic} emoji=${w.emoji} word=${w.word} />
              </span>
              ${n >= 0 && html`<span className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-ink bg-sun font-display text-lg font-extrabold motion-safe:animate-pop">${n + 1}</span>`}
              ${phase === "done" && seq.some((x) => x.word === w.word) && html`<${Burst} size=${22} spread=${60} />`}
            </button>`);
    })}
      </div>
      <${AnswerFeedback} misses=${misses} solved=${phase === "done"} hint="Watch the pictures light up while Pip talks! ✨" />
    </div>`);
}
/* ================================ Go, car, go! ================================ */
function Car({ driving, honk }) {
    const ink = "#2b2d42";
    const wheel = (cx) => (html`<g className=${driving ? "wheel" : ""}>
      <circle cx=${cx} cy="62" r="13" fill=${ink} />
      <circle cx=${cx} cy="62" r="5.5" fill="#cfd8dc" />
      <path d=${`M${cx} 51 V73 M${cx - 11} 62 H${cx + 11}`} stroke="#cfd8dc" strokeWidth="2.2" />
    </g>`);
    return (html`<svg viewBox="0 0 140 80" width=${124} height=${71} role="img" aria-label="The car" className=${honk ? "shake-no" : driving ? "rumble" : ""}>
      <path d="M10 52 Q10 36 28 34 L44 14 Q48 8 58 8 L92 8 Q102 8 108 16 L122 34 Q134 36 134 50 L134 58 Q134 62 130 62 L14 62 Q10 62 10 58 Z" fill="#ff6b9a" stroke=${ink} strokeWidth="4" strokeLinejoin="round" />
      <path d="M50 16 L40 34 H70 V16 Z" fill="#dff4fd" stroke=${ink} strokeWidth="3" strokeLinejoin="round" />
      <path d="M78 16 V34 H112 L100 18 Q98 16 94 16 Z" fill="#dff4fd" stroke=${ink} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="92" cy="27" r="6.5" fill="#a5d6a7" stroke=${ink} strokeWidth="2" />
      <path d="M89.5 28.5 Q92 31 94.5 28.5" stroke=${ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="128" cy="44" r="4.5" fill="#ffc83d" stroke=${ink} strokeWidth="2" />
      <rect x="62" y="40" width="14" height="4" rx="2" fill=${ink} />
      ${wheel(38)}
      ${wheel(106)}
    </svg>`);
}
export function TrafficGame({ data, onDone, seed, stage }) {
    const rounds = useMemo(() => {
        const list = shuffleOnce(data.words, seed);
        const n = Math.min(6, list.length * 2);
        const truths = shuffleOnce([true, false, true, false, true, false], seed + "t").slice(0, n);
        return Array.from({ length: n }, (_, i) => {
            const pic = list[i % list.length];
            const truth = truths[i];
            const others = shuffleOnce(data.words.filter((w) => w.word !== pic.word), `${seed}o${i}`);
            return { pic, said: truth || !others.length ? pic : others[0], truth: truth || !others.length };
        });
    }, [data.words, seed]);
    const timers = useTimers();
    const [r, setR] = useState(0);
    const [out, setOut] = useState([]);
    const [solved, setSolved] = useState(false);
    const [driving, setDriving] = useState(false);
    const [honk, setHonk] = useState(false);
    const [pos, setPos] = useState(0);
    const [won, setWon] = useState(false);
    const [misses, setMisses] = useState(0);
    const [tally, setTally] = useState(START);
    const round = rounds[r];
    const say = GAME_SAY.traffic(round.said.word);
    useSayOnChange(say);
    const answer = (yes) => {
        if (solved || out.includes(yes ? "yes" : "no"))
            return;
        if (yes !== round.truth) {
            setOut((o) => [...o, yes ? "yes" : "no"]);
            setMisses((m) => m + 1);
            setHonk(true);
            sfx("honk");
            timers.after(650, () => setHonk(false));
            sayTryAgain(say);
            return;
        }
        const t = scoreRound(tally, round.pic.word, misses);
        setTally(t);
        setSolved(true);
        setDriving(true);
        sfx("vroom");
        speak(round.pic.word);
        const last = r + 1 >= rounds.length;
        setPos(r + 1);
        timers.after(1200, () => {
            setDriving(false);
            if (last) {
                setWon(true);
                sfx("win");
                speak(GAME_LINES.trafficWin);
                timers.after(2200, () => onDone({ score: t.score, max: rounds.length, missed: t.missed }));
            }
            else {
                setR(r + 1);
                setOut([]);
                setSolved(false);
                setMisses(0);
            }
        });
    };
    const left = won ? 86 : (pos / rounds.length) * 74;
    const hint = misses >= HINT_AFTER && !solved;
    return (html`<div className="flex flex-col items-center gap-4">
      <${ProgressDots} total=${rounds.length} current=${r} />
      <div className="relative h-40 w-full max-w-3xl overflow-hidden rounded-[30px] border-4 border-ink bg-gradient-to-b from-[#bfe9ff] to-[#e3f4e4]" data-testid="road">
        <span aria-hidden className="cloud-drift absolute top-2 text-4xl" style=${css({ "--dur": "30s", "--delay": "-8s" })}>
          ☁️
        </span>
        <div aria-hidden className="absolute -bottom-12 -left-[8%] h-32 w-[55%] rounded-[50%] bg-grass/50" />
        <div aria-hidden className="absolute -bottom-14 right-[-6%] h-36 w-[60%] rounded-[50%] bg-grass/40" />
        <div aria-hidden className=${`absolute inset-x-0 bottom-0 h-16 border-t-4 border-ink bg-[#5c5f77] ${driving || won ? "road-move" : ""}`} style=${{ backgroundImage: "linear-gradient(90deg, #fff 0 48px, transparent 48px 96px)", backgroundSize: "96px 6px", backgroundRepeat: "repeat-x", backgroundPositionY: "50%" }} />
        <div aria-hidden className="absolute bottom-16 right-5 flex flex-col items-start">
          <div className="flag-wave h-10 w-14 border-2 border-ink" style=${{ background: "repeating-conic-gradient(#2b2d42 0 25%, #fff 0 50%) 0 0 / 14px 14px" }} />
          <div className="h-12 w-1.5 bg-ink" />
        </div>
        <div className="absolute bottom-7 transition-[left] duration-[1100ms] ease-out" style=${{ left: `${left}%` }}>
          ${(driving || won) &&
        [0, 0.25, 0.5].map((d) => (html`<span key=${d} aria-hidden className="puff absolute -left-3 bottom-2 h-5 w-5 rounded-full bg-white/80" style=${css({ "--delay": `${d}s` })} />`))}
          <${Car} driving=${driving || won} honk=${honk} />
        </div>
        ${won && html`<${Burst} x="88%" y="35%" bits=${["🏁", "🎉", "⭐", "🏆", "✨", "🎉", "⭐", "🌟"]} spread=${110} />`}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-6">
        <div className="flex flex-col items-center" key=${r}>
          <div className=${`flex h-44 w-44 items-center justify-center overflow-hidden rounded-[28px] border-4 border-ink bg-white text-8xl shadow-[0_6px_0_0_#2b2d42] motion-safe:animate-pop-in`}>
            <${Pic} emoji=${round.pic.emoji} word=${round.pic.word} scale=${1.3} />
          </div>
          <div aria-hidden className="h-8 w-3 bg-ink" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <${SpeakButton} text=${say} size=${64} />
          <p className="font-display text-2xl font-bold">${canRead(stage) ? say : "Is it right?"}</p>
        </div>
      </div>
      <div className="flex gap-6">
        ${[
        [true, "yes", "Yes!", "👍", "bg-grass", "#2e7d32"],
        [false, "no", "No!", "👎", "bg-berry", "#c2185b"],
    ].map(([yes, key, label, icon, bg, shadow]) => (html`<button key=${key} type="button" aria-label=${label} disabled=${solved || out.includes(key)} onClick=${() => answer(yes)} className=${`btn-3d flex h-32 w-32 flex-col items-center justify-center rounded-full border-[5px] border-ink font-display text-3xl font-extrabold disabled:opacity-40 ${bg} ${hint && yes === round.truth ? "ring-8 ring-sun-deep motion-safe:animate-glow" : ""}`} style=${css({ "--shadow": shadow })}>
            <span className="text-4xl">${icon}</span>
            ${label}
          </button>`))}
      </div>
      <${AnswerFeedback} misses=${misses} solved=${solved} hint="The glowing light is right! ✨" />
    </div>`);
}
/* ================================ Rocket words ================================ */
function Rocket({ flame }) {
    const ink = "#2b2d42";
    return (html`<svg viewBox="0 0 80 130" width=${72} height=${117} overflow="visible" role="img" aria-label="The rocket">
      ${flame && (html`<g className="flame">
          <path d="M26 128 Q40 172 54 128 Z" fill="#ff8a3d" />
          <path d="M32 128 Q40 156 48 128 Z" fill="#ffc83d" />
        </g>`)}
      <path d="M18 92 L2 130 L22 122 Z" fill="#ff6b9a" stroke=${ink} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M62 92 L78 130 L58 122 Z" fill="#ff6b9a" stroke=${ink} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M40 4 Q66 30 64 92 L62 126 H18 L16 92 Q14 30 40 4 Z" fill="#fff" stroke=${ink} strokeWidth="4" strokeLinejoin="round" />
      <path d="M40 4 Q54 18 58 34 H22 Q26 18 40 4 Z" fill="#ff6b9a" stroke=${ink} strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="40" cy="64" r="13" fill="#4fc3f7" stroke=${ink} strokeWidth="4" />
      <circle cx="36" cy="60" r="4" fill="#fff" opacity=".85" />
      <rect x="18" y="100" width="44" height="8" fill="#9c6ade" />
    </svg>`);
}
const PLANETS = ["#ffb74d", "#81d4fa", "#ce93d8", "#a5d6a7"];
export function RocketGame({ data, onDone, seed }) {
    const rounds = useRounds(data.words, seed, 6);
    const timers = useTimers();
    const [r, setR] = useState(0);
    const [out, setOut] = useState([]);
    const [solved, setSolved] = useState(false);
    const [fuel, setFuel] = useState(0);
    const [count, setCount] = useState(null);
    const [launched, setLaunched] = useState(false);
    const [misses, setMisses] = useState(0);
    const [tally, setTally] = useState(START);
    const target = rounds[r];
    const planets = useMemo(() => withOthers(data.words, target, 2, seed + r), [data.words, target, seed, r]);
    const stars = useMemo(() => Array.from({ length: 26 }, (_, k) => ({ x: (k * 37 + 11) % 100, y: (k * 53 + 7) % 92, d: 1.6 + (k % 4) * 0.6, s: 4 + (k % 3) * 2 })), []);
    const tap = (w) => {
        if (solved || out.includes(w.word) || count !== null)
            return;
        if (w.word !== target.word) {
            setOut((o) => [...o, w.word]);
            setMisses((m) => m + 1);
            sayTryAgain();
            return;
        }
        const t = scoreRound(tally, target.word, misses);
        setTally(t);
        setSolved(true);
        setFuel((f) => f + 1);
        sfx("correct");
        speak(target.word);
        timers.after(1300, () => {
            if (r + 1 < rounds.length) {
                setR(r + 1);
                setOut([]);
                setSolved(false);
                setMisses(0);
                return;
            }
            // Fuel full: count down and blast off.
            speak(GAME_LINES.rocketLaunch);
            setCount(3);
            timers.after(700, () => setCount(2));
            timers.after(1400, () => setCount(1));
            timers.after(2100, () => {
                setCount(0);
                setLaunched(true);
                sfx("blast");
            });
            timers.after(4300, () => onDone({ score: t.score, max: rounds.length, missed: t.missed }));
        });
    };
    return (html`<div className="flex flex-col items-center gap-4">
      <${ProgressDots} total=${rounds.length} current=${r} />
      <div className="relative min-h-[460px] w-full max-w-3xl overflow-hidden rounded-[36px] border-4 border-ink bg-gradient-to-b from-[#161a45] via-[#2d2a6e] to-[#4b3a8f] p-4 text-white" data-testid="space">
        ${stars.map((s, k) => (html`<span key=${k} aria-hidden className="twinkle absolute rounded-full bg-white" style=${css({ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, "--dur": `${s.d}s`, "--delay": `${-k * 0.3}s` })} />`))}
        <span aria-hidden className="absolute right-6 top-5 text-5xl">
          🪐
        </span>
        
        <div className="absolute bottom-5 left-4 flex flex-col-reverse gap-1 rounded-xl border-[3px] border-white/80 bg-black/30 p-1" aria-label=${`Fuel ${fuel} of ${rounds.length}`}>
          ${rounds.map((_, k) => (html`<span key=${k} className=${`h-5 w-6 rounded-md ${k < fuel ? "bg-gradient-to-r from-sun to-orange motion-safe:animate-pop" : "bg-white/15"}`} />`))}
        </div>
        
        <div className=${`absolute bottom-3 left-16 flex flex-col items-center ${launched ? "launch" : count !== null ? "rumble" : ""}`}>
          <${Rocket} flame=${fuel > 0 || count !== null} />
          <div aria-hidden className="h-3 w-24 rounded-full bg-[#9e9e9e]" />
        </div>
        ${launched && html`<${Burst} x="22%" y="88%" bits=${["💨", "⭐", "💨", "✨", "💨", "🌟"]} spread=${80} />`}
        
        <div className="relative z-10 ml-auto mr-auto flex w-full max-w-md flex-col items-center gap-4 pl-16 sm:pl-0">
          <div key=${r} className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-[5px] border-white bg-white text-7xl text-ink shadow-[0_0_0_6px_rgba(255,255,255,.2)] motion-safe:animate-pop-in md:h-40 md:w-40">
            <${Pic} emoji=${target.emoji} word=${target.word} scale=${1.3} />
          </div>
          <p className="font-display text-2xl font-bold">${count !== null ? "Blast off! 🚀" : "Which word is it?"}</p>
          <div className="flex flex-wrap justify-center gap-4">
            ${planets.map((w, k) => {
        const gone = out.includes(w.word);
        const right = solved && w.word === target.word;
        const hint = misses >= HINT_AFTER && w.word === target.word && !solved;
        return (html`<button key=${`${r}-${w.word}`} type="button" disabled=${gone || solved || count !== null} onClick=${() => tap(w)} className=${`balloon-sway relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-ink shadow-[inset_-12px_-12px_0_rgba(0,0,0,.16)] disabled:cursor-default md:h-32 md:w-32 ${gone ? "opacity-40 grayscale" : ""} ${hint ? "ring-8 ring-sun motion-safe:animate-glow" : ""} ${right ? "ring-8 ring-grass" : ""}`} style=${css({ background: PLANETS[(k + r) % PLANETS.length], "--dur": `${3 + k * 0.4}s`, "--delay": `${-k * 0.7}s` })}>
                  <span aria-hidden className="absolute h-8 w-[140%] -rotate-12 rounded-[50%] border-4 border-white/70" />
                  <span className="relative rounded-xl bg-white/90 px-2 py-0.5 font-display text-xl font-extrabold text-ink md:text-2xl">${w.word}</span>
                  ${gone && (html`<span aria-hidden className="absolute -right-1 -top-1 text-3xl">
                      ❌
                    </span>`)}
                  ${right && html`<${Burst} size=${24} spread=${70} />`}
                </button>`);
    })}
          </div>
        </div>
        ${count !== null && count > 0 && (html`<span key=${count} aria-hidden className="absolute inset-0 z-20 flex items-center justify-center font-display text-[9rem] font-extrabold text-sun drop-shadow-[0_6px_0_#2b2d42] motion-safe:animate-pop">
            ${count}
          </span>`)}
      </div>
      <${AnswerFeedback} misses=${misses} solved=${solved} hint="The glowing planet is right! ✨" />
    </div>`);
}
