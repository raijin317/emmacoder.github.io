import { html } from "@/lib/html.js";
import Link from "next/link";
import { useState } from "react";
import { api, useApi } from "@/lib/client/api.js";
import { Badge, Button, PageHeader, Panel, inputCls } from "@/components/ui.js";
import { ErrorBox, Loading } from "@/components/kids/index.js";
import { RULE_EFFECT, isBuiltInRule } from "@/lib/rules.js";
/** Parent page: the rules every lesson made from a book must follow. */
export function RulesPage() {
    const { data, error, reload, setData } = useApi("/api/rules");
    const [saved, setSaved] = useState(false);
    if (error)
        return html`<${ErrorBox} message=${error} onRetry=${reload} />`;
    if (!data)
        return html`<${Loading} />`;
    return (html`<${RulesEditor} key=${JSON.stringify(data.rules)} data=${data} saved=${saved} onSaved=${(rules) => {
        setSaved(true);
        setData({ ...data, rules });
    }} />`);
}
function RulesEditor({ data, onSaved, saved }) {
    const [rules, setRules] = useState(data.rules);
    const [msg, setMsg] = useState(null);
    const dirty = JSON.stringify(rules) !== JSON.stringify(data.rules);
    const upd = (i, patch) => {
        setRules(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
        setMsg(null);
    };
    const save = async (body) => {
        try {
            const r = await api("/api/rules", { method: "PUT", body });
            onSaved(r.rules);
        }
        catch (e) {
            const err = e;
            setMsg({ ok: false, text: `${err.message} ${err.details ?? ""}` });
        }
    };
    return (html`<div className="mx-auto flex max-w-4xl flex-col gap-6">
      <${PageHeader} emoji="📏" title="Lesson rules" subtitle="Every lesson made from a book follows these rules." />
      <${Panel}>
        <p>
          Emma follows these rules when it makes lessons from your books — when you press <b>✨ Make lessons</b> or <b>♻️ Remake</b>. Edit the words, switch a rule off, or add your own (English or Vietnamese is fine) — your own rules are a checklist for you when you check and edit the lessons.
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Changes apply to lessons made from now on. To update lessons that already exist, open the book in${" "}
          <${Link} href="/parent/books" className="underline">
            📚 Books
          <//>${" "}
          and press <b>♻️ Remake all lessons</b>. (“Book pictures” changes right away.)
        </p>
      <//>

      <div className="flex flex-col gap-3">
        ${rules.map((r, i) => {
        const builtIn = isBuiltInRule(r.id);
        const def = data.defaults.find((d) => d.id === r.id);
        return (html`<div key=${r.id} className=${`rounded-3xl border-2 p-4 transition ${r.on ? "border-grass bg-paper" : "border-line bg-cream opacity-75"}`}>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sun font-display text-lg font-bold">${i + 1}</span>
                <label className="flex cursor-pointer items-center gap-2 font-bold">
                  <input type="checkbox" role="switch" className="h-6 w-6 accent-grass" checked=${r.on} onChange=${(e) => upd(i, { on: e.target.checked })} aria-label=${`Rule ${i + 1} on`} />
                  ${r.on ? "On" : "Off"}
                </label>
                ${builtIn ? html`<${Badge} tone="sky">Built-in<//>` : html`<${Badge} tone="grape">Your rule<//>`}
                <span className="flex-1" />
                ${builtIn && def && def.text !== r.text && (html`<${Button} onClick=${() => upd(i, { text: def.text })} title="Put back the original wording">
                    ↩ Original wording
                  <//>`)}
                ${!builtIn && (html`<${Button} variant="danger" aria-label=${`Delete rule ${i + 1}`} onClick=${() => setRules(rules.filter((_, k) => k !== i))}>
                    🗑️
                  <//>`)}
              </div>
              <textarea className=${`${inputCls} w-full`} rows=${2} value=${r.text} maxLength=${600} onChange=${(e) => upd(i, { text: e.target.value })} aria-label=${`Rule ${i + 1}`} />
              ${builtIn && RULE_EFFECT[r.id] && html`<p className="mt-1 text-sm text-ink-soft">⚙️ ${RULE_EFFECT[r.id]}</p>`}
            </div>`);
    })}
        <${Button} className="self-start" disabled=${rules.length >= 30} onClick=${() => setRules([...rules, { id: `custom-${Date.now().toString(36)}`, text: "", on: true }])}>
          + Add a rule
        <//>
      </div>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-line bg-paper p-3 shadow-lg">
        <${Button} variant="primary" disabled=${!dirty || rules.some((r) => !r.text.trim())} onClick=${() => save({ rules })}>
          💾 Save rules
        <//>
        <${Button} disabled=${!dirty} onClick=${() => setRules(data.rules)}>
          ↩ Undo changes
        <//>
        <${Button} onClick=${() => confirm("Go back to the 4 original rules? Your own rules will be removed.") && save({ reset: true })}>Reset to defaults<//>
        ${dirty && html`<span className="text-sm font-bold text-orange-deep">Unsaved changes</span>`}
        ${!dirty && saved && html`<span className="text-sm font-bold text-grass-deep">✅ Saved — new lessons will follow these rules.</span>`}
        ${msg && html`<span className=${`text-sm font-bold ${msg.ok ? "text-grass-deep" : "text-berry-deep"}`}>${msg.text}</span>`}
      </div>
    </div>`);
}
/** A short line + link shown where lessons are made. */
export function RulesNote() {
    const { data } = useApi("/api/rules");
    const on = data?.rules.filter((r) => r.on).length;
    return (html`<p className="text-sm text-ink-soft">
      📏 Lessons follow your${" "}
      <${Link} href="/parent/rules" className="font-bold underline">
        lesson rules${on !== undefined ? ` (${on} on)` : ""}
      <//>
      .
    </p>`);
}
