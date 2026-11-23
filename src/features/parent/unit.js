import { html, Fragment } from "@/lib/html.js";
import { ApiImg } from "@/components/ApiImg.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useApi } from "@/lib/client/api.js";
import { Badge, Button, PageHeader, Panel, inputCls } from "@/components/ui.js";
import { ErrorBox, Loading, SpeakButton } from "@/components/kids/index.js";
import { TYPE_META } from "@/lib/contentMeta.js";
import { CONTENT_TYPES } from "@/lib/types.js";
import { ItemList } from "./items.js";
import { JobLog, PageModal } from "./books.js";
import { useJob } from "./common.js";
import { PicturePicker } from "./picker.js";
import { RulesNote } from "./rules.js";
import { cropUrl, picKey } from "@/lib/pictures.js";
import { bookTexts } from "@/lib/bookText.js";
export function UnitWorkspace({ unitId }) {
    const { data, error, reload } = useApi(`/api/units/${unitId}`);
    const [pickedTab, setTab] = useState(null);
    const router = useRouter();
    if (error)
        return html`<${ErrorBox} message=${error} onRetry=${reload} />`;
    if (!data)
        return html`<${Loading} />`;
    const { unit, book, items, siblings } = data;
    const tab = pickedTab ?? (unit.status === "approved" ? "practice" : "book");
    const idx = siblings.findIndex((s) => s.id === unit.id);
    return (html`<div className="mx-auto flex max-w-6xl flex-col gap-6">
      <p className="text-sm font-bold text-ink-soft">
        <${Link} href="/parent/books" className="underline">
          Books
        <//>${" "}
        ›${" "}
        <${Link} href=${`/parent/books/${book.id}`} className="underline">
          ${book.title}
        <//>${" "}
        › Unit ${unit.order}
      </p>
      <${PageHeader} title=${`Unit ${unit.order}: ${unit.title}`} subtitle=${html`<span className="flex flex-wrap gap-2">
            <${Badge} tone=${unit.status === "approved" ? "grass" : "orange"}>${unit.status === "approved" ? "Approved" : "Needs your review"}<//>
            ${unit.topic && html`<${Badge} tone="gray">${unit.topic}<//>`}
          </span>`} actions=${html`<${Fragment}>
            ${idx > 0 && html`<${Link} className="btn-3d rounded-2xl border-2 border-line bg-paper px-3 py-2 font-bold" href=${`/parent/units/${siblings[idx - 1].id}`}>◀ Unit ${siblings[idx - 1].order}<//>`}
            ${idx < siblings.length - 1 && html`<${Link} className="btn-3d rounded-2xl border-2 border-line bg-paper px-3 py-2 font-bold" href=${`/parent/units/${siblings[idx + 1].id}`}>Unit ${siblings[idx + 1].order} ▶<//>`}
            ${!book.isDemo && html`<${Button} variant="danger" onClick=${async () => {
        if (!confirm(`Remove unit ${unit.order} (“${unit.title}”) and its ${items.length} lesson(s)?`))
            return;
        await api(`/api/units/${unit.id}`, { method: "DELETE" });
        router.push(`/parent/books/${book.id}`);
    }}>Remove unit<//>`}
          <//>`} />
      <div className="flex gap-2" role="tablist">
        ${[
        ["book", "📖 From the book"],
        ["practice", `🎒 Practice pack (${items.length})`],
    ].map(([k, label]) => (html`<button key=${k} role="tab" aria-selected=${tab === k} onClick=${() => setTab(k)} className=${`rounded-2xl px-4 py-2 font-bold ${tab === k ? "bg-sun" : "bg-paper text-ink-soft"}`}>
            ${label}
          </button>`))}
      </div>
      ${tab === "book" ? html`<${ExtractEditor} data=${data} onSaved=${reload} />` : html`<${PracticePanel} data=${data} onChange=${reload} />`}
    </div>`);
}
/* ------------------------- What the book teaches ------------------------- */
function ExtractEditor({ data, onSaved }) {
    const { unit, book } = data;
    const [ex, setEx] = useState(unit.extract);
    const [dirty, setDirty] = useState(false);
    const [msg, setMsg] = useState(null);
    const [page, setPage] = useState(null);
    const [picking, setPicking] = useState(null);
    const [range, setRange] = useState(unit.pages);
    const upd = (f) => {
        setEx(f(structuredClone(ex)));
        setDirty(true);
    };
    const save = async (status) => {
        setMsg(null);
        try {
            const clean = { ...ex, title: ex.title.trim() || unit.title, topic: ex.topic.trim() || ex.title.trim() || unit.title, sentences: ex.sentences.map((s) => s.trim()).filter(Boolean), readings: ex.readings.filter((r) => r.text.trim()) };
            const pages = range[0] !== unit.pages[0] || range[1] !== unit.pages[1] ? [range[0], Math.max(range[0], range[1])] : undefined;
            await api(`/api/units/${unit.id}`, { method: "PATCH", body: { extract: clean, pages, ...(status ? { status } : {}) } });
            setDirty(false);
            setMsg(status ? "Approved! Now make a practice pack." : "Saved.");
            onSaved();
        }
        catch (e) {
            const err = e;
            setMsg(`${err.message} ${err.details ?? ""}`);
        }
    };
    // Pictures Claude drew for the book's words (book package, lesson rule 2).
    const hasDrawings = Object.keys(data.drawn ?? {}).length > 0;
    const pages = book.isDemo || !book.hasPages ? [] : Array.from({ length: Math.max(0, Math.min(unit.pages[1], book.pageCount || unit.pages[1]) - unit.pages[0] + 1) }, (_, k) => unit.pages[0] + k);
    return (html`<div className="flex flex-col gap-6">
      ${unit.status !== "approved" && (html`<div className="rounded-2xl bg-orange-soft p-4">
          <b>Type in what this unit of the book teaches</b> — its words (each with an emoji${book.hasPages ? " and the book's picture" : ""}), sentence patterns, sentences and reading texts — then approve. Only approved units are used for your child. At least 3 words are needed to make lessons.
          ${ex.confidence < 0.6 && html`<p className="mt-1">⚠️ This unit was not read very surely from the pages — please check it.</p>`}
          ${ex.notes && html`<p className="mt-1">📝 ${ex.notes}</p>`}
        </div>`)}
      ${!book.isDemo && html`<${Panel} title="📗 Unit details">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-56 flex-1 flex-col gap-1">
              <span className="text-sm font-bold">Title</span>
              <input aria-label="Unit title" className=${inputCls} value=${ex.title} onChange=${(e) => upd((x) => ((x.title = e.target.value), x))} maxLength=${120} />
            </label>
            <label className="flex min-w-48 flex-1 flex-col gap-1">
              <span className="text-sm font-bold">Topic (helps pick the games)</span>
              <input aria-label="Unit topic" className=${inputCls} value=${ex.topic} onChange=${(e) => upd((x) => ((x.topic = e.target.value), x))} maxLength=${80} placeholder="e.g. toys, farm animals, food" />
            </label>
            ${book.pageCount > 0 && html`<${Fragment}>
                <label className="flex w-24 flex-col gap-1">
                  <span className="text-sm font-bold">From page</span>
                  <input aria-label="From page" className=${inputCls} type="number" min=${1} max=${book.pageCount} value=${range[0]} onChange=${(e) => {
        setRange([Number(e.target.value) || 1, Math.max(Number(e.target.value) || 1, range[1])]);
        setDirty(true);
    }} />
                </label>
                <label className="flex w-24 flex-col gap-1">
                  <span className="text-sm font-bold">To page</span>
                  <input aria-label="To page" className=${inputCls} type="number" min=${range[0]} max=${book.pageCount} value=${range[1]} onChange=${(e) => {
        setRange([range[0], Number(e.target.value) || range[0]]);
        setDirty(true);
    }} />
                </label>
              <//>`}
          </div>
        <//>`}
      ${pages.length > 0 && (html`<${Panel} title="📄 Book pages">
          <div className="flex gap-2 overflow-x-auto">
            ${pages.map((p) => (html`<button key=${p} onClick=${() => setPage(p)} className="w-24 shrink-0 rounded-lg border-2 border-line hover:border-sun">
                
                <${ApiImg} src=${`/api/books/${book.id}/pages/${p}?thumb=1`} alt=${`Page ${p}`} className="w-full rounded-md" />
                <span className="text-xs">p. ${p}</span>
              </button>`))}
          </div>
        <//>`)}
      ${page && html`<${PageModal} bookId=${book.id} page=${page} max=${book.pageCount} onClose=${() => setPage(null)} onGo=${setPage} />`}

      ${picking !== null && ex.vocabulary[picking] && (html`<${PicturePicker} bookId=${book.id} word=${ex.vocabulary[picking].word || "this word"} pages=${pages} maxPage=${book.pageCount} initial=${ex.vocabulary[picking].pic} onClose=${() => setPicking(null)} onPick=${(pic) => {
        const k = picking;
        upd((x) => {
            if (pic)
                x.vocabulary[k].pic = pic;
            else
                delete x.vocabulary[k].pic;
            return x;
        });
        setPicking(null);
    }} />`)}
      <${Panel} title=${`🃏 Words (${ex.vocabulary.length})`} actions=${html`<${Button} onClick=${() => upd((e) => (e.vocabulary.push({ word: "", emoji: "⭐" }), e))}>+ Add word<//>`}>
        ${(hasDrawings || pages.length > 0) && (html`<p className="mb-2 text-sm text-ink-soft">
            ${hasDrawings && html`The child sees the <b>picture Claude drew</b> for each word (like the book's picture). `}${pages.length > 0 && html`${hasDrawings ? "Words without a drawing show the" : "The child sees the"} <b>book's own picture</b> — click a picture (or 📷) to choose it on the page. `}The emoji is used only when there is no picture.
          </p>`)}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="text-sm text-ink-soft">
              <tr>
                ${hasDrawings && html`<th className="p-1">Drawing</th>`}
                <th className="p-1">Book picture</th>
                <th className="p-1">Emoji</th>
                <th className="p-1">Word</th>
                <th className="p-1">Vietnamese (for you)</th>
                <th className="p-1" />
              </tr>
            </thead>
            <tbody>
              ${ex.vocabulary.map((v, k) => (html`<tr key=${k} className="border-t border-line">
                  ${hasDrawings && html`<td className="p-1">
                      ${data.drawn[picKey(v.word)] ? html`<${ApiImg} src=${data.drawn[picKey(v.word)]} fallback=${v.emoji} alt=${v.word} title="Drawn by Claude" className="h-16 w-16 rounded-xl border-2 border-line bg-white object-contain" />` : html`<span className="text-sm text-ink-soft">—</span>`}
                    </td>`}
                  <td className="p-1">
                    ${pages.length > 0 ? (html`<button type="button" onClick=${() => setPicking(k)} aria-label=${`Choose the book picture for ${v.word || "this word"}`} className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line bg-paper text-2xl hover:border-sun">
                        ${v.pic ? html`<${ApiImg} src=${cropUrl(book.id, v.pic, 160)} fallback="📷" alt=${v.word} className="h-full w-full object-contain" />` : "📷"}
                      </button>`) : (html`<span className="text-sm text-ink-soft">—</span>`)}
                  </td>
                  <td className="p-1">
                    <input aria-label="Emoji" className=${`${inputCls} w-20 text-center text-2xl`} value=${v.emoji ?? ""} onChange=${(e) => upd((x) => ((x.vocabulary[k].emoji = e.target.value), x))} />
                  </td>
                  <td className="p-1">
                    <input aria-label="Word" className=${`${inputCls} w-full font-bold`} value=${v.word} onChange=${(e) => upd((x) => ((x.vocabulary[k].word = e.target.value), x))} />
                  </td>
                  <td className="p-1">
                    <input aria-label="Vietnamese meaning" className=${`${inputCls} w-full`} value=${v.vi ?? ""} onChange=${(e) => upd((x) => ((x.vocabulary[k].vi = e.target.value), x))} />
                  </td>
                  <td className="flex gap-1 p-1">
                    ${v.word && html`<${SpeakButton} text=${v.word} size=${40} />`}
                    <${Button} variant="danger" aria-label="Remove word" onClick=${() => upd((x) => (x.vocabulary.splice(k, 1), x))}>
                      ✕
                    <//>
                  </td>
                </tr>`))}
            </tbody>
          </table>
        </div>
      <//>

      <${Panel} title=${`🧩 Sentence patterns (${ex.patterns.length})`} actions=${html`<${Button} onClick=${() => upd((e) => (e.patterns.push({ text: "", function: "" }), e))}>+ Add pattern<//>`}>
        <p className="mb-2 text-sm text-ink-soft">Write the part that changes as ___ (e.g. “I have a ___.”).</p>
        <div className="flex flex-col gap-2">
          ${ex.patterns.map((p, k) => (html`<div key=${k} className="flex flex-wrap gap-2">
              <input aria-label="Pattern" className=${`${inputCls} min-w-60 flex-1 font-bold`} value=${p.text} onChange=${(e) => upd((x) => ((x.patterns[k].text = e.target.value), x))} />
              <input aria-label="Used for" placeholder="used for…" className=${`${inputCls} w-56`} value=${p.function} onChange=${(e) => upd((x) => ((x.patterns[k].function = e.target.value), x))} />
              <${Button} variant="danger" aria-label="Remove pattern" onClick=${() => upd((x) => (x.patterns.splice(k, 1), x))}>
                ✕
              <//>
            </div>`))}
        </div>
      <//>

      <${Panel} title=${`💬 Sentences from the book (${ex.sentences.length})`} actions=${html`<${Button} onClick=${() => upd((e) => (e.sentences.push(""), e))}>+ Add sentence<//>`}>
        <p className="mb-2 text-sm text-ink-soft">Used for examples, listening and speaking — exactly as printed in the book.</p>
        <div className="flex flex-col gap-2">
          ${ex.sentences.map((s, k) => (html`<div key=${k} className="flex gap-2">
              <input aria-label=${`Sentence ${k + 1}`} className=${`${inputCls} flex-1`} value=${s} onChange=${(e) => upd((x) => ((x.sentences[k] = e.target.value), x))} />
              ${s.trim() && html`<${SpeakButton} text=${s} size=${44} />`}
              <${Button} variant="danger" aria-label="Remove sentence" onClick=${() => upd((x) => (x.sentences.splice(k, 1), x))}>
                ✕
              <//>
            </div>`))}
          ${!ex.sentences.length && html`<p className="text-ink-soft">—</p>`}
        </div>
      <//>

      <${Panel} title=${`📖 Reading texts from the book (${ex.readings.length})`} actions=${html`<${Button} onClick=${() => upd((e) => (e.readings.push({ title: "", text: "" }), e))}>+ Add text<//>`}>
        <p className="mb-2 text-sm text-ink-soft">The Reading lesson shows these texts word for word. One line per line in the book; “Name: …” for dialogues.</p>
        <div className="flex flex-col gap-3">
          ${ex.readings.map((r, k) => (html`<div key=${k} className="flex flex-col gap-2 rounded-2xl border-2 border-line p-3">
              <div className="flex gap-2">
                <input aria-label=${`Text ${k + 1} title`} placeholder="Title (e.g. Let's talk)" className=${`${inputCls} flex-1 font-bold`} value=${r.title} onChange=${(e) => upd((x) => ((x.readings[k].title = e.target.value), x))} />
                ${r.text.trim() && html`<${SpeakButton} text=${r.text} size=${44} />`}
                <${Button} variant="danger" aria-label="Remove text" onClick=${() => upd((x) => (x.readings.splice(k, 1), x))}>
                  ✕
                <//>
              </div>
              <textarea aria-label=${`Text ${k + 1}`} className=${`${inputCls} w-full`} rows=${Math.max(3, r.text.split("\n").length + 1)} value=${r.text} onChange=${(e) => upd((x) => ((x.readings[k].text = e.target.value), x))} />
            </div>`))}
          ${!ex.readings.length && html`<p className="text-ink-soft">No reading text in this unit.</p>`}
        </div>
      <//>

      <div className="grid gap-4 md:grid-cols-3">
        <${Panel} title="🔤 Phonics">${ex.phonics.length ? ex.phonics.map((p) => html`<p key=${p.focus}><b>${p.focus}</b>: ${p.examples.join(", ")}</p>`) : html`<p className="text-ink-soft">—</p>`}<//>
        <${Panel} title="🎵 Songs & chants">${ex.songsChants.length ? ex.songsChants.map((s) => html`<p key=${s.title}>${s.title}</p>`) : html`<p className="text-ink-soft">—</p>`}<//>
        <${Panel} title="🛠️ Skills">
          <p>${ex.skills.join(", ") || "—"}</p>
          <p className="text-sm text-ink-soft">${ex.activityTypes.join(" · ")}</p>
        <//>
      </div>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-line bg-paper p-3 shadow-lg">
        <${Button} variant="primary" disabled=${!dirty} onClick=${() => save()}>
          💾 Save
        <//>
        ${unit.status !== "approved" && (html`<${Button} variant="grass" onClick=${() => save("approved")} disabled=${ex.vocabulary.filter((v) => v.word.trim()).length < 1}>
            ✅ Looks good — approve unit
          <//>`)}
        ${msg && html`<span className="font-bold">${msg}</span>`}
      </div>
    </div>`);
}
/* ------------------------------ Practice pack ------------------------------ */
function PracticePanel({ data, onChange }) {
    const { unit, book, items } = data;
    const hasPattern = unit.extract.patterns.some((p) => (p.text.match(/_{2,}/g) ?? []).length === 1);
    // What the offline builder can make from this unit: grammar needs a pattern with one gap, reading needs the book's text.
    const available = CONTENT_TYPES.filter((t) => !(t === "reading" && !bookTexts(unit.extract).length) && !(t === "grammar" && !hasPattern));
    const [types, setTypes] = useState(available.filter((t) => !items.some((i) => i.type === t)).length ? available.filter((t) => !items.some((i) => i.type === t)) : available);
    const [busy, setBusy] = useState(null);
    const [status, setStatus] = useState(null);
    const remake = useJob(onChange);
    if (unit.status !== "approved")
        return (html`<${Panel}>
        <p className="text-lg">
          First check and <b>approve the unit</b> in the “📖 From the book” tab. Then you can make practice from it.
        </p>
      <//>`);
    const quick = async () => {
        setBusy("quick");
        try {
            const r = await api(`/api/units/${unit.id}/quick-pack`, { method: "POST", body: { types } });
            setStatus(`⚡ ${r.created} draft item(s) made from the unit's words. Check them below, then approve.`);
        }
        catch (e) {
            setStatus(`❌ ${e.message}`);
        }
        setBusy(null);
        onChange();
    };
    return (html`<div className="flex flex-col gap-6">
      <${Panel} title="🎒 This unit's lessons">
        <p className="text-ink-soft">
          Press the button to make the whole set of lessons for this unit from its words, patterns, sentences and reading texts. Changed them, or the rules? Remake the set. To change one lesson, open it below (✏️ Edit).
        </p>
        <div className="mt-1">
          <${RulesNote} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <${Button} variant="grape" disabled=${remake.running || !!busy} onClick=${() => confirm("Replace all lessons of this unit with a new set?") && remake.run(`/api/units/${unit.id}/resources`, {})}>
            ${remake.running ? "Making lessons…" : items.length ? "♻️ Remake this unit's lessons" : "✨ Make this unit's lessons"}
          <//>
        </div>
        <${JobLog} job=${remake} />
      <//>
      <${Panel} title="➕ Add extra practice">
        <p className="mb-2 text-sm text-ink-soft">Adds new items as drafts (the current lessons stay).</p>
        <p className="mb-3 text-ink-soft">
          Uses only this unit’s words and patterns (plus earlier units for review), at the book’s level${book.assessment ? ` (ages ${book.assessment.estimatedAge.min}–${book.assessment.estimatedAge.max})` : ""}.
        </p>
        <div className="flex flex-wrap gap-2">
          ${available.map((t) => {
        const on = types.includes(t);
        return (html`<button key=${t} aria-pressed=${on} onClick=${() => setTypes(on ? types.filter((x) => x !== t) : [...types, t])} className=${`rounded-full border-2 px-3 py-1 font-bold ${on ? `${TYPE_META[t].soft} border-ink` : "border-line bg-paper text-ink-soft"}`}>
                ${TYPE_META[t].icon} ${TYPE_META[t].label}
              </button>`);
    })}
        </div>
        ${(!hasPattern || !bookTexts(unit.extract).length) && html`<p className="mt-2 text-sm text-ink-soft">
            ${!hasPattern ? "Grammar needs a sentence pattern with ___ (tab “📖 From the book”). " : ""}${!bookTexts(unit.extract).length ? "Reading needs a reading text or 2+ sentences from the book." : ""}
          </p>`}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <${Button} variant="sun" disabled=${!!busy || !types.length} onClick=${quick} title="New practice from the unit's words, patterns and sentences, at the book's level">
            ${busy === "quick" ? "Making…" : "⚡ Make extra practice"}
          <//>
        </div>
        ${status && html`<pre className="mt-3 whitespace-pre-wrap rounded-xl bg-cream p-3 font-sans">${status}</pre>`}
      <//>
      <${Panel} title="🎒 Practice items">
        <${ItemList} items=${items} onChange=${onChange} />
      <//>
    </div>`);
}
