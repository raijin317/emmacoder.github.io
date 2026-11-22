import { html } from "@/lib/html.js";
import { ApiImg } from "@/components/ApiImg.js";
import Link from "next/link";
import { useRef, useState } from "react";
import { streamSSE } from "@/lib/client/api.js";
/** Runs a server job that streams {msg, progress} events and keeps a short log. */
export function useJob(onFinish) {
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [log, setLog] = useState([]);
    const ctrl = useRef(null);
    const run = async (url, body) => {
        const ac = new AbortController();
        ctrl.current = ac;
        setRunning(true);
        setLog([]);
        setProgress(0);
        try {
            await streamSSE(url, body, (event, data) => {
                const d = (data ?? {});
                if (d.progress !== undefined)
                    setProgress(d.progress);
                const text = d.msg ?? d.message ?? (event === "done" && d.created !== undefined ? `✅ ${d.created} items made.` : undefined);
                if (text)
                    setLog((l) => [...l.slice(-120), `${event === "error" ? "❌ " : ""}${d.book ? `[${d.book}] ` : ""}${text}`]);
            }, ac.signal);
        }
        catch (e) {
            if (!ac.signal.aborted)
                setLog((l) => [...l, "❌ " + e.message]);
        }
        setRunning(false);
        onFinish?.();
    };
    return { running, progress, log, run, cancel: () => ctrl.current?.abort() };
}
import { Badge } from "@/components/ui.js";
import { STAGE_INFO } from "@/lib/assessment.js";
/** Where the family's data lives in the static edition: in this browser, on this device. */
export function LocalDataBadge({ compact = false }) {
    return (html`<span className="inline-flex flex-wrap items-center gap-2">
      <${Badge} tone="grass">💾 Saved in this browser<//>
      ${!compact && (html`<${Link} href="/parent/settings" className="text-sm font-bold underline">
          Backup
        <//>`)}
    </span>`);
}
export function FitBadge({ fit }) {
    if (!fit)
        return null;
    const t = { suitable: ["grass", "✅ Good fit"], challenging: ["orange", "⚠️ Challenging"], easy: ["sky", "💤 Easy"] };
    const [tone, label] = t[fit.level];
    return (html`<span title=${fit.reason}>
      <${Badge} tone=${tone}>${label}<//>
    </span>`);
}
export function AssessmentBadges({ a }) {
    if (!a)
        return html`<${Badge} tone="gray">Not assessed yet<//>`;
    return (html`<span className="inline-flex flex-wrap gap-1">
      <${Badge} tone="sun">
        ${STAGE_INFO[a.stage].emoji} ${STAGE_INFO[a.stage].label}
      <//>
      <${Badge} tone="sky">
        Ages ${a.estimatedAge.min}–${a.estimatedAge.max}
      <//>
      <${Badge} tone="grape">${a.cefr}<//>
    </span>`);
}
export const STATUS_BADGE = {
    new: ["New", "gray"],
    rendering: ["Preparing pages…", "sky"],
    reading: ["Reading contents…", "sky"],
    extracting: ["Reading units…", "sky"],
    generating: ["Making lessons…", "grape"],
    "needs-review": ["Lessons not made yet", "orange"],
    ready: ["Ready to learn", "grass"],
    error: ["Problem", "berry"],
};
export function BookCover({ book, className = "" }) {
    const plain = html`<div className=${`flex items-center justify-center rounded-xl bg-sun-soft text-5xl ${className}`}>${book.isDemo ? "🌞" : "📘"}</div>`;
    if (book.isDemo || !book.pageCount)
        return plain;
    return html`<${ApiImg} src=${`/api/books/${book.id}/pages/1?thumb=1`} fallback=${plain} alt=${`Cover of ${book.title}`} className=${`rounded-xl border-2 border-line object-cover ${className}`} />`;
}
