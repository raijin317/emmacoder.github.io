import { html, Fragment } from "@/lib/html.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { BigButton, KidCard, ProgressDots, SpeakButton, StarRow } from "@/components/kids/index.js";
import { listenOnce, recognitionSupported, speak, speechStars, stopSpeaking } from "@/lib/client/speech.js";
import { sfx } from "@/lib/client/sfx.js";
import { AnswerFeedback, HINT_AFTER, PictureChoice, QuizRunner, sayTryAgain } from "./quiz.js";
import { Pic } from "@/components/Pic.js";
/* ------------------------------ Vocabulary ------------------------------ */
export function VocabularyPlayer({ data, onDone, showVi = false }) {
    const [i, setI] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const w = data.words[i];
    useEffect(() => {
        const t = setTimeout(() => speak(w.word), 300);
        return () => clearTimeout(t);
    }, [w.word]);
    const last = i === data.words.length - 1;
    const go = (n) => {
        setFlipped(false);
        setI(n);
    };
    return (html`<div className="flex flex-col items-center gap-6">
      <${ProgressDots} total=${data.words.length} current=${i} />
      <button key=${i} onClick=${() => {
        setFlipped((f) => !f);
        speak(flipped ? w.word : (w.example ?? w.word));
    }} className="btn-3d flex aspect-[4/3] w-full max-w-xl flex-col items-center justify-center gap-3 rounded-[36px] border-4 border-ink bg-paper p-6 [--shadow:#e3d3ad] motion-safe:animate-pop" aria-label=${`Card: ${w.word}. Tap to flip.`}>
        ${!flipped ? (html`<${Fragment}>
            <span className="text-[8rem] leading-none md:text-[10rem]">
              <${Pic} emoji=${w.emoji} word=${w.word} scale=${1.25} />
            </span>
            <span className="font-display text-5xl font-extrabold md:text-6xl">${w.word}</span>
          <//>`) : (html`<${Fragment}>
            <span className="text-7xl">
              <${Pic} emoji=${w.emoji} word=${w.word} />
            </span>
            <span className="text-center font-display text-3xl font-bold md:text-4xl">${w.example ?? w.word}</span>
            ${showVi && w.vi && html`<span className="text-lg text-ink-soft">🇻🇳 ${w.vi}</span>`}
          <//>`)}
      </button>
      <div className="flex items-center gap-3">
        <${SpeakButton} text=${w.word} size=${64} />
        <${SpeakButton} text=${w.word} slow size=${56} />
        ${w.example && html`<${SpeakButton} text=${w.example} label=${`Listen to the sentence: ${w.example}`} size=${56} className="!bg-sun" />`}
      </div>
      <div className="flex gap-4">
        <${BigButton} color="white" disabled=${i === 0} onClick=${() => go(i - 1)}>
          ◀ Back
        <//>
        ${!last ? (html`<${BigButton} color="sun" onClick=${() => go(i + 1)}>
            Next ▶
          <//>`) : (onDone && (html`<${BigButton} color="grass" onClick=${() => onDone({ score: data.words.length, max: data.words.length, missed: [] })}>
              Done ⭐
            <//>`))}
      </div>
    </div>`);
}
/* ------------------------------ Listening ------------------------------ */
export function ListeningPlayer({ data, onDone }) {
    const [i, setI] = useState(0);
    const [misses, setMisses] = useState(0);
    const [solved, setSolved] = useState(false);
    const [results, setResults] = useState([]);
    const t = data.tasks[i];
    return (html`<div className="flex flex-col gap-6">
      ${data.intro && i === 0 && html`<p className="text-center font-display text-2xl">${data.intro}</p>`}
      <${ProgressDots} total=${data.tasks.length} current=${i} results=${results} />
      <div key=${i} className="motion-safe:animate-pop">
        <${PictureChoice} prompt=${t.question} say=${t.say} options=${t.options} answer=${t.answer} solved=${solved} hint=${misses >= HINT_AFTER} autoSpeak onAnswer=${(ok) => {
        if (solved)
            return;
        if (!ok) {
            setMisses((m) => m + 1);
            sayTryAgain(t.say); // …and listen once more
            return;
        }
        sfx("correct");
        setSolved(true);
        setResults((r) => [...r, misses === 0]);
    }} />
      </div>
      <div className="flex flex-col items-center gap-3">
        <${AnswerFeedback} misses=${misses} solved=${solved} />
        ${solved && (html`<${Fragment}>
            <p className="text-xl">
              You heard: <b>“${t.say}”</b>
            </p>
            <${BigButton} color="grass" size="lg" autoFocus onClick=${() => {
        if (i + 1 >= data.tasks.length) {
            onDone({ score: results.filter(Boolean).length, max: data.tasks.length, missed: data.tasks.filter((_, k) => !results[k]).map((x) => x.answer) });
        }
        else {
            setI(i + 1);
            setMisses(0);
            setSolved(false);
        }
    }}>
              ${i + 1 >= data.tasks.length ? "Finish ⭐" : "Next ➜"}
            <//>
          <//>`)}
      </div>
    </div>`);
}
/* ------------------------------- Speaking ------------------------------- */
/**
 * Records the microphone while the child speaks, so they can hear themselves afterwards.
 * The recording only lives in this page's memory (a blob: URL) — never saved or uploaded.
 */
async function startRecording() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia)
        return null;
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    }
    catch {
        return null;
    }
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start();
    return {
        stop: () => new Promise((resolve) => {
            const finish = () => {
                stream.getTracks().forEach((t) => t.stop());
                resolve(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })) : null);
            };
            if (rec.state === "inactive")
                return finish();
            rec.onstop = finish;
            rec.stop();
        }),
    };
}
export function SpeakingPlayer({ data, onDone }) {
    const [i, setI] = useState(0);
    const [stars, setStars] = useState([]);
    const [state, setState] = useState("idle");
    const [heard, setHeard] = useState("");
    const [error, setError] = useState(null);
    /** The child's own voice for this prompt (memory only; dropped on Next / leaving). */
    const [myVoice, setMyVoice] = useState(null);
    const [playingMe, setPlayingMe] = useState(false);
    const voiceRef = useRef(null);
    const player = useRef(null);
    const stopRec = useRef(null);
    const canRecognize = useMemo(() => recognitionSupported(), []);
    const p = data.prompts[i];
    const model = p.mode === "answer" && p.question ? p.question : p.text;
    useEffect(() => {
        const t = setTimeout(() => speak(model), 400);
        return () => clearTimeout(t);
    }, [i, model]);
    /** Forget the recording: stop playback and free the memory. */
    const dropVoice = () => {
        player.current?.pause();
        player.current = null;
        setPlayingMe(false);
        if (voiceRef.current)
            URL.revokeObjectURL(voiceRef.current);
        voiceRef.current = null;
        setMyVoice(null);
    };
    const keepVoice = (url) => {
        if (voiceRef.current)
            URL.revokeObjectURL(voiceRef.current);
        voiceRef.current = url;
        setMyVoice(url);
    };
    // Leaving the activity (Back, Home, Finish) deletes the recording too.
    useEffect(() => () => {
        stopRec.current?.();
        player.current?.pause();
        if (voiceRef.current)
            URL.revokeObjectURL(voiceRef.current);
    }, []);
    const goNext = () => {
        dropVoice();
        setState("idle");
        setHeard("");
        setI(i + 1);
    };
    const give = (s) => {
        setStars((arr) => {
            const n = [...arr];
            n[i] = Math.max(n[i] ?? 0, s);
            return n;
        });
    };
    const tryRecognize = async () => {
        setError(null);
        stopSpeaking();
        dropVoice();
        setState("listening");
        // Record at the same time as the speech check, so the child can listen to themselves.
        const rec = await startRecording();
        stopRec.current = () => void rec?.stop().then((u) => u && URL.revokeObjectURL(u));
        try {
            const alts = await listenOnce();
            const s = speechStars(p.text, alts);
            setHeard(alts[0] ?? "");
            give(Math.max(1, s));
            sfx(s >= 2 ? "correct" : "tap");
            setState("heard");
        }
        catch (e) {
            setError(e.message);
            setState("idle");
        }
        finally {
            stopRec.current = null;
            keepVoice((await rec?.stop()) ?? null);
        }
    };
    const tryRecord = async () => {
        setError(null);
        stopSpeaking();
        dropVoice();
        const rec = await startRecording();
        if (!rec) {
            setError("Please allow the microphone.");
            return;
        }
        let stopped = false;
        const stop = async () => {
            if (stopped)
                return;
            stopped = true;
            stopRec.current = null;
            keepVoice(await rec.stop());
            setState("heard");
            give(3);
        };
        stopRec.current = () => void stop();
        setState("recording");
        setTimeout(() => void stop(), 5000);
    };
    const hearMyself = () => {
        if (!myVoice)
            return;
        stopSpeaking();
        player.current?.pause();
        const a = new Audio(myVoice);
        player.current = a;
        setPlayingMe(true);
        a.onended = a.onerror = () => setPlayingMe(false);
        void a.play().catch(() => setPlayingMe(false));
    };
    const s = stars[i] ?? 0;
    return (html`<div className="flex flex-col items-center gap-6">
      <${ProgressDots} total=${data.prompts.length} current=${i} results=${stars.map((x) => (x ? x >= 2 : undefined))} />
      <${KidCard} className="flex w-full max-w-2xl flex-col items-center gap-4 text-center">
        ${p.emoji && (html`<span className="text-8xl">
            <${Pic} emoji=${p.emoji} word=${p.text} />
          </span>`)}
        ${p.mode === "answer" && p.question && html`<p className="font-display text-2xl text-ink-soft">${p.question}</p>`}
        <p className="font-display text-4xl font-extrabold">${p.text}</p>
        ${p.hint && html`<p className="text-ink-soft">${p.hint}</p>`}
        <div className="flex gap-3">
          <${SpeakButton} text=${model} size=${64} />
          <${SpeakButton} text=${p.text} slow size=${56} />
        </div>
      <//>

      <div className="flex flex-col items-center gap-3">
        ${state === "recording" ? (html`<${BigButton} color="berry" size="lg" onClick=${() => stopRec.current?.()}>
            ⏹ I'm done
          <//>`) : (html`<${BigButton} color="berry" size="lg" disabled=${state === "listening"} onClick=${canRecognize ? tryRecognize : tryRecord}>
            ${state === "listening" ? "🎙️ Listening…" : state === "heard" ? "🎤 Say it again" : "🎤 Now you say it!"}
          <//>`)}
        ${state === "heard" && (html`<div className="flex flex-col items-center gap-2 motion-safe:animate-pop">
            <${StarRow} stars=${s} />
            ${heard && html`<p className="text-lg text-ink-soft">I heard: “${heard}”</p>`}
          </div>`)}
        ${myVoice && state !== "listening" && state !== "recording" && (html`<div className="flex flex-wrap items-center justify-center gap-3 motion-safe:animate-pop">
            <${BigButton} color="sun" onClick=${hearMyself} className=${playingMe ? "motion-safe:animate-wiggle" : ""} aria-label="Listen to my voice">
              👂 Hear myself
            <//>
            <${SpeakButton} text=${p.text} label=${`Listen to the teacher: ${p.text}`} size=${56} />
          </div>`)}
        ${error && html`<p className="text-berry-deep">${error}</p>`}
      </div>

      <div className="flex gap-3">
        <${BigButton} color="white" size="sm" disabled=${state === "listening" || state === "recording"} onClick=${() => (give(1), setState("heard"))}>
          Skip
        <//>
        ${(state === "heard" || s > 0) && (html`<${BigButton} color="grass" onClick=${() => {
        if (i + 1 >= data.prompts.length) {
            const total = data.prompts.reduce((a, _, k) => a + (stars[k] ?? 0), 0);
            onDone({ score: total, max: data.prompts.length * 3, missed: data.prompts.filter((_, k) => (stars[k] ?? 0) < 2).map((x) => x.text) });
        }
        else
            goNext();
    }}>
            ${i + 1 >= data.prompts.length ? "Finish ⭐" : "Next ➜"}
          <//>`)}
      </div>
    </div>`);
}
/* ------------------------------- Grammar -------------------------------- */
export function GrammarPlayer({ data, onDone }) {
    const [phase, setPhase] = useState("learn");
    const parts = data.pattern.split(/(_{2,})/);
    if (phase === "practice" && data.practice.length)
        return html`<${QuizRunner} questions=${data.practice} onDone=${onDone} />`;
    return (html`<div className="flex flex-col items-center gap-6">
      <${KidCard} className="w-full max-w-2xl text-center">
        <p className="font-display text-4xl font-extrabold">
          ${parts.map((p, k) => /^_+$/.test(p) ? (html`<span key=${k} className="mx-1 inline-block min-w-20 rounded-xl bg-sun px-3">
                ?
              </span>`) : (html`<span key=${k} className="text-orange-deep">
                ${p}
              </span>`))}
        </p>
        <p className="mt-3 text-xl">${data.explanation}</p>
      <//>
      <div className="grid w-full max-w-2xl gap-3">
        ${data.examples.map((e) => (html`<button key=${e.text} onClick=${() => speak(e.text)} className="btn-3d flex items-center gap-4 rounded-3xl border-[3px] border-ink bg-paper p-4 text-left [--shadow:#e3d3ad]">
            <span className="text-5xl">${e.emoji ? html`<${Pic} emoji=${e.emoji} />` : "💬"}</span>
            <span className="font-display text-3xl font-bold">${e.text}</span>
            <span className="ml-auto text-2xl">🔊</span>
          </button>`))}
      </div>
      <${BigButton} color="grass" size="lg" onClick=${() => (data.practice.length ? setPhase("practice") : onDone({ score: 1, max: 1, missed: [] }))}>
        ${data.practice.length ? "Let's practice ➜" : "Done ⭐"}
      <//>
    </div>`);
}
/* ------------------------------- Reading -------------------------------- */
export function ReadingPlayer({ data, onDone }) {
    const [phase, setPhase] = useState("read");
    const [hl, setHl] = useState(-1);
    /** A tapped word / "Read to me" whose voice is still being made (shown as waiting, so the tap never feels lost). */
    const [waiting, setWaiting] = useState(null);
    const run = useRef(0);
    // Words with their position in the passage and their line (book texts keep their line breaks).
    const tokens = useMemo(() => {
        const out = [];
        const re = /\S+/g;
        let m;
        while ((m = re.exec(data.passage)))
            out.push({ text: m[0], start: m.index, line: data.passage.slice(0, m.index).split("\n").length - 1 });
        return out;
    }, [data.passage]);
    const lines = useMemo(() => {
        const byLine = [];
        tokens.forEach((token, k) => (byLine[token.line] ??= []).push({ token, k }));
        return byLine.filter(Boolean);
    }, [tokens]);
    const multiLine = lines.length > 1;
    const readAloud = () => {
        const me = ++run.current;
        setWaiting("all");
        speak(data.passage, {
            onStart: () => run.current === me && setWaiting(null),
            onBoundary: (ci) => setHl(tokens.findLastIndex((t) => t.start <= ci)),
            onDone: () => {
                if (run.current !== me)
                    return;
                setWaiting(null);
                setHl(-1);
            },
        });
    };
    const sayWord = (k, word) => {
        const me = ++run.current;
        setWaiting(k);
        setHl(k);
        speak(word, {
            onStart: () => run.current === me && setWaiting(null),
            onDone: () => {
                if (run.current !== me)
                    return;
                setWaiting(null);
                setHl(-1);
            },
        });
    };
    if (phase === "questions")
        return html`<${QuizRunner} questions=${data.questions} onDone=${onDone} />`;
    return (html`<div className="flex flex-col items-center gap-6">
      <${KidCard} className="w-full max-w-3xl">
        ${data.emoji && (html`<div className="mb-2 text-center text-7xl">
            <${Pic} emoji=${data.emoji} />
          </div>`)}
        <div className=${`font-display text-3xl leading-[1.8] ${multiLine ? "mx-auto flex w-fit flex-col items-start" : "text-center"}`}>
          ${lines.map((line, n) => (html`<p key=${n}>
              ${line.map(({ token: t, k }) => (html`<span key=${k}>
                  <button onClick=${() => sayWord(k, t.text.replace(/[^\w'-]/g, ""))} aria-busy=${waiting === k} className=${`rounded-lg px-0.5 ${waiting === k ? "bg-sun-soft motion-safe:animate-pulse" : k === hl ? "bg-sun" : "hover:bg-sun-soft"} ${/^[A-Z][a-z]+:$/.test(t.text) ? "font-extrabold text-sky-deep" : ""}`}>
                    ${t.text}
                  </button>${" "}
                </span>`))}
            </p>`))}
        </div>
      <//>
      <div className="flex flex-wrap justify-center gap-3">
        <${BigButton} color="sky" onClick=${readAloud} aria-busy=${waiting === "all"} className=${waiting === "all" ? "motion-safe:animate-pulse" : ""}>
          ${waiting === "all" ? "⏳ Getting ready…" : "🔊 Read to me"}
        <//>
        <${BigButton} color="grass" onClick=${() => (stopSpeaking(), setPhase("questions"))}>
          Questions ➜
        <//>
      </div>
      <p className="text-ink-soft">Tap any word to hear it.</p>
    </div>`);
}
/* --------------------------------- Test --------------------------------- */
export function TestPlayer({ data, onDone }) {
    const { questions, labels } = useMemo(() => {
        const q = data.sections.flatMap((s) => s.questions);
        const l = data.sections.flatMap((s) => s.questions.map(() => s.title));
        return { questions: q, labels: l };
    }, [data]);
    return html`<${QuizRunner} questions=${questions} labels=${labels} onDone=${onDone} />`;
}
/* ------------------------------ Quiz wrapper ----------------------------- */
export function QuizPlayer({ data, onDone }) {
    return html`<${QuizRunner} questions=${data.questions} onDone=${onDone} />`;
}
export function useElapsed() {
    const start = useRef(0);
    useEffect(() => {
        start.current = Date.now();
    }, []);
    return () => (Date.now() - start.current) / 1000;
}
