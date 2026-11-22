import { html, Fragment } from "@/lib/html.js";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, useApi } from "@/lib/client/api.js";
import { Badge, Button, EmptyState, Field, PageHeader, Panel, inputCls } from "@/components/ui.js";
import { ErrorBox, Loading } from "@/components/kids/index.js";
import { STAGE_LABEL } from "@/lib/contentMeta.js";
import { STAGES } from "@/lib/assessment.js";
import { ItemList } from "./items.js";
export function InspirationPage() {
    const { data, error, reload } = useApi("/api/topics");
    const [creating, setCreating] = useState(false);
    if (error)
        return html`<${ErrorBox} message=${error} onRetry=${reload} />`;
    return (html`<div className="mx-auto flex max-w-6xl flex-col gap-6">
      <${PageHeader} emoji="✨" title="Inspiration topics" subtitle="Extra topics you make yourself — kept separate from the books. To give a topic to a child: approve it, then tick it in Children → Edit. It shows as a “Bonus island” for that child." actions=${html`<${Button} variant="grape" onClick=${() => setCreating((c) => !c)}>
            ${creating ? "Close" : "➕ New topic"}
          <//>`} />
      ${creating && html`<${TopicCreator} onCancel=${() => setCreating(false)} onSaved=${reload} />`}
      ${!data ? (html`<${Loading} />`) : !data.topics.length ? (html`<${EmptyState} emoji="🦖" title="No inspiration topics yet">
          Press <b>➕ New topic</b>, give it a title (e.g. “Dinosaurs”) and a few words with an emoji — the app makes the lessons and games.
        <//>`) : (html`<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          ${data.topics.map((t) => (html`<${Link} key=${t.id} href=${`/parent/inspiration/${t.id}`} className="flex flex-col gap-2 rounded-3xl border-2 border-grape bg-grape-soft p-5 shadow-[0_4px_0_0_#d7c4f2] hover:border-grape-deep">
              <span className="text-5xl">${t.emoji}</span>
              <h2 className="text-xl font-extrabold">${t.title}</h2>
              <p className="text-sm text-ink-soft">${t.description}</p>
              <span className="flex flex-wrap gap-2">
                <${Badge} tone=${t.status === "approved" ? "grass" : "orange"}>${t.status === "approved" ? "Live" : "Draft"}<//>
                <${Badge} tone="gray">${STAGE_LABEL[t.stage]}<//>
                <${Badge} tone="grape">
                  ${t.itemCount} ${t.itemCount === 1 ? "item" : "items"}
                <//>
              </span>
              <${ForChildren} topic=${t} />
            <//>`))}
        </div>`)}
    </div>`);
}
const emptyWord = () => ({ emoji: "", word: "", vi: "" });
/**
 * A new topic, made without AI: a title, a level and a few words with an emoji (plus, if you like,
 * a sentence pattern, sentences and a short reading text). The app builds the lessons and two games.
 */
function TopicCreator({ onCancel, onSaved }) {
    const router = useRouter();
    const [t, setT] = useState({ title: "", emoji: "✨", description: "", stage: "early-reader", words: [emptyWord(), emptyWord(), emptyWord(), emptyWord()], pattern: "", sentences: "", reading: "" });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const file = useRef(null);
    const upd = (patch) => setT((x) => ({ ...x, ...patch }));
    const setWord = (k, patch) => setT((x) => ({ ...x, words: x.words.map((w, i) => (i === k ? { ...w, ...patch } : w)) }));
    const words = t.words.filter((w) => w.word.trim());
    const save = async () => {
        setError(null);
        setBusy(true);
        try {
            const r = await api("/api/topics", {
                body: {
                    topic: {
                        title: t.title,
                        emoji: t.emoji || "✨",
                        description: t.description,
                        stage: t.stage,
                        words: words.map((w) => ({ word: w.word.trim(), emoji: w.emoji.trim() || "⭐", vi: w.vi.trim() || undefined })),
                        pattern: t.pattern.trim() || undefined,
                        sentences: t.sentences.split("\n").map((s) => s.trim()).filter(Boolean),
                        reading: t.reading.trim() || undefined,
                    },
                },
            });
            onSaved();
            router.push(`/parent/inspiration/${r.topic.id}`);
        }
        catch (e) {
            setError(`${e.message}${e.details ? `\n${e.details}` : ""}`);
        }
        setBusy(false);
    };
    const importPack = async (f) => {
        setError(null);
        try {
            const json = JSON.parse(await f.text());
            const r = await api("/api/topics", { body: { pack: json } });
            onSaved();
            router.push(`/parent/inspiration/${r.topic.id}`);
        }
        catch (e) {
            setError(`${e.message}${e.details ? `\n${e.details}` : ""}`);
        }
    };
    return (html`<${Panel} title="✨ New topic" actions=${html`<${Fragment}>
          <${Button} onClick=${() => file.current?.click()} title="A topic saved with “⬇️ Save as file” (or an inspiration-pack file from the desktop app)">📂 Open a topic file<//>
          <input ref=${file} type="file" accept="application/json,.json" className="hidden" onChange=${(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f)
            void importPack(f);
    }} />
        <//>`}>
      <form className="flex flex-col gap-4" onSubmit=${(e) => {
        e.preventDefault();
        void save();
    }}>
        <div className="grid gap-3 md:grid-cols-[96px_1fr_240px]">
          <${Field} label="Emoji">
            <input aria-label="Topic emoji" className=${`${inputCls} text-center text-3xl`} value=${t.emoji} maxLength=${16} onChange=${(e) => upd({ emoji: e.target.value })} />
          <//>
          <${Field} label="Title">
            <input aria-label="Topic title" className=${`${inputCls} font-bold`} placeholder="e.g. Dinosaurs, Our trip to Da Lat" value=${t.title} maxLength=${80} onChange=${(e) => upd({ title: e.target.value })} />
          <//>
          <${Field} label="Level">
            <select aria-label="Level" className=${inputCls} value=${t.stage} onChange=${(e) => upd({ stage: e.target.value })}>
              ${STAGES.map((s) => html`<option key=${s} value=${s}>${STAGE_LABEL[s]}</option>`)}
            </select>
          <//>
        </div>
        <${Field} label="Short description (optional)">
          <input className=${inputCls} value=${t.description} maxLength=${400} onChange=${(e) => upd({ description: e.target.value })} placeholder="What is this topic about?" />
        <//>
        <div>
          <p className="font-bold">Words (3–16) — each with an emoji</p>
          <div className="mt-2 flex flex-col gap-2">
            ${t.words.map((w, k) => html`<div key=${k} className="flex flex-wrap gap-2">
                <input aria-label=${`Emoji ${k + 1}`} className=${`${inputCls} w-20 text-center text-2xl`} value=${w.emoji} maxLength=${16} placeholder="🦖" onChange=${(e) => setWord(k, { emoji: e.target.value })} />
                <input aria-label=${`Word ${k + 1}`} className=${`${inputCls} min-w-40 flex-1 font-bold`} value=${w.word} maxLength=${40} placeholder="word" onChange=${(e) => setWord(k, { word: e.target.value })} />
                <input aria-label=${`Vietnamese ${k + 1}`} className=${`${inputCls} min-w-40 flex-1`} value=${w.vi} maxLength=${60} placeholder="Vietnamese (for you, optional)" onChange=${(e) => setWord(k, { vi: e.target.value })} />
                <${Button} type="button" variant="danger" aria-label="Remove word" onClick=${() => upd({ words: t.words.filter((_, i) => i !== k) })}>✕<//>
              </div>`)}
          </div>
          ${t.words.length < 16 && html`<${Button} type="button" className="mt-2" onClick=${() => upd({ words: [...t.words, emptyWord()] })}>+ Add word<//>`}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <${Field} label="Sentence pattern (optional)" hint="The part that changes as ___, e.g. “I like ___.” — used for grammar and examples.">
            <input className=${inputCls} value=${t.pattern} maxLength=${120} onChange=${(e) => upd({ pattern: e.target.value })} placeholder="I can see a ___." />
          <//>
          <${Field} label="Sentences (optional, one per line)" hint="Short sentences for listening and speaking.">
            <textarea className=${inputCls} rows=${3} value=${t.sentences} onChange=${(e) => upd({ sentences: e.target.value })} />
          <//>
        </div>
        <${Field} label="Reading text (optional)" hint="A short text to read together — one line per line, “Name: …” for dialogues.">
          <textarea className=${inputCls} rows=${4} value=${t.reading} maxLength=${1200} onChange=${(e) => upd({ reading: e.target.value })} />
        <//>
        <div className="flex flex-wrap items-center gap-2">
          <${Button} type="submit" variant="grape" disabled=${busy || !t.title.trim() || words.length < 3}>
            ${busy ? "Making the lessons…" : "💾 Save as draft topic"}
          <//>
          <${Button} type="button" onClick=${onCancel}>Cancel<//>
          <span className="text-sm text-ink-soft">The app makes words, listening, speaking, quiz, two games, a worksheet, a lesson plan and a check (grammar and reading too when you add a pattern / text).</span>
        </div>
        ${error && html`<pre className="whitespace-pre-wrap rounded-xl bg-berry-soft p-3 font-sans font-bold text-berry-deep">❌ ${error}</pre>`}
      </form>
    <//>`);
}
/** Who gets this topic (it is given per child in Children → Edit). */
function ForChildren({ topic }) {
    const kids = topic.children ?? [];
    if (!kids.length)
        return html`<p className="text-sm font-bold text-orange-deep">Not given to any child yet</p>`;
    return (html`<p className="text-sm font-bold">
      For: ${kids.map((c) => `${c.avatar} ${c.name}`).join(", ")}
    </p>`);
}
/** The topic as an "inspiration-pack" file (to keep, or to open on another device). */
function saveTopicFile(topic, items) {
    const pack = {
        kind: "inspiration-pack",
        topic: { title: topic.title, emoji: topic.emoji, description: topic.description || topic.title, stage: topic.stage },
        items: items.map((i) => ({ type: i.type, title: i.title, data: i.data })),
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 1)], { type: "application/json" }));
    a.download = `topic-${topic.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "topic"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}
export function TopicDetail({ topicId }) {
    const { data, error, reload } = useApi(`/api/topics/${topicId}`);
    const router = useRouter();
    if (error)
        return html`<${ErrorBox} message=${error} onRetry=${reload} />`;
    if (!data)
        return html`<${Loading} />`;
    const { topic, items } = data;
    const setStatus = async (status) => {
        await api(`/api/topics/${topicId}`, { method: "PATCH", body: { status } });
        reload();
    };
    return (html`<div className="mx-auto flex max-w-6xl flex-col gap-6">
      <p className="text-sm font-bold text-ink-soft">
        <${Link} href="/parent/inspiration" className="underline">
          Inspiration
        <//>${" "}
        › ${topic.title}
      </p>
      <${PageHeader} emoji=${topic.emoji} title=${topic.title} subtitle=${html`<span className="flex flex-wrap gap-2">
            <${Badge} tone="grape">✨ Inspiration<//>
            <${Badge} tone=${topic.status === "approved" ? "grass" : "orange"}>${topic.status === "approved" ? "Live" : "Draft"}<//>
            <${Badge} tone="gray">${STAGE_LABEL[topic.stage]}<//>
          </span>`} actions=${html`<${Fragment}>
            ${topic.status === "draft" ? (html`<${Button} variant="grass" onClick=${() => setStatus("approved")}>
                ✅ Approve topic (all items)
              <//>`) : (html`<${Button} onClick=${() => setStatus("draft")}>Hide from children<//>`)}
            <${Button} onClick=${() => saveTopicFile(topic, items)}>⬇️ Save as file<//>
            <${Button} variant="danger" onClick=${async () => {
        if (!confirm("Delete this topic and its items?"))
            return;
        await api(`/api/topics/${topicId}`, { method: "DELETE" });
        router.push("/parent/inspiration");
    }}>
              Delete
            <//>
          <//>`} />
      ${topic.description && html`<p>${topic.description}</p>`}
      <${Panel} title="👧 Children">
        <${ForChildren} topic=${topic} />
        <p className="mt-2 text-sm text-ink-soft">
          To give this topic to a child (or take it away), open${" "}
          <${Link} href="/parent/children" className="font-bold underline">
            Children
          <//>${" "}
          → <b>Edit</b> → tick it under <b>Extra topics</b>.${topic.status === "draft" && " Children see it after you approve it."}
        </p>
      <//>
      <${Panel} title="🎒 Items">
        <${ItemList} items=${items} onChange=${reload} />
      <//>
    </div>`);
}
