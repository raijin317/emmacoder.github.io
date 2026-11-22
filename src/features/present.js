import { html } from "@/lib/html.js";
import { useState } from "react";
import { useApi } from "@/lib/client/api.js";
import { Button } from "@/components/ui.js";
import { ErrorBox, Loading, StarRow } from "@/components/kids/index.js";
import { PicturesProvider } from "@/components/Pic.js";
import { ActivityBody } from "./players/ItemPlayer.js";
import { PrintView } from "./print.js";
/** Full-screen presentation for a TV or laptop (no progress is recorded). */
export function PresentScreen({ itemId }) {
    const { data, error } = useApi(`/api/items/${itemId}`);
    const [round, setRound] = useState(0);
    const [last, setLast] = useState(null);
    if (error)
        return html`<${ErrorBox} message=${error} />`;
    if (!data)
        return html`<${Loading} />`;
    return (html`<main className="bg-dots flex min-h-screen flex-col">
      <div className="no-print flex items-center justify-between gap-3 p-3">
        <h1 className="font-display text-2xl font-extrabold">${data.item.title}</h1>
        <div className="flex gap-2">
          <${Button} onClick=${() => document.documentElement.requestFullscreen?.()}>⛶ Full screen<//>
          <${Button} onClick=${() => window.close()}>✖ Close<//>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 text-[110%]">
        ${last !== null ? (html`<div className="flex flex-col items-center gap-4 py-10">
            <${StarRow} stars=${last} size="text-7xl" />
            <${Button} variant="sun" onClick=${() => (setLast(null), setRound((r) => r + 1))}>
              🔁 Again
            <//>
          </div>`) : (html`<${ActivityBody} key=${round} item=${data.item} pictures=${data.pictures} onDone=${(o) => setLast(o.max ? (o.score / o.max >= 0.9 ? 3 : o.score / o.max >= 0.6 ? 2 : 1) : 3)} />`)}
      </div>
    </main>`);
}
export function PrintScreen({ itemId }) {
    const { data, error } = useApi(`/api/items/${itemId}`);
    const [answers, setAnswers] = useState(false);
    if (error)
        return html`<${ErrorBox} message=${error} />`;
    if (!data)
        return html`<${Loading} />`;
    return (html`<main className="min-h-screen bg-cream py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-3 px-2">
        <${Button} variant="primary" onClick=${() => window.print()}>
          🖨️ Print / Save as PDF
        <//>
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" className="h-5 w-5" checked=${answers} onChange=${(e) => setAnswers(e.target.checked)} /> Show answer key
        </label>
      </div>
      <${PicturesProvider} pictures=${data.pictures}>
        <${PrintView} item=${data.item} answers=${answers} />
      <//>
    </main>`);
}
