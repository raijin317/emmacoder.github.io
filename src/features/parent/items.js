import { html, Fragment } from "@/lib/html.js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { api, useApi } from "@/lib/client/api.js";
import { validateItemData } from "@/lib/schemas/content.js";
import { GAMES } from "@/lib/games.js";
import { ContentForm } from "./editor.js";
import { PicturesProvider } from "@/components/Pic.js";
import { Badge, Button, LinkButton, PageHeader, Panel, inputCls } from "@/components/ui.js";
import { ErrorBox, Loading } from "@/components/kids/index.js";
import { PRINTABLE_TYPES, TYPE_META, GAME_LABEL } from "@/lib/contentMeta.js";
import { CONTENT_TYPES } from "@/lib/types.js";
import { ActivityBody } from "../players/ItemPlayer.js";
/** Grouped list of practice items with review actions (used for units and inspiration topics). */
export function ItemList({ items, onChange }) {
    const drafts = items.filter((i) => i.status === "draft");
    const act = async (id, body) => {
        if (body === null)
            await api(`/api/items/${id}`, { method: "DELETE" });
        else
            await api(`/api/items/${id}`, { method: "PATCH", body });
        onChange();
    };
    if (!items.length)
        return html`<p className="text-ink-soft">No practice items yet. Generate a pack above.</p>`;
    return (html`<div className="flex flex-col gap-4">
      ${drafts.length > 0 && (html`<div className="flex flex-wrap items-center gap-3 rounded-2xl bg-orange-soft p-3">
          <span className="font-bold">${drafts.length} draft(s) waiting for review.</span>
          <${Button} variant="grass" onClick=${async () => {
        for (const d of drafts)
            await api(`/api/items/${d.id}`, { method: "PATCH", body: { status: "approved" } });
        onChange();
    }}>
            ✅ Approve all
          <//>
        </div>`)}
      ${CONTENT_TYPES.filter((t) => items.some((i) => i.type === t)).map((t) => (html`<div key=${t}>
          <h3 className=${`mb-2 font-display text-lg font-bold ${TYPE_META[t].text}`}>
            ${TYPE_META[t].icon} ${TYPE_META[t].label}
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            ${items
        .filter((i) => i.type === t)
        .map((i) => (html`<div key=${i.id} className=${`flex flex-col gap-2 rounded-2xl border-2 p-3 ${i.status === "draft" ? "border-dashed border-orange" : "border-line"}`}>
                  <div className="flex items-start gap-2">
                    <${Link} href=${`/parent/items/${i.id}`} className="min-w-0 flex-1 font-bold hover:underline">
                      ${i.title}
                      ${i.type === "game" && html`<span className="ml-1 text-sm font-normal text-ink-soft">(${GAME_LABEL[i.data.game]})</span>`}
                    <//>
                    <${Badge} tone=${i.status === "approved" ? "grass" : "orange"}>${i.status === "approved" ? "Live" : "Draft"}<//>
                    <${Badge} tone="gray">${i.createdBy === "claude" ? "🤖" : i.createdBy === "demo" ? "demo" : "⚡"}<//>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <${LinkButton} href=${`/parent/items/${i.id}`}>✏️ Edit · 👀 Preview<//>
                    ${i.status === "draft" ? (html`<${Button} variant="grass" onClick=${() => act(i.id, { status: "approved" })}>
                        ✅ Approve
                      <//>`) : (html`<${Button} onClick=${() => act(i.id, { status: "draft" })}>Hide<//>`)}
                    ${PRINTABLE_TYPES.includes(i.type) && (html`<${LinkButton} href=${`/print/${i.id}`} target="_blank">
                        🖨️
                      <//>`)}
                    <${LinkButton} href=${`/present/${i.id}`} target="_blank">
                      📺
                    <//>
                    <${Button} variant="danger" onClick=${() => confirm(`Delete “${i.title}”?`) && act(i.id, null)}>
                      🗑️
                    <//>
                  </div>
                </div>`))}
          </div>
        </div>`))}
    </div>`);
}
/** Preview + edit one item. */
export function ItemDetail({ itemId }) {
    const { data, error, reload, setData } = useApi(`/api/items/${itemId}`);
    const [saved, setSaved] = useState(false);
    if (error)
        return html`<${ErrorBox} message=${error} onRetry=${reload} />`;
    if (!data)
        return html`<${Loading} />`;
    return (html`<${ItemEditor} key=${data.item.updatedAt} data=${data} saved=${saved} onSaved=${(item) => {
        setSaved(true);
        setData({ ...data, item });
    }} />`);
}
function ItemEditor({ data, onSaved, saved }) {
    const { item, parent, pictures } = data;
    const [draft, setDraft] = useState(item.data);
    const [title, setTitle] = useState(item.title);
    const [preview, setPreview] = useState(item.data);
    const [json, setJson] = useState(null);
    const [msg, setMsg] = useState(null);
    const [round, setRound] = useState(0);
    const timer = useRef(null);
    const meta = TYPE_META[item.type];
    const back = parent ? (parent.kind === "unit" ? `/parent/units/${parent.id}` : `/parent/inspiration/${parent.id}`) : "/parent";
    const dirty = title.trim() !== item.title || JSON.stringify(draft) !== JSON.stringify(item.data);
    const check = useMemo(() => validateItemData(item.type, draft), [item.type, draft]);
    const previewCheck = useMemo(() => validateItemData(item.type, preview), [item.type, preview]);
    useEffect(() => {
        if (!dirty)
            return;
        const warn = (e) => {
            e.preventDefault();
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);
    const edit = (v) => {
        // A game switched to another kind keeps a matching title (unless the parent wrote their own).
        const was = draft?.game;
        const now = v?.game;
        if (item.type === "game" && was && now && was !== now && title.trim() === GAMES[was].label)
            setTitle(GAMES[now].label);
        setDraft(v);
        setMsg(null);
        // The preview follows after a short pause, so it doesn't restart on every key.
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = setTimeout(() => setPreview(v), 700);
    };
    const save = async (body) => {
        setMsg(null);
        try {
            const r = await api(`/api/items/${item.id}`, { method: "PATCH", body });
            onSaved(r.item);
        }
        catch (e) {
            const err = e;
            setMsg({ ok: false, text: err.message, details: err.details });
        }
    };
    const saveAll = () => save({ ...(title.trim() && title.trim() !== item.title ? { title: title.trim() } : {}), data: draft });
    const discard = () => {
        setDraft(item.data);
        setPreview(item.data);
        setTitle(item.title);
        setJson(null);
        setMsg(null);
    };
    const shown = previewCheck.success ? { ...item, data: previewCheck.data } : item;
    return (html`<div className="mx-auto flex max-w-6xl flex-col gap-6">
      <p className="text-sm font-bold text-ink-soft">
        <${Link} href=${back} className="underline">
          ← ${parent?.title ?? "Back"}
        <//>
      </p>
      <${PageHeader} emoji=${meta.icon} title=${item.title} subtitle=${html`<span className="flex flex-wrap gap-2">
            <${Badge} tone=${item.status === "approved" ? "grass" : "orange"}>${item.status === "approved" ? "Live for children" : "Draft"}<//>
            <${Badge} tone="gray">${meta.label}<//>
            <${Badge} tone=${item.source === "book" ? "sun" : "grape"}>${item.source === "book" ? "📘 Book" : "✨ Inspiration"}<//>
          </span>`} actions=${html`<${Fragment}>
            <${Button} variant=${item.status === "draft" ? "grass" : "ghost"} onClick=${() => save({ status: item.status === "draft" ? "approved" : "draft" })}>
              ${item.status === "draft" ? "✅ Approve" : "Hide from children"}
            <//>
            ${PRINTABLE_TYPES.includes(item.type) && (html`<${LinkButton} href=${`/print/${item.id}`} target="_blank">
                🖨️ Print
              <//>`)}
            <${LinkButton} href=${`/present/${item.id}`} target="_blank">
              📺 Show on TV
            <//>
          <//>`} />
      ${msg && (html`<div className=${`rounded-2xl p-3 ${msg.ok ? "bg-grass-soft" : "bg-berry-soft"}`}>
          <b>${msg.text}</b>
          ${msg.details && html`<pre className="mt-2 whitespace-pre-wrap text-sm">${msg.details}</pre>`}
        </div>`)}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <${Panel} title="✏️ Edit the lesson">
          <p className="mb-4 text-sm text-ink-soft">Change any text, word, choice or answer. Changes are only kept when you press 💾 Save.</p>
          <label className="mb-4 flex flex-col gap-1">
            <span className="text-sm font-bold text-ink-soft">Title</span>
            <input className=${`${inputCls} text-lg font-bold`} value=${title} onChange=${(e) => setTitle(e.target.value)} aria-label="Title" />
          </label>
          <${PicturesProvider} pictures=${pictures}>
            <${ContentForm} type=${item.type} value=${draft} onChange=${edit} />
          <//>
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-bold text-ink-soft">Advanced: edit as JSON</summary>
            <textarea className=${`${inputCls} mt-2 h-80 w-full font-mono text-xs`} value=${json ?? JSON.stringify(draft, null, 2)} onChange=${(e) => setJson(e.target.value)} spellCheck=${false} />
            <${Button} className="mt-2" disabled=${json === null} onClick=${() => {
        try {
            edit(JSON.parse(json));
            setJson(null);
        }
        catch (e) {
            setMsg({ ok: false, text: "That is not valid JSON: " + e.message });
        }
    }}>
              Use this JSON
            <//>
          </details>
        <//>
        <div className="flex flex-col gap-4 xl:sticky xl:top-4">
          <${Panel} title="👀 Preview (as your child sees it)">
            ${!previewCheck.success && html`<p className="mb-2 rounded-xl bg-orange-soft p-2 text-sm">Showing the last good version — finish the edit to see it here.</p>`}
            <div className="max-h-[75vh] overflow-auto rounded-2xl bg-cream p-4">
              <${ActivityBody} key=${`${round}-${JSON.stringify(shown.data).length}-${hashText(JSON.stringify(shown.data))}`} item=${shown} pictures=${pictures} prefetch=${!dirty} onDone=${() => setRound((r) => r + 1)} showVi />
            </div>
          <//>
        </div>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-line bg-paper p-3 shadow-lg">
        <${Button} variant="primary" disabled=${!dirty || !check.success || !title.trim()} onClick=${saveAll}>
          💾 Save changes
        <//>
        <${Button} disabled=${!dirty} onClick=${discard}>
          ↩ Undo all changes
        <//>
        ${dirty && !check.success && (html`<span className="text-sm font-bold text-berry-deep" title=${z.prettifyError(check.error)}>
            ⚠️ ${friendlyProblem(check.error)}
          </span>`)}
        ${dirty && check.success && html`<span className="text-sm font-bold text-orange-deep">Unsaved changes</span>`}
        ${!dirty && saved && html`<span className="text-sm font-bold text-grass-deep">✅ Saved</span>`}
      </div>
    </div>`);
}
function hashText(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
}
/** First problem of an invalid edit, in plain words. */
function friendlyProblem(e) {
    const issue = e.issues[0];
    if (!issue)
        return "Something is not finished.";
    const where = issue.path.filter((p) => typeof p === "string").at(-1);
    const what = where ? `“${String(where)}”` : "a field";
    if (issue.code === "too_small")
        return `${what} is empty or too short.`;
    if (issue.code === "too_big")
        return `${what} has too many entries.`;
    if (issue.message.includes("answer"))
        return "The right answer must be one of the choices.";
    return `${what}: ${issue.message}`;
}
