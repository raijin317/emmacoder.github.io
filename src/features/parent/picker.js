import { html } from "@/lib/html.js";
import { ApiImg } from "@/components/ApiImg.js";
import { useRef, useState } from "react";
import { Button } from "@/components/ui.js";
/**
 * Pick a word's picture straight from the book page: drag a box around the drawing.
 * Coordinates are fractions of the page image, so they work at any screen size.
 */
export function PicturePicker({ bookId, word, pages, maxPage, initial, onPick, onClose, }) {
    const [page, setPage] = useState(initial?.page ?? pages[0] ?? 1);
    const [box, setBox] = useState(initial?.box ?? null);
    const start = useRef(null);
    const frame = useRef(null);
    const at = (e) => {
        const r = frame.current.getBoundingClientRect();
        return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
    };
    const down = (e) => {
        e.preventDefault();
        frame.current.setPointerCapture(e.pointerId);
        start.current = at(e);
        setBox(null);
    };
    const move = (e) => {
        if (!start.current)
            return;
        const p = at(e);
        const s = start.current;
        setBox([Math.min(s.x, p.x), Math.min(s.y, p.y), Math.abs(p.x - s.x), Math.abs(p.y - s.y)]);
    };
    const up = () => {
        start.current = null;
        setBox((b) => (b && b[2] > 0.01 && b[3] > 0.01 ? b : null));
    };
    const go = (p) => {
        setPage(p);
        setBox(p === initial?.page ? initial.box : null);
    };
    return (html`<div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-3" role="dialog" aria-label=${`Picture for ${word}`}>
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-auto rounded-3xl bg-paper p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-xl font-extrabold">
            📷 Picture for “${word}”
          </h2>
          <${Button} disabled=${page <= 1} onClick=${() => go(page - 1)} aria-label="Previous page">
            ◀
          <//>
          <span className="font-bold">
            Page ${page} / ${maxPage}
          </span>
          <${Button} disabled=${page >= maxPage} onClick=${() => go(page + 1)} aria-label="Next page">
            ▶
          <//>
        </div>
        <p className="text-sm text-ink-soft">Drag a box around the picture of the word. The child will see exactly this part of the page.</p>
        <div className="flex flex-wrap gap-1">
          ${pages.map((p) => (html`<button key=${p} onClick=${() => go(p)} className=${`rounded-lg px-2 py-1 text-sm font-bold ${p === page ? "bg-sun" : "bg-cream"}`}>
              p. ${p}
            </button>`))}
        </div>
        <div ref=${frame} onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} className="relative mx-auto w-fit max-w-full cursor-crosshair touch-none select-none overflow-hidden rounded-xl border-2 border-line">
          
          
          <${ApiImg} src=${`/api/books/${bookId}/pages/${page}`} alt=${`Page ${page}`} draggable=${false} className="block max-h-[62vh] max-w-full" />
          ${box && (html`<div className="pointer-events-none absolute rounded-md border-[3px] border-sun shadow-[0_0_0_9999px_rgba(43,45,66,0.45)]" style=${{ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${box[2] * 100}%`, height: `${box[3] * 100}%` }} />`)}
        </div>
        <div className="flex flex-wrap gap-2">
          <${Button} variant="primary" disabled=${!box} onClick=${() => box && onPick({ page, box })}>
            ✅ Use this picture
          <//>
          ${initial && (html`<${Button} variant="danger" onClick=${() => onPick(undefined)}>
              No book picture (use the emoji)
            <//>`)}
          <${Button} onClick=${onClose}>Cancel<//>
        </div>
      </div>
    </div>`);
}
