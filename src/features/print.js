import { html } from "@/lib/html.js";
import { useMemo } from "react";
import { TYPE_META } from "@/lib/contentMeta.js";
import { shuffleOnce } from "./players/quiz.js";
import { Pic } from "@/components/Pic.js";
/* A4 print renderers for the parent (Worksheet, Lesson plan, Quiz/Test, Flashcards). */
function Sheet({ title, subtitle, children, nameLine = true }) {
    return (html`<article className="print-page mx-auto mb-8 w-full max-w-[210mm] rounded-2xl border-2 border-line bg-white p-8 text-ink shadow-sm">
      <header className="mb-6 flex items-start justify-between gap-4 border-b-4 border-dotted border-sun pb-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">${title}</h1>
          ${subtitle && html`<p className="text-ink-soft">${subtitle}</p>`}
        </div>
        <span className="text-right">
          <span className="block text-4xl">🍀</span>
          <span className="text-xs font-bold text-ink-soft">Emma English Studio</span>
        </span>
      </header>
      ${nameLine && (html`<p className="mb-6 text-lg">
          Name: <span className="inline-block w-56 border-b-2 border-ink" />   Date: <span className="inline-block w-32 border-b-2 border-ink" />
        </p>`)}
      ${children}
    </article>`);
}
function Section({ n, title, children }) {
    return (html`<section className="mb-8 break-inside-avoid">
      <h2 className="mb-3 font-display text-2xl font-bold">
        <span className="mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-sun">${n}</span>
        ${title}
      </h2>
      ${children}
    </section>`);
}
/* ------------------------------ word search ------------------------------ */
export function makeWordSearch(words, seed, size = 10) {
    const W = words.map((w) => w.toUpperCase().replace(/[^A-Z]/g, "")).filter((w) => w.length >= 2 && w.length <= size);
    const grid = Array.from({ length: size }, () => Array(size).fill(""));
    let h = 7;
    for (const c of seed)
        h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
    const dirs = [
        [0, 1],
        [1, 0],
        [1, 1],
    ];
    const placed = [];
    for (const w of W) {
        for (let tries = 0; tries < 200; tries++) {
            const [dr, dc] = dirs[Math.floor(rnd() * dirs.length)];
            const r0 = Math.floor(rnd() * (size - dr * (w.length - 1)));
            const c0 = Math.floor(rnd() * (size - dc * (w.length - 1)));
            let ok = true;
            for (let k = 0; k < w.length; k++) {
                const cell = grid[r0 + dr * k][c0 + dc * k];
                if (cell && cell !== w[k])
                    ok = false;
            }
            if (!ok)
                continue;
            for (let k = 0; k < w.length; k++)
                grid[r0 + dr * k][c0 + dc * k] = w[k];
            placed.push(w);
            break;
        }
    }
    const abc = "ABCDEFGHIKLMNOPRSTUWY";
    for (const row of grid)
        for (let c = 0; c < size; c++)
            if (!row[c])
                row[c] = abc[Math.floor(rnd() * abc.length)];
    return { grid, placed };
}
/* ------------------------------- worksheet ------------------------------- */
function WorksheetSectionView({ s, n, answers, seed }) {
    switch (s.kind) {
        case "trace":
            return (html`<${Section} n=${n} title=${s.title}>
          <div className="flex flex-col gap-3">
            ${s.words.map((w) => (html`<div key=${w} className="flex items-center gap-6 border-b border-dashed border-line pb-2">
                <span className="trace-text text-5xl">${w}</span>
                <span className="trace-text text-5xl opacity-60">${w}</span>
                <span className="ml-auto inline-block w-48 border-b-2 border-ink" />
              </div>`))}
          </div>
        <//>`);
        case "match": {
            const right = shuffleOnce(s.pairs, seed + "m");
            return (html`<${Section} n=${n} title=${s.title}>
          <div className="grid grid-cols-2 gap-x-24 gap-y-4">
            ${s.pairs.map((p, k) => (html`<div key=${"l" + k} className="contents">
                <div className="flex items-center justify-end gap-3 text-5xl">
                  <${Pic} emoji=${p.emoji} word=${p.word} /> <span className="h-4 w-4 rounded-full border-2 border-ink" />
                </div>
                <div className="flex items-center gap-3 font-display text-2xl">
                  <span className="h-4 w-4 rounded-full border-2 border-ink" /> ${right[k].word}
                  ${answers && (html`<span className="text-base text-grass-deep">
                      (→ <${Pic} emoji=${right[k].emoji} word=${right[k].word} />)
                    </span>`)}
                </div>
              </div>`))}
          </div>
        <//>`);
        }
        case "fill":
            return (html`<${Section} n=${n} title=${s.title}>
          ${s.wordBank && html`<p className="mb-3 rounded-xl border-2 border-dashed border-ink p-2 text-center font-display text-xl">${s.wordBank.join("   •   ")}</p>`}
          <ol className="flex list-decimal flex-col gap-4 pl-8 font-display text-2xl">
            ${s.items.map((it, k) => (html`<li key=${k}>${it.sentence.replace(/_{2,}/, answers ? `[${it.answer}]` : "________")}</li>`))}
          </ol>
        <//>`);
        case "circle":
            return (html`<${Section} n=${n} title=${s.title}>
          <div className="grid grid-cols-2 gap-6">
            ${s.items.map((it, k) => (html`<div key=${k} className="flex items-center gap-4">
                <span className="text-6xl">
                  <${Pic} emoji=${it.emoji} word=${it.answer} />
                </span>
                <div className="flex flex-wrap gap-3 font-display text-2xl">
                  ${it.options.map((o) => (html`<span key=${o} className=${`rounded-full px-2 ${answers && o === it.answer ? "ring-4 ring-grass" : ""}`}>
                      ${o}
                    </span>`))}
                </div>
              </div>`))}
          </div>
        <//>`);
        case "wordsearch":
            return html`<${WordSearchView} s=${s} n=${n} answers=${answers} seed=${seed} />`;
        case "draw":
            return (html`<${Section} n=${n} title=${s.title}>
          <p className="mb-2 font-display text-xl">${s.prompt}</p>
          <div className="h-72 rounded-3xl border-4 border-dashed border-ink" />
        <//>`);
    }
}
function WordSearchView({ s, n, answers, seed }) {
    const { grid, placed } = useMemo(() => makeWordSearch(s.words, seed), [s.words, seed]);
    return (html`<${Section} n=${n} title=${s.title}>
      <div className="flex flex-wrap items-start gap-8">
        <table className="border-collapse font-display text-2xl">
          <tbody>
            ${grid.map((row, r) => (html`<tr key=${r}>
                ${row.map((c, k) => (html`<td key=${k} className="h-10 w-10 border border-line text-center">
                    ${c}
                  </td>`))}
              </tr>`))}
          </tbody>
        </table>
        <ul className="font-display text-2xl">
          ${placed.map((w) => (html`<li key=${w}>☐ ${w.toLowerCase()}</li>`))}
        </ul>
      </div>
      ${answers && html`<p className="mt-2 text-sm text-ink-soft">Words go → across, ↓ down or ↘ diagonally.</p>`}
    <//>`);
}
export function WorksheetPrint({ item, answers }) {
    const d = item.data;
    return (html`<${Sheet} title=${item.title} subtitle=${d.instructions}>
      ${d.sections.map((s, k) => (html`<${WorksheetSectionView} key=${k} s=${s} n=${k + 1} answers=${answers} seed=${item.id + k} />`))}
    <//>`);
}
/* ------------------------------ quiz / test ------------------------------ */
function PrintQuestion({ q, n, answers }) {
    const ans = (t) => (answers ? html`<span className="ml-2 text-base font-bold text-grass-deep">✔ ${t}</span>` : null);
    const box = html`<span className="mr-2 inline-block h-5 w-5 rounded border-2 border-ink align-middle" />`;
    switch (q.kind) {
        case "mc":
            return (html`<li className="break-inside-avoid">
          ${q.emoji && (html`<span className="mr-2 text-4xl">
              <${Pic} emoji=${q.emoji} />
            </span>`)}
          ${q.prompt}
          <div className="mt-2 flex flex-wrap gap-6 pl-4">
            ${q.options.map((o) => (html`<span key=${o}>
                ${box}
                ${o}
              </span>`))}
          </div>
          ${ans(q.answer)}
        </li>`);
        case "picture":
            return (html`<li className="break-inside-avoid">
          🎧 Parent reads: “${q.prompt}” — tick the picture.
          <div className="mt-2 flex gap-8 pl-4 text-5xl">
            ${q.options.map((o) => (html`<span key=${o.label}>
                ${box}
                <${Pic} emoji=${o.emoji} word=${o.label} />
              </span>`))}
          </div>
          ${ans(q.answer)}
        </li>`);
        case "tf":
            return (html`<li className="break-inside-avoid">
          ${q.emoji && (html`<span className="mr-2 text-4xl">
              <${Pic} emoji=${q.emoji} />
            </span>`)}
          ${q.statement}   ${box}Yes ${box}No ${ans(q.answer ? "Yes" : "No")}
        </li>`);
        case "fill":
            return (html`<li className="break-inside-avoid">
          ${q.sentence.replace("___", "________")} <span className="text-ink-soft">(${q.options.join(" / ")})</span> ${ans(q.answer)}
        </li>`);
        case "match":
            return (html`<li className="break-inside-avoid">
          ${q.prompt}
          <div className="mt-2 grid grid-cols-2 gap-2 pl-4">
            ${q.pairs.map((p, k) => (html`<div key=${k} className="contents">
                <span className="text-4xl">
                  <${Pic} emoji=${p.emoji} word=${p.word} /> •
                </span>
                <span>• ${shuffleOnce(q.pairs, "p" + n)[k].word}</span>
              </div>`))}
          </div>
          ${ans(q.pairs.map((p) => p.word).join(", "))}
        </li>`);
        case "order":
            return (html`<li className="break-inside-avoid">
          ${q.prompt} ${q.emoji && html`<${Pic} emoji=${q.emoji} />`}
          <p className="pl-4 text-ink-soft">${shuffleOnce(q.words, "o" + n).join(" / ")}</p>
          <p className="pl-4">____________________________________</p>
          ${ans(q.words.join(" "))}
        </li>`);
    }
}
export function QuizPrint({ title, sections, answers, minutes }) {
    let n = 0;
    return (html`<${Sheet} title=${title} subtitle=${minutes ? `Time: ${minutes} minutes` : undefined}>
      ${sections.map((s, k) => (html`<${Section} key=${k} n=${k + 1} title=${s.title}>
          <ol className="flex list-decimal flex-col gap-5 pl-8 font-display text-xl">
            ${s.questions.map((q) => (html`<${PrintQuestion} key=${n} q=${q} n=${++n} answers=${answers} />`))}
          </ol>
        <//>`))}
    <//>`);
}
/* ------------------------------ lesson plan ------------------------------ */
const STAGE_ICON = { "warm-up": "☀️", learn: "💡", practice: "🔁", play: "🎲", review: "⭐" };
export function LessonPlanView({ title, data }) {
    return (html`<${Sheet} title=${title} subtitle=${`${data.minutes}-minute home session`} nameLine=${false}>
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-grass-soft p-4">
          <h3 className="font-display text-xl font-bold">🎯 Goals</h3>
          <ul className="list-disc pl-6">
            ${data.objectives.map((o) => (html`<li key=${o}>${o}</li>`))}
          </ul>
        </div>
        <div className="rounded-2xl bg-sky-soft p-4">
          <h3 className="font-display text-xl font-bold">🧺 You need</h3>
          <ul className="list-disc pl-6">
            ${data.materials.map((o) => (html`<li key=${o}>${o}</li>`))}
          </ul>
        </div>
      </div>
      <ol className="flex flex-col gap-4">
        ${data.steps.map((s, k) => (html`<li key=${k} className="break-inside-avoid rounded-2xl border-2 border-line p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold capitalize">
                ${STAGE_ICON[s.stage]} ${k + 1}. ${s.stage} — ${s.activity}
              </h3>
              <span className="rounded-full bg-sun-soft px-3 font-bold">${s.minutes} min</span>
            </div>
            <p className="mt-2">
              <b>You:</b> ${s.parentScript}
            </p>
          </li>`))}
      </ol>
    <//>`);
}
/* ------------------------------- flashcards ------------------------------ */
export function FlashcardsPrint({ title, data }) {
    return (html`<${Sheet} title=${`${title} — cut-out cards`} nameLine=${false}>
      <div className="grid grid-cols-2 gap-0">
        ${data.words.map((w) => (html`<div key=${w.word} className="flex aspect-[3/2] flex-col items-center justify-center border-2 border-dashed border-ink-soft">
            <span className="text-7xl">
              <${Pic} emoji=${w.emoji} word=${w.word} scale=${1.4} />
            </span>
            <span className="font-display text-4xl font-bold">${w.word}</span>
          </div>`))}
      </div>
    <//>`);
}
export function PrintView({ item, answers }) {
    switch (item.type) {
        case "worksheet":
            return html`<${WorksheetPrint} item=${item} answers=${answers} />`;
        case "lessonPlan":
            return html`<${LessonPlanView} title=${item.title} data=${item.data} />`;
        case "test": {
            const d = item.data;
            return html`<${QuizPrint} title=${item.title} sections=${d.sections} answers=${answers} minutes=${d.minutes} />`;
        }
        case "quiz":
            return html`<${QuizPrint} title=${item.title} sections=${[{ title: "Questions", questions: item.data.questions }]} answers=${answers} />`;
        case "vocabulary":
            return html`<${FlashcardsPrint} title=${item.title} data=${item.data} />`;
        default:
            return html`<p className="p-8">${TYPE_META[item.type].label} can't be printed. Open it on screen instead.</p>`;
    }
}
