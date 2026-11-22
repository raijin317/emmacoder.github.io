import { html, Fragment } from "@/lib/html.js";
import { useEffect, useMemo, useState } from "react";
import { BigButton, ProgressDots, SpeakButton } from "@/components/kids/index.js";
import { speak } from "@/lib/client/speech.js";
import { sfx } from "@/lib/client/sfx.js";
import { TRY_AGAIN } from "@/lib/voices.js";
import { Pic } from "@/components/Pic.js";
/**
 * Answering works the same everywhere: a wrong pick is shown as wrong (red, ❌, “Oops! Try again.”) and can't be
 * picked again; the child keeps choosing until the right answer is found — only then “Next” appears.
 * The score counts the questions that were right the first time. After HINT_AFTER misses the right answer glows.
 */
export const HINT_AFTER = 2;
export function shuffleOnce(arr, seed) {
    let h = 0;
    for (const c of seed)
        h = (h * 31 + c.charCodeAt(0)) | 0;
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        h = (h * 1103515245 + 12345) | 0;
        const k = Math.abs(h) % (i + 1);
        [a[i], a[k]] = [a[k], a[i]];
    }
    return a;
}
const answerText = (q) => q.kind === "mc" || q.kind === "picture" || q.kind === "fill" ? q.answer : q.kind === "tf" ? q.statement : q.kind === "order" ? q.words.join(" ") : q.pairs.map((p) => p.word).join(", ");
/** Matching has many taps — one slip still counts as right first time. */
const allowedMisses = (q) => (q.kind === "match" ? 1 : 0);
/** Says “Oops! Try again.”, then (optionally) repeats what the child has to listen to. */
export function sayTryAgain(repeat) {
    sfx("wrong");
    speak(TRY_AGAIN, repeat ? { onEnd: () => setTimeout(() => speak(repeat), 250) } : {});
}
/** The message under a question: wrong → try again (+ hint), right → praise. */
export function AnswerFeedback({ misses, solved, hint = "Look for the glowing one! ✨" }) {
    if (solved)
        return (html`<p role="status" className="font-display text-3xl font-extrabold text-grass-deep motion-safe:animate-pop">
        ${misses === 0 ? "Great job! 🎉" : "You got it! 👍"}
      </p>`);
    if (!misses)
        return null;
    return (html`<div key=${misses} role="alert" className="flex flex-col items-center gap-1 rounded-3xl border-[3px] border-berry-deep bg-berry-soft px-6 py-3 text-center motion-safe:animate-wiggle">
      <p className="font-display text-2xl font-extrabold text-berry-deep">❌ Oops! That's not right.</p>
      <p className="text-xl font-bold">Try again! 💪${misses >= HINT_AFTER && hint ? ` ${hint}` : ""}</p>
    </div>`);
}
/** Runs a list of questions one by one; each must be answered right before going on. */
export function QuizRunner({ questions, onDone, labels }) {
    const [i, setI] = useState(0);
    const [results, setResults] = useState([]);
    const [misses, setMisses] = useState(0);
    const [solved, setSolved] = useState(false);
    const q = questions[i];
    const answer = (ok) => {
        if (solved)
            return;
        if (!ok) {
            setMisses((m) => m + 1);
            sayTryAgain(q.kind === "picture" ? q.prompt : q.kind === "tf" ? q.statement : undefined);
            return;
        }
        sfx("correct");
        setSolved(true);
        setResults((r) => {
            const n = [...r];
            n[i] = misses <= allowedMisses(q);
            return n;
        });
    };
    const next = () => {
        if (i + 1 >= questions.length) {
            onDone({ score: results.filter(Boolean).length, max: questions.length, missed: questions.filter((_, k) => results[k] === false).map(answerText) });
            return;
        }
        setI(i + 1);
        setMisses(0);
        setSolved(false);
    };
    return (html`<div className="flex flex-col gap-6">
      <${ProgressDots} total=${questions.length} current=${i} results=${results} />
      ${labels?.[i] && html`<p className="text-center font-display text-lg text-ink-soft">${labels[i]}</p>`}
      <div key=${i} className="motion-safe:animate-pop">
        <${Question} q=${q} solved=${solved} hint=${misses >= HINT_AFTER} onAnswer=${answer} />
      </div>
      <div className="flex flex-col items-center gap-3">
        <${AnswerFeedback} misses=${misses} solved=${solved} hint=${q.kind === "tf" ? "" : q.kind === "order" ? "The glowing word comes next! ✨" : undefined} />
        ${solved && (html`<${BigButton} color="grass" size="lg" onClick=${next} autoFocus className="motion-safe:animate-pop">
            ${i + 1 >= questions.length ? "Finish ⭐" : "Next ➜"}
          <//>`)}
      </div>
    </div>`);
}
export function Question({ q, ...p }) {
    switch (q.kind) {
        case "mc":
            return html`<${ChoiceQ} prompt=${q.prompt} emoji=${q.emoji} options=${q.options} answer=${q.answer} ...${p} />`;
        case "fill":
            return html`<${FillQ} q=${q} ...${p} />`;
        case "picture":
            return html`<${PictureChoice} prompt=${q.prompt} options=${q.options} answer=${q.answer} autoSpeak ...${p} />`;
        case "tf":
            return html`<${TrueFalseQ} q=${q} ...${p} />`;
        case "match":
            return html`<${MatchQ} q=${q} ...${p} />`;
        case "order":
            return html`<${OrderQ} q=${q} ...${p} />`;
    }
}
/** Class names for an answer button: right (green) · wrong pick (red, can't be picked again) · hint (glows). */
function choiceLook({ right, out, solved, glow }) {
    if (solved)
        return right ? "!bg-grass ring-4 ring-grass-deep" : "opacity-50";
    if (out)
        return "!bg-berry-soft !opacity-70";
    return glow ? "ring-4 ring-sun-deep motion-safe:animate-glow" : "";
}
/** An answer's text; a wrong pick gets ❌ and is crossed out. */
function ChoiceText({ out, children }) {
    if (!out)
        return html`<${Fragment}>${children}<//>`;
    return (html`<${Fragment}>
      <span aria-hidden className="text-2xl">
        ❌
      </span>
      <span className="line-through decoration-berry-deep decoration-4">${children}</span>
    <//>`);
}
function Prompt({ text, emoji }) {
    return (html`<div className="flex flex-col items-center gap-3 text-center">
      ${emoji && (html`<div className="text-8xl md:text-9xl">
          <${Pic} emoji=${emoji} />
        </div>`)}
      <div className="flex items-center gap-3">
        <p className="font-display text-3xl font-bold">${text}</p>
        <${SpeakButton} text=${text} size=${48} />
      </div>
    </div>`);
}
function ChoiceQ({ prompt, emoji, options, answer, solved, hint, onAnswer }) {
    const [wrong, setWrong] = useState([]);
    const opts = useMemo(() => shuffleOnce(options, prompt + answer), [options, prompt, answer]);
    return (html`<div className="flex flex-col items-center gap-6">
      <${Prompt} text=${prompt} emoji=${emoji} />
      <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        ${opts.map((o) => {
        const out = wrong.includes(o);
        return (html`<${BigButton} key=${o} color="white" size="lg" className=${choiceLook({ right: o === answer, out, solved, glow: hint && o === answer })} disabled=${solved || out} onClick=${() => {
            if (o === answer) {
                speak(o);
                onAnswer(true);
            }
            else {
                setWrong((w) => [...w, o]);
                onAnswer(false);
            }
        }}>
              <${ChoiceText} out=${out}>${o}<//>
            <//>`);
    })}
      </div>
    </div>`);
}
function FillQ({ q, solved, hint, onAnswer }) {
    const [wrong, setWrong] = useState([]);
    const opts = useMemo(() => shuffleOnce(q.options, q.sentence), [q]);
    const [before, after] = q.sentence.split("___");
    const last = wrong[wrong.length - 1];
    return (html`<div className="flex flex-col items-center gap-6">
      <p className="text-center font-display text-3xl font-bold leading-relaxed">
        ${before}
        <span className=${`mx-1 inline-block min-w-24 rounded-xl border-b-4 px-2 ${solved ? "border-grass-deep bg-grass-soft" : last ? "border-berry-deep bg-berry-soft line-through decoration-berry-deep" : "border-ink"}`}>
          ${solved ? q.answer : (last ?? " ")}
        </span>
        ${after}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        ${opts.map((o) => {
        const out = wrong.includes(o);
        return (html`<${BigButton} key=${o} color="white" className=${choiceLook({ right: o === q.answer, out, solved, glow: hint && o === q.answer })} disabled=${solved || out} onClick=${() => {
            if (o === q.answer) {
                speak(q.sentence.replace("___", o));
                onAnswer(true);
            }
            else {
                setWrong((w) => [...w, o]);
                onAnswer(false);
            }
        }}>
              <${ChoiceText} out=${out}>${o}<//>
            <//>`);
    })}
      </div>
    </div>`);
}
export function PictureChoice({ prompt, options, answer, solved, hint, onAnswer, autoSpeak, say, showLabels = false, }) {
    const [wrong, setWrong] = useState([]);
    const opts = useMemo(() => shuffleOnce(options, prompt + answer), [options, prompt, answer]);
    const toSay = say ?? prompt;
    useEffect(() => {
        if (autoSpeak) {
            const t = setTimeout(() => speak(toSay), 350);
            return () => clearTimeout(t);
        }
    }, [autoSpeak, toSay]);
    return (html`<div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <${SpeakButton} text=${toSay} size=${64} />
        <${SpeakButton} text=${toSay} slow size=${52} />
        <p className="font-display text-3xl font-bold">${prompt}</p>
      </div>
      <div className=${`grid w-full max-w-3xl gap-4 ${opts.length === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3"}`}>
        ${opts.map((o) => {
        const right = o.label === answer;
        const out = wrong.includes(o.label);
        return (html`<button key=${o.label} disabled=${solved || out} aria-label=${o.label} onClick=${() => {
            if (right)
                onAnswer(true);
            else {
                setWrong((w) => [...w, o.label]);
                onAnswer(false);
            }
        }} className=${`btn-3d relative flex aspect-square flex-col items-center justify-center rounded-[28px] border-[3px] border-ink bg-paper text-7xl [--shadow:#e3d3ad] md:text-8xl ${solved ? (right ? "!bg-grass-soft ring-8 ring-grass" : "opacity-50") : out ? "!bg-berry-soft opacity-60 ring-8 ring-berry motion-safe:animate-wiggle" : hint && right ? "ring-8 ring-sun-deep motion-safe:animate-glow" : ""}`}>
              <${Pic} emoji=${o.emoji} word=${o.label} scale=${1.55} />
              ${out && (html`<span aria-hidden className="absolute right-2 top-2 text-4xl">
                  ❌
                </span>`)}
              ${(showLabels || solved || out) && html`<span className="mt-1 font-display text-xl">${o.label}</span>`}
            </button>`);
    })}
      </div>
    </div>`);
}
function TrueFalseQ({ q, solved, onAnswer }) {
    const [wrong, setWrong] = useState([]);
    useEffect(() => {
        const t = setTimeout(() => speak(q.statement), 350);
        return () => clearTimeout(t);
    }, [q.statement]);
    const pick = (v) => {
        if (v === q.answer)
            onAnswer(true);
        else {
            setWrong((w) => [...w, v]);
            onAnswer(false);
        }
    };
    const look = (v) => choiceLook({ right: v === q.answer, out: wrong.includes(v), solved, glow: false });
    return (html`<div className="flex flex-col items-center gap-6">
      <${Prompt} text=${q.statement} emoji=${q.emoji} />
      <div className="flex gap-4">
        <${BigButton} color="grass" size="lg" className=${look(true)} disabled=${solved || wrong.includes(true)} onClick=${() => pick(true)}>
          <${ChoiceText} out=${wrong.includes(true)}>👍 Yes<//>
        <//>
        <${BigButton} color="berry" size="lg" className=${look(false)} disabled=${solved || wrong.includes(false)} onClick=${() => pick(false)}>
          <${ChoiceText} out=${wrong.includes(false)}>👎 No<//>
        <//>
      </div>
    </div>`);
}
function MatchQ({ q, solved, hint, onAnswer }) {
    const left = useMemo(() => shuffleOnce(q.pairs, "L" + q.pairs.length), [q]);
    const right = useMemo(() => shuffleOnce(q.pairs, "R" + q.pairs[0].word), [q]);
    const [sel, setSel] = useState(null);
    const [done, setDone] = useState([]);
    const [shake, setShake] = useState(null);
    const pickWord = (word) => {
        if (!sel || done.includes(word))
            return;
        speak(word);
        if (sel === word) {
            sfx("pop");
            const d = [...done, word];
            setDone(d);
            setSel(null);
            if (d.length === q.pairs.length)
                onAnswer(true);
        }
        else {
            setShake(word);
            setTimeout(() => setShake(null), 500);
            onAnswer(false);
        }
    };
    return (html`<div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <p className="font-display text-3xl font-bold">${q.prompt}</p>
        <${SpeakButton} text=${q.prompt} size=${48} />
      </div>
      <div className="grid w-full max-w-2xl grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          ${left.map((p) => (html`<button key=${p.word} disabled=${done.includes(p.word) || solved} onClick=${() => setSel(p.word)} className=${`btn-3d min-h-20 rounded-3xl border-[3px] border-ink text-6xl [--shadow:#e3d3ad] ${done.includes(p.word) ? "bg-grass-soft opacity-70" : sel === p.word ? "bg-sun ring-4 ring-sun-deep" : "bg-paper"}`} aria-label=${`picture ${done.includes(p.word) ? p.word : ""}`}>
              <${Pic} emoji=${p.emoji} word=${p.word} />
            </button>`))}
        </div>
        <div className="flex flex-col gap-3">
          ${right.map((p) => (html`<button key=${p.word} disabled=${done.includes(p.word) || solved} onClick=${() => pickWord(p.word)} className=${`btn-3d min-h-20 rounded-3xl border-[3px] border-ink font-display text-2xl font-bold [--shadow:#e3d3ad] ${done.includes(p.word) ? "bg-grass-soft opacity-70" : "bg-paper"} ${shake === p.word ? "!bg-berry-soft motion-safe:animate-wiggle" : hint && sel === p.word ? "ring-4 ring-sun-deep motion-safe:animate-glow" : ""}`}>
              ${p.word}
            </button>`))}
        </div>
      </div>
      ${!sel && done.length < q.pairs.length && html`<p className="text-lg text-ink-soft">Tap a picture, then its word.</p>`}
    </div>`);
}
function OrderQ({ q, solved, hint, onAnswer }) {
    const chips = useMemo(() => {
        const items = q.words.map((w, idx) => ({ w, idx }));
        let s = shuffleOnce(items, q.words.join("|"));
        if (s.every((c, k) => c.idx === k))
            s = [...s.slice(1), s[0]];
        return s;
    }, [q]);
    const [picked, setPicked] = useState([]);
    /** After a wrong “Check”: the words from here on are shown red, then go back to the pool. */
    const [badFrom, setBadFrom] = useState(null);
    const sentence = picked.map((k) => q.words[k]).join(" ");
    const nextChip = hint && !solved && badFrom === null ? chips.find((c) => !picked.includes(c.idx) && c.w === q.words[picked.length]) : undefined;
    const check = () => {
        if (sentence === q.words.join(" ")) {
            speak(sentence);
            onAnswer(true);
            return;
        }
        let ok = 0;
        while (ok < picked.length && q.words[picked[ok]] === q.words[ok])
            ok++;
        setBadFrom(ok);
        onAnswer(false);
        setTimeout(() => {
            setPicked((p) => p.slice(0, ok));
            setBadFrom(null);
        }, 1200);
    };
    return (html`<div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        ${q.emoji && (html`<span className="text-7xl">
            <${Pic} emoji=${q.emoji} />
          </span>`)}
        <p className="font-display text-3xl font-bold">${q.prompt}</p>
      </div>
      <div className="flex min-h-20 w-full max-w-3xl flex-wrap items-center justify-center gap-2 rounded-3xl border-[3px] border-dashed border-ink bg-paper p-3">
        ${picked.map((k, pos) => (html`<button key=${pos} disabled=${solved || badFrom !== null} onClick=${() => setPicked(picked.filter((_, p) => p !== pos))} className=${`rounded-2xl border-[3px] border-ink px-4 py-2 font-display text-2xl font-bold ${solved ? "bg-grass-soft" : badFrom !== null && pos >= badFrom ? "bg-berry-soft line-through decoration-berry-deep motion-safe:animate-wiggle" : "bg-sun"}`}>
            ${q.words[k]}
          </button>`))}
        ${!picked.length && html`<span className="text-ink-soft">Tap the words below</span>`}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        ${chips.map((c) => (html`<button key=${c.idx} disabled=${picked.includes(c.idx) || solved || badFrom !== null} onClick=${() => {
        sfx("tap");
        setPicked([...picked, c.idx]);
    }} className=${`btn-3d rounded-2xl border-[3px] border-ink bg-paper px-4 py-2 font-display text-2xl font-bold [--shadow:#e3d3ad] disabled:opacity-30 ${nextChip === c ? "ring-4 ring-sun-deep motion-safe:animate-glow" : ""}`}>
            ${c.w}
          </button>`))}
      </div>
      ${picked.length === q.words.length && !solved && badFrom === null && (html`<${BigButton} color="grass" onClick=${check}>
          Check ✔
        <//>`)}
    </div>`);
}
