import { html, Fragment } from "@/lib/html.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { BigButton, ProgressDots, SpeakButton } from "@/components/kids/index.js";
import { speak } from "@/lib/client/speech.js";
import { sfx } from "@/lib/client/sfx.js";
import { GAME_SAY } from "@/lib/games.js";
import { AnswerFeedback, HINT_AFTER, sayTryAgain, shuffleOnce } from "./quiz.js";
import { Pic } from "@/components/Pic.js";
import { Burst, FUN_COLORS, scoreRound, useTimers } from "./gameKit.js";
import { EchoGame, FeedGame, FishingGame, PopupGame, RocketGame, SpyGame, TrafficGame } from "./minigames.js";
const css = (o) => o;
export function GamePlayer(props) {
    switch (props.data.game) {
        case "memory":
            return html`<${MemoryGame} ...${props} />`;
        case "balloon":
            return html`<${BalloonGame} ...${props} />`;
        case "spelling":
            return html`<${SpellingGame} ...${props} />`;
        case "sort":
            return html`<${SortGame} ...${props} />`;
        case "fishing":
            return html`<${FishingGame} ...${props} />`;
        case "feed":
            return html`<${FeedGame} ...${props} />`;
        case "spy":
            return html`<${SpyGame} ...${props} />`;
        case "popup":
            return html`<${PopupGame} ...${props} />`;
        case "echo":
            return html`<${EchoGame} ...${props} />`;
        case "traffic":
            return html`<${TrafficGame} ...${props} />`;
        case "rocket":
            return html`<${RocketGame} ...${props} />`;
    }
}
/* -------------------------------- Memory -------------------------------- */
function MemoryGame({ data, onDone, seed }) {
    const words = data.words.slice(0, 6);
    const cards = useMemo(() => shuffleOnce(words.flatMap((w) => [{ key: w.word + "#p", word: w.word, face: w.emoji, pic: true }, { key: w.word + "#w", word: w.word, face: w.word, pic: false }]), seed), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed]);
    const timers = useTimers();
    const [open, setOpen] = useState([]);
    const [found, setFound] = useState([]);
    const [nope, setNope] = useState([]);
    const [justFound, setJustFound] = useState(null);
    const [moves, setMoves] = useState(0);
    const tap = (c) => {
        if (open.length === 2 || open.includes(c.key) || found.includes(c.word))
            return;
        sfx("flip");
        if (!c.pic)
            speak(c.word);
        const o = [...open, c.key];
        setOpen(o);
        if (o.length < 2)
            return;
        setMoves((m) => m + 1);
        const [a, b] = o.map((k) => cards.find((x) => x.key === k));
        if (a.word === b.word) {
            timers.after(450, () => {
                sfx("sparkle");
                speak(a.word);
                const f = [...found, a.word];
                setFound(f);
                setJustFound(a.word);
                setOpen([]);
                if (f.length === words.length) {
                    const extra = Math.max(0, moves + 1 - words.length);
                    timers.after(900, () => onDone({ score: Math.max(1, words.length - Math.floor(extra / 2)), max: words.length, missed: [] }));
                }
            });
        }
        else {
            timers.after(700, () => {
                sfx("wrong");
                setNope(o);
            });
            timers.after(1250, () => {
                setNope([]);
                setOpen([]);
            });
        }
    };
    return (html`<div className="flex flex-col items-center gap-4">
      <p className="font-display text-2xl">
        Find the pairs! <span className="rounded-full border-2 border-ink bg-sun px-3">Moves: ${moves}</span>
      </p>
      <div className=${`grid w-full max-w-3xl gap-3 ${cards.length > 8 ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
        ${cards.map((c, k) => {
        const done = found.includes(c.word);
        const shown = open.includes(c.key) || done;
        return (html`<button key=${c.key} onClick=${() => tap(c)} aria-label=${shown ? c.word : "Hidden card"} className=${`flip-scene relative aspect-square motion-safe:animate-pop-in ${nope.includes(c.key) ? "shake-no" : ""} ${justFound === c.word ? "hop" : ""}`} style=${{ animationDelay: `${k * 45}ms` }}>
              <span className=${`flip-card block h-full w-full ${shown ? "flipped" : ""}`}>
                <span className="flip-face flex items-center justify-center rounded-3xl border-[3px] border-ink bg-sun shadow-[0_6px_0_0_#e09b00] [background-image:radial-gradient(rgba(255,255,255,.45)_3px,transparent_3px)] [background-size:18px_18px]">
                  <span className="text-5xl motion-safe:animate-float" style=${{ animationDelay: `${(k % 4) * 0.4}s` }}>
                    🍀
                  </span>
                </span>
                <span className=${`flip-face flip-back flex items-center justify-center rounded-3xl border-[3px] border-ink ${done ? "bg-grass-soft ring-4 ring-grass" : "bg-paper"} ${nope.includes(c.key) ? "!bg-berry-soft" : ""}`}>
                  <span className=${c.pic ? "text-6xl" : "font-display text-2xl font-bold md:text-3xl"}>${c.pic ? html`<${Pic} emoji=${c.face} word=${c.word} scale=${1.5} />` : c.face}</span>
                </span>
              </span>
              ${justFound === c.word && c.pic && html`<${Burst} key=${found.length} size=${24} spread=${70} />`}
            </button>`);
    })}
      </div>
    </div>`);
}
/* -------------------------------- Balloon ------------------------------- */
function BalloonShape({ color }) {
    return (html`<svg viewBox="0 0 120 170" aria-hidden className="absolute inset-0 h-full w-full">
      <path d="M60 118 Q58 140 66 168" stroke="#2b2d42" strokeWidth="2.5" fill="none" />
      <path d="M60 4 C92 4 112 30 112 60 C112 92 86 116 60 118 C34 116 8 92 8 60 C8 30 28 4 60 4 Z" fill=${color} stroke="#2b2d42" strokeWidth="4" />
      <path d="M54 117 L66 117 L62 126 L58 126 Z" fill=${color} stroke="#2b2d42" strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="36" cy="38" rx="9" ry="16" fill="#fff" opacity=".45" transform="rotate(25 36 38)" />
    </svg>`);
}
function BalloonGame({ data, onDone, seed }) {
    const rounds = useMemo(() => shuffleOnce(data.words, seed).slice(0, Math.min(6, data.words.length)), [data.words, seed]);
    const timers = useTimers();
    const [r, setR] = useState(0);
    const [popped, setPopped] = useState(null);
    const [wrong, setWrong] = useState(null);
    const [tally, setTally] = useState({ score: 0, missed: [] });
    const [misses, setMisses] = useState(0);
    const [out, setOut] = useState([]);
    const target = rounds[r];
    const say = GAME_SAY.balloon(target.word);
    const balloons = useMemo(() => {
        const others = shuffleOnce(data.words.filter((w) => w.word !== target.word), seed + r).slice(0, 3);
        return shuffleOnce([target, ...others], "b" + r + seed);
    }, [r, target, data.words, seed]);
    useEffect(() => {
        const t = setTimeout(() => speak(say), 400);
        return () => clearTimeout(t);
    }, [say]);
    const pop = (w) => {
        if (popped || out.includes(w))
            return;
        if (w === target.word) {
            sfx("pop");
            setPopped(w);
            const t = scoreRound(tally, target.word, misses);
            setTally(t);
            timers.after(300, () => speak(target.word));
            timers.after(1100, () => {
                if (r + 1 >= rounds.length)
                    onDone({ score: t.score, max: rounds.length, missed: t.missed });
                else {
                    setR(r + 1);
                    setPopped(null);
                    setMisses(0);
                    setOut([]);
                }
            });
        }
        else {
            setMisses((m) => m + 1);
            setOut((o) => [...o, w]);
            setWrong(w);
            timers.after(500, () => setWrong(null));
            sayTryAgain(say);
        }
    };
    return (html`<div className="flex flex-col items-center gap-5">
      <${ProgressDots} total=${rounds.length} current=${r} />
      <div className="flex items-center gap-3">
        <${SpeakButton} text=${say} size=${64} />
        <p className="font-display text-3xl font-bold">Listen and pop! 🎈</p>
      </div>
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[36px] border-4 border-ink bg-gradient-to-b from-[#bfe9ff] to-[#fff9ec] px-3 pb-6 pt-8">
        ${[
        { top: "8%", dur: "46s", delay: "-6s" },
        { top: "30%", dur: "60s", delay: "-30s" },
    ].map((c, k) => (html`<span key=${k} aria-hidden className="cloud-drift absolute text-5xl opacity-90" style=${css({ top: c.top, "--dur": c.dur, "--delay": c.delay })}>
            ☁️
          </span>`))}
        <div className="relative grid grid-cols-2 gap-6 sm:grid-cols-4">
          ${balloons.map((b, k) => {
        const isPopped = popped === b.word;
        const gone = out.includes(b.word);
        return (html`<div key=${`${r}-${b.word}`} className="relative mx-auto h-48 w-32">
                ${!isPopped ? (html`<button onClick=${() => pop(b.word)} disabled=${gone} aria-label=${b.word} className=${`balloon-sway relative block h-full w-full ${gone ? "opacity-40 grayscale" : ""} ${wrong === b.word ? "shake-no" : ""}`} style=${css({ "--dur": `${3 + (k % 3) * 0.5}s`, "--delay": `${-k * 0.6}s` })}>
                    <${BalloonShape} color=${FUN_COLORS[(k + r) % FUN_COLORS.length]} />
                    <span className=${`absolute left-1/2 top-[34%] flex h-[70px] w-[70px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-[3px] border-ink bg-white text-5xl ${misses >= HINT_AFTER && b.word === target.word ? "ring-8 ring-sun-deep motion-safe:animate-glow" : ""}`}>
                      <${Pic} emoji=${b.emoji} word=${b.word} />
                    </span>
                    ${gone && (html`<span aria-hidden className="absolute -right-2 top-0 text-4xl">
                        ❌
                      </span>`)}
                  </button>`) : (html`<${Fragment}>
                    <span className="zoom-out absolute inset-0 block">
                      <${BalloonShape} color=${FUN_COLORS[(k + r) % FUN_COLORS.length]} />
                    </span>
                    <span className="absolute left-1/2 top-[30%] -translate-x-1/2 font-display text-4xl font-extrabold text-berry-deep motion-safe:animate-pop">POP!</span>
                    <${Burst} x="50%" y="34%" bits=${["🎉", "✨", "🎊", "⭐", "🎉", "✨", "🎊", "🌟"]} />
                  <//>`)}
              </div>`);
    })}
        </div>
      </div>
      <${AnswerFeedback} misses=${misses} solved=${!!popped} />
    </div>`);
}
/* ------------------------------- Spelling ------------------------------- */
function SpellingGame({ data, onDone, seed }) {
    const words = useMemo(() => data.words.filter((w) => /^[a-z]+$/i.test(w.word)).slice(0, 6), [data.words]);
    const [i, setI] = useState(0);
    const [picked, setPicked] = useState([]);
    /** "no": the letters from `goodUpTo` on are shown red for a moment, then go back to the pool. */
    const [status, setStatus] = useState("");
    const [goodUpTo, setGoodUpTo] = useState(0);
    const [misses, setMisses] = useState(0);
    const [score, setScore] = useState(0);
    const [missed, setMissed] = useState([]);
    const w = words[i];
    const letters = useMemo(() => (w ? shuffleOnce(w.word.toLowerCase().split(""), seed + i) : []), [w, seed, i]);
    useEffect(() => {
        if (!w)
            return;
        const t = setTimeout(() => speak(w.word), 400);
        return () => clearTimeout(t);
    }, [w]);
    if (!w)
        return html`<p>No words to spell.</p>`;
    const target = w.word.toLowerCase();
    const typed = picked.map((k) => letters[k]).join("");
    const hintTile = misses >= HINT_AFTER && !status ? letters.findIndex((l, k) => !picked.includes(k) && l === target[picked.length]) : -1;
    const check = () => {
        if (typed === target) {
            setStatus("ok");
            sfx("correct");
            speak(w.word);
            if (misses === 0)
                setScore((s) => s + 1);
            return;
        }
        let ok = 0;
        while (ok < typed.length && typed[ok] === target[ok])
            ok++;
        setGoodUpTo(ok);
        setStatus("no");
        if (misses === 0)
            setMissed((m) => [...m, w.word]);
        setMisses((m) => m + 1);
        sayTryAgain();
        setTimeout(() => {
            setPicked((p) => p.slice(0, ok));
            setStatus("");
        }, 1200);
    };
    const next = () => {
        if (i + 1 >= words.length)
            onDone({ score, max: words.length, missed });
        else {
            setI(i + 1);
            setPicked([]);
            setStatus("");
            setMisses(0);
        }
    };
    return (html`<div className="flex flex-col items-center gap-6">
      <${ProgressDots} total=${words.length} current=${i} />
      <div className="relative flex items-center gap-4">
        <span aria-hidden className="text-5xl motion-safe:animate-bob">
          🐝
        </span>
        <div key=${i} className=${`relative text-9xl motion-safe:animate-pop-in ${status === "ok" ? "hop" : ""}`}>
          <${Pic} emoji=${w.emoji} word=${w.word} />
          ${status === "ok" && html`<${Burst} />`}
        </div>
      </div>
      <div className="flex gap-3">
        <${SpeakButton} text=${w.word} size=${64} />
        <${SpeakButton} text=${w.word.split("").join(", ")} label="Spell it slowly" slow size=${56} />
      </div>
      <div className="flex min-h-20 gap-2">
        ${w.word.split("").map((_, k) => (html`<span key=${k} className=${`flex h-16 w-14 items-center justify-center rounded-2xl border-[3px] border-ink font-display text-4xl font-bold ${status === "ok" ? "bg-grass-soft" : status === "no" ? (k < goodUpTo ? "bg-grass-soft" : "bg-berry-soft motion-safe:animate-wiggle") : "bg-paper"}`}>
            ${typed[k] ? (html`<span key=${`${k}${typed[k]}${picked.length > k}`} className=${status === "ok" ? "rainbow" : "drop-in"} style=${status === "ok" ? { animationDelay: `${k * 0.1}s` } : undefined}>
                ${typed[k]}
              </span>`) : ("")}
          </span>`))}
      </div>
      <${AnswerFeedback} misses=${misses} solved=${status === "ok"} hint="The glowing letter comes next! ✨" />
      ${status !== "ok" ? (html`<${Fragment}>
          <div className="flex flex-wrap justify-center gap-3">
            ${letters.map((l, k) => (html`<button key=${k} disabled=${picked.includes(k) || status === "no"} onClick=${() => (sfx("tap"), setPicked([...picked, k]))} className=${`btn-3d h-16 w-16 rounded-2xl border-[3px] border-ink bg-sun font-display text-4xl font-bold [--shadow:#e09b00] disabled:opacity-20 ${k === hintTile ? "ring-4 ring-sun-deep motion-safe:animate-glow" : ""}`}>
                ${l}
              </button>`))}
          </div>
          <div className="flex gap-3">
            <${BigButton} color="white" size="sm" disabled=${status === "no"} onClick=${() => setPicked(picked.slice(0, -1))}>
              ⌫ Undo
            <//>
            <${BigButton} color="grass" disabled=${picked.length !== letters.length || status === "no"} onClick=${check}>
              Check ✔
            <//>
          </div>
        <//>`) : (html`<${BigButton} color="grass" size="lg" onClick=${next} autoFocus>
          ${i + 1 >= words.length ? "Finish ⭐" : "Next ➜"}
        <//>`)}
    </div>`);
}
/* --------------------------------- Sort --------------------------------- */
function SortGame({ data, onDone, seed }) {
    const cats = data.categories ?? [];
    const queue = useMemo(() => shuffleOnce(data.words, seed), [data.words, seed]);
    const timers = useTimers();
    const [i, setI] = useState(0);
    const [placed, setPlaced] = useState({});
    const [tally, setTally] = useState({ score: 0, missed: [] });
    const [shake, setShake] = useState(null);
    const [flying, setFlying] = useState(null);
    const [landed, setLanded] = useState(null);
    /** Baskets already tried for the current word (wrong). */
    const [out, setOut] = useState([]);
    const card = useRef(null);
    const w = queue[i];
    useEffect(() => {
        if (w)
            speak(w.word);
    }, [w]);
    const drop = (cat, el) => {
        if (!w || out.includes(cat) || flying)
            return;
        if (w.category !== cat) {
            setOut((o) => [...o, cat]);
            setShake(cat);
            timers.after(500, () => setShake(null));
            sayTryAgain(w.word);
            return;
        }
        const t = scoreRound(tally, w.word, out.length);
        setTally(t);
        const a = card.current?.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        setFlying(a ? { dx: b.left + b.width / 2 - (a.left + a.width / 2), dy: b.top + b.height / 2 - (a.top + a.height / 2) } : { dx: 0, dy: 200 });
        sfx("whoosh");
        timers.after(650, () => {
            sfx("correct");
            setPlaced((p) => ({ ...p, [cat]: [...(p[cat] ?? []), w.word] }));
            setLanded(cat);
            timers.after(950, () => setLanded((l) => (l === cat ? null : l)));
            setFlying(null);
            setOut([]);
            if (i + 1 >= queue.length)
                timers.after(700, () => onDone({ score: t.score, max: queue.length, missed: t.missed }));
            setI(i + 1);
        });
    };
    return (html`<div className="flex flex-col items-center gap-6">
      <${ProgressDots} total=${queue.length} current=${Math.min(i, queue.length - 1)} />
      ${w && (html`<div ref=${card} key=${i} className=${`flex flex-col items-center gap-2 rounded-3xl border-[3px] border-ink bg-paper px-6 py-3 ${flying ? "fly-to" : "motion-safe:animate-pop-in"}`} style=${css({ "--dx": `${flying?.dx ?? 0}px`, "--dy": `${flying?.dy ?? 0}px` })}>
          <span className="text-8xl">
            <${Pic} emoji=${w.emoji} word=${w.word} />
          </span>
          <span className="font-display text-3xl font-bold">${w.word}</span>
        </div>`)}
      ${w && html`<${AnswerFeedback} misses=${out.length} solved=${false} hint="The glowing basket is right! ✨" />`}
      <div className="grid w-full max-w-3xl gap-4" style=${{ gridTemplateColumns: `repeat(${Math.min(cats.length, 4)}, minmax(0,1fr))` }}>
        ${cats.map((c) => (html`<button key=${c} onClick=${(e) => drop(c, e.currentTarget)} disabled=${out.includes(c)} className=${`btn-3d relative flex min-h-40 flex-col items-center justify-end gap-2 rounded-b-[40px] rounded-t-xl border-[3px] border-ink bg-orange-soft p-3 [--shadow:#d9480f] disabled:opacity-50 ${shake === c ? "!bg-berry-soft shake-no" : ""} ${landed === c ? "hop" : ""} ${w && out.length >= HINT_AFTER && c === w.category ? "ring-4 ring-sun-deep motion-safe:animate-glow" : ""}`}>
            ${out.includes(c) && (html`<span aria-hidden className="absolute right-2 top-2 text-3xl">
                ❌
              </span>`)}
            <span className="flex flex-wrap justify-center text-3xl">
              ${(placed[c] ?? []).map((word) => (html`<span key=${word} className="motion-safe:animate-pop">
                  <${Pic} word=${word} emoji=${data.words.find((x) => x.word === word)?.emoji} />
                </span>`))}
            </span>
            <span className="font-display text-2xl font-bold">🧺 ${c}</span>
            ${landed === c && html`<${Burst} size=${22} spread=${60} y="30%" />`}
          </button>`))}
      </div>
    </div>`);
}
