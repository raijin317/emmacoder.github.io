import { html } from "@/lib/html.js";
import { useEffect, useRef, useState } from "react";
import { TYPE_META } from "@/lib/contentMeta.js";
import { BigButton, Celebration } from "@/components/kids/index.js";
import { api } from "@/lib/client/api.js";
import { prefetchSpeech, stopSpeaking } from "@/lib/client/speech.js";
import { commonSpeakables, speakablesFor } from "@/lib/speakables.js";
import { PicturesProvider } from "@/components/Pic.js";
import { loadApiImage } from "@/components/ApiImg.js";
import { LessonPlanView } from "../print.js";
import { GamePlayer } from "./games.js";
import { GrammarPlayer, ListeningPlayer, QuizPlayer, ReadingPlayer, SpeakingPlayer, TestPlayer, VocabularyPlayer } from "./activities.js";
export function ActivityBody({ item, onDone, showVi, pictures, prefetch = true, round = 0, }) {
    // Warm up the natural voice for everything this activity can say (+ "Oops! Try again." and the praise lines).
    useEffect(() => {
        if (!prefetch)
            return;
        const ac = new AbortController();
        prefetchSpeech([...speakablesFor(item), ...commonSpeakables()], ac.signal);
        return () => ac.abort();
    }, [item, prefetch]);
    // …and the book pictures, so they appear instantly.
    useEffect(() => {
        for (const url of new Set(Object.values(pictures ?? {})))
            void loadApiImage(url);
    }, [pictures]);
    return (html`<${PicturesProvider} pictures=${pictures}>
      <${Body} item=${item} onDone=${onDone} showVi=${showVi} round=${round} />
    <//>`);
}
function Body({ item, onDone, showVi, round = 0 }) {
    const d = item.data;
    switch (item.type) {
        case "vocabulary":
            return html`<${VocabularyPlayer} data=${d} onDone=${onDone} showVi=${showVi} />`;
        case "listening":
            return html`<${ListeningPlayer} data=${d} onDone=${onDone} />`;
        case "speaking":
            return html`<${SpeakingPlayer} data=${d} onDone=${onDone} />`;
        case "grammar":
            return html`<${GrammarPlayer} data=${d} onDone=${onDone} />`;
        case "reading":
            return html`<${ReadingPlayer} data=${d} onDone=${onDone} />`;
        case "quiz":
            return html`<${QuizPlayer} data=${d} onDone=${onDone} />`;
        case "test":
            return html`<${TestPlayer} data=${d} onDone=${onDone} />`;
        case "game":
            // Another order on "Play again" (round), so a game doesn't repeat itself.
            return html`<${GamePlayer} data=${d} onDone=${onDone} seed=${round ? `${item.id}#${round}` : item.id} stage=${item.stage} />`;
        case "lessonPlan":
            return html`<${LessonPlanView} title=${item.title} data=${d} />`;
        case "worksheet":
            return html`<p className="text-center text-xl">Worksheets are printed by your parent ✏️</p>`;
    }
}
/** Plays one item; records the attempt when a child is playing. */
export function ItemPlayer({ item, childId, onExit, onAgain, pictures }) {
    const [result, setResult] = useState(null);
    const [round, setRound] = useState(0);
    const started = useRef(0);
    const meta = TYPE_META[item.type];
    const done = async (o) => {
        stopSpeaking();
        const ratio = o.max ? o.score / o.max : 1;
        const localStars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
        if (!childId)
            return setResult({ stars: localStars, newStickers: [] });
        try {
            const r = await api("/api/attempts", {
                body: { childId, itemId: item.id, score: o.score, maxScore: o.max, durationSec: started.current ? (Date.now() - started.current) / 1000 : 0, missed: o.missed },
            });
            setResult(r);
        }
        catch {
            setResult({ stars: localStars, newStickers: [] });
        }
    };
    useEffect(() => {
        started.current = Date.now();
    }, [round]);
    if (result)
        return (html`<${Celebration} stars=${result.stars} newStickers=${result.newStickers} newTrophies=${result.newTrophies} level=${result.level}>
        <div className="flex flex-wrap justify-center gap-3">
          <${BigButton} color="sun" onClick=${() => {
            setResult(null);
            setRound((r) => r + 1);
            onAgain?.();
        }}>
            🔁 Play again
          <//>
          ${onExit && (html`<${BigButton} color="grass" onClick=${onExit}>
              ✅ Back
            <//>`)}
        </div>
      <//>`);
    return (html`<div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-3">
        <span className=${`inline-flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-ink text-2xl ${meta.bg}`}>${meta.icon}</span>
        <h1 className="font-display text-3xl font-extrabold md:text-4xl">${item.title}</h1>
      </div>
      <${ActivityBody} key=${round} item=${item} onDone=${done} pictures=${pictures} round=${round} />
    </div>`);
}
