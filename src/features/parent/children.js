import { html, Fragment } from "@/lib/html.js";
import { useState } from "react";
import { api, useApi } from "@/lib/client/api.js";
import Link from "next/link";
import { Badge, Button, EmptyState, Field, PageHeader, Panel, inputCls } from "@/components/ui.js";
import { Loading, StickerArt } from "@/components/kids/index.js";
import { AVATARS } from "@/lib/stickers.js";
import { childFit } from "@/lib/assessment.js";
import { FitBadge } from "./common.js";
export function ChildrenPage() {
    const kids = useApi("/api/children");
    const books = useApi("/api/books");
    const topics = useApi("/api/topics");
    const [editing, setEditing] = useState(null);
    if (!kids.data || !books.data || !topics.data)
        return html`<${Loading} />`;
    return (html`<div className="mx-auto flex max-w-6xl flex-col gap-6">
      <${PageHeader} emoji="👧" title="Children" actions=${html`<${Button} variant="primary" onClick=${() => setEditing({ avatar: AVATARS[kids.data.children.length % AVATARS.length], age: 6, dailyGoalMinutes: 15, bookIds: [], topicIds: [] })}>
            + Add child
          <//>`} />
      ${editing && (html`<${ChildForm} value=${editing} books=${books.data.books} topics=${topics.data.topics} onClose=${() => setEditing(null)} onSaved=${() => {
        setEditing(null);
        kids.reload();
        topics.reload();
    }} />`)}
      ${!kids.data.children.length && !editing && html`<${EmptyState} emoji="🧒" title="No children yet" />`}
      ${kids.data.children.map((c) => {
        const childBooks = c.bookIds.map((id) => books.data.books.find((b) => b.id === id)).filter((b) => !!b);
        const childTopics = c.topicIds.map((id) => topics.data.topics.find((t) => t.id === id)).filter((t) => !!t);
        const maxMin = Math.max(c.dailyGoalMinutes, ...c.stats.week.map((w) => w.minutes));
        return (html`<${Panel} key=${c.id} title=${html`<span>
                ${c.avatar} ${c.name} <span className="text-base text-ink-soft">· ${c.age} years</span>
              </span>`} actions=${html`<${Fragment}>
                <${Button} onClick=${() => setEditing(c)}>Edit<//>
                <${Button} variant="danger" onClick=${async () => {
            if (!confirm(`Remove ${c.name} and their progress?`))
                return;
            await api(`/api/children/${c.id}`, { method: "DELETE" });
            kids.reload();
        }}>
                  Remove
                <//>
              <//>`}>
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="font-bold">Books</p>
                ${childBooks.length ? (html`<ul className="flex flex-col gap-1">
                    ${childBooks.map((b) => {
            const fit = b.assessment ? childFit(c.age, b.assessment) : null;
            return (html`<li key=${b.id} title=${fit?.reason}>
                          📘 ${b.title} <${FitBadge} fit=${fit} />
                        </li>`);
        })}
                  </ul>`) : (html`<p className="text-ink-soft">No book yet — press Edit to choose.</p>`)}
                ${childTopics.length > 0 && (html`<${Fragment}>
                    <p className="mt-3 font-bold">Extra topics</p>
                    <ul className="flex flex-col gap-1">
                      ${childTopics.map((t) => (html`<li key=${t.id}>
                          ${t.emoji} ${t.title} ${t.status !== "approved" && html`<${Badge} tone="orange">Draft — not shown yet<//>`}
                        </li>`))}
                    </ul>
                  <//>`)}
                <p className="mt-3">
                  ⭐ ${c.stats.totalStars} stars · ${c.stats.attempts} activities · ${c.stats.stickers.length} stickers · 🏆 Level ${c.stats.level}
                </p>
                <p className="flex flex-wrap gap-1 text-2xl">
                  ${c.stats.stickers.slice(-10).map((id) => (html`<${StickerArt} key=${id} id=${id} />`))}
                </p>
              </div>
              <div>
                <p className="mb-2 font-bold">Minutes this week (goal ${c.dailyGoalMinutes}/day)</p>
                <div className="flex h-32 items-end gap-2">
                  ${c.stats.week.map((w) => (html`<div key=${w.date} className="flex flex-1 flex-col items-center gap-1">
                      <div className=${`w-full rounded-t-lg ${w.minutes >= c.dailyGoalMinutes ? "bg-grass" : "bg-sun"}`} style=${{ height: `${Math.max(4, (w.minutes / maxMin) * 100)}px` }} title=${`${w.minutes} min, ${w.stars} stars`} />
                      <span className="text-xs text-ink-soft">${new Date(w.date + "T12:00").toLocaleDateString("en-US", { weekday: "short" })}</span>
                    </div>`))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-bold">Words to practice</p>
                ${c.stats.weakWords.length ? (html`<div className="flex flex-wrap gap-1">
                    ${c.stats.weakWords.map((w) => (html`<${Badge} key=${w.word} tone="orange">
                        ${w.word} ×${w.misses}
                      <//>`))}
                  </div>`) : (html`<p className="text-ink-soft">Nothing yet — great!</p>`)}
              </div>
            </div>
          <//>`);
    })}
    </div>`);
}
function ChildForm({ value, books, topics, onClose, onSaved }) {
    const [v, setV] = useState(value);
    const [err, setErr] = useState(null);
    const chosen = v.bookIds ?? [];
    const toggle = (id) => setV({ ...v, bookIds: chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id] });
    const chosenTopics = v.topicIds ?? [];
    const toggleTopic = (id) => setV({ ...v, topicIds: chosenTopics.includes(id) ? chosenTopics.filter((x) => x !== id) : [...chosenTopics, id] });
    return (html`<${Panel} title=${v.id ? `Edit ${value.name}` : "Add a child"}>
      <div className="grid gap-4 md:grid-cols-2">
        <${Field} label="Name">
          <input className=${inputCls} value=${v.name ?? ""} onChange=${(e) => setV({ ...v, name: e.target.value })} maxLength=${30} autoFocus />
        <//>
        <${Field} label="Age">
          <input className=${inputCls} type="number" min=${2} max=${14} value=${v.age ?? 6} onChange=${(e) => setV({ ...v, age: Number(e.target.value) })} />
        <//>
        <${Field} label="Avatar">
          <div className="flex flex-wrap gap-2">
            ${AVATARS.map((a) => (html`<button key=${a} type="button" onClick=${() => setV({ ...v, avatar: a })} className=${`h-12 w-12 rounded-xl text-3xl ${v.avatar === a ? "bg-sun ring-4 ring-sun-deep" : "bg-cream"}`} aria-label=${`Avatar ${a}`}>
                ${a}
              </button>`))}
          </div>
        <//>
        <${Field} label="Books they learn" hint="Each book comes with its ready-made lessons. Tick one or more.">
          <div className="flex flex-col gap-2">
            ${!books.length && html`<span className="text-ink-soft">No books yet — add one in Books.</span>`}
            ${books.map((b) => {
        const fit = b.assessment && v.age ? childFit(v.age, b.assessment) : null;
        return (html`<label key=${b.id} className=${`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-2 ${chosen.includes(b.id) ? "border-ink bg-sun-soft" : "border-line"}`}>
                  <input type="checkbox" className="h-5 w-5" checked=${chosen.includes(b.id)} onChange=${() => toggle(b.id)} />
                  <span className="min-w-0 flex-1">
                    <b>${b.title}</b>
                    <span className="block text-xs text-ink-soft">
                      ${b.assessment ? `Ages ${b.assessment.estimatedAge.min}–${b.assessment.estimatedAge.max}` : "Not assessed"} · 🎒 ${b.readyUnits ?? 0}/${b.unitCount ?? 0} units with lessons
                    </span>
                  </span>
                  <${FitBadge} fit=${fit} />
                </label>`);
    })}
          </div>
        <//>
        <${Field} label="Extra topics (Inspiration)" hint="Tick the topics this child should get. They show as Bonus islands once approved.">
          <div className="flex flex-col gap-2">
            ${!topics.length && (html`<span className="text-ink-soft">
                No extra topics yet — make one in${" "}
                <${Link} href="/parent/inspiration" className="font-bold underline">
                  Inspiration
                <//>
                .
              </span>`)}
            ${topics.map((t) => (html`<label key=${t.id} className=${`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-2 ${chosenTopics.includes(t.id) ? "border-ink bg-grape-soft" : "border-line"}`}>
                <input type="checkbox" className="h-5 w-5" checked=${chosenTopics.includes(t.id)} onChange=${() => toggleTopic(t.id)} />
                <span className="text-2xl">${t.emoji}</span>
                <span className="min-w-0 flex-1">
                  <b>${t.title}</b>
                  <span className="block text-xs text-ink-soft">
                    ✨ ${t.itemCount ?? 0} ${t.itemCount === 1 ? "activity" : "activities"}
                  </span>
                </span>
                ${t.status === "approved" ? html`<${Badge} tone="grass">Live<//>` : html`<${Badge} tone="orange">Draft — approve it to show<//>`}
              </label>`))}
          </div>
        <//>
        <${Field} label="Daily goal (minutes)">
          <input className=${inputCls} type="number" min=${5} max=${60} value=${v.dailyGoalMinutes ?? 15} onChange=${(e) => setV({ ...v, dailyGoalMinutes: Number(e.target.value) })} />
        <//>
      </div>
      ${err && html`<p className="mt-3 font-bold text-berry-deep">${err}</p>`}
      <div className="mt-4 flex gap-2">
        <${Button} variant="primary" onClick=${async () => {
        try {
            await api("/api/children", { body: v });
            onSaved();
        }
        catch (e) {
            setErr(e.message);
        }
    }}>
          Save
        <//>
        <${Button} onClick=${onClose}>Cancel<//>
      </div>
    <//>`);
}
