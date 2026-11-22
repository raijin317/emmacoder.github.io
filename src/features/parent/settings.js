import { html, Fragment } from "@/lib/html.js";
import { useEffect, useState } from "react";
import { api, streamSSE, useApi } from "@/lib/client/api.js";
import { Button, Field, PageHeader, Panel, ProgressBar, inputCls } from "@/components/ui.js";
import { Loading } from "@/components/kids/index.js";
import { loadVoices, pickVoice, speak } from "@/lib/client/speech.js";
import { sfx } from "@/lib/client/sfx.js";
import { NATURAL_VOICES } from "@/lib/voices.js";
import { allowNaturalVoice, loadModel, modelState, naturalVoiceAllowed, onModelState, warmVoices } from "@/lib/client/tts.js";
import { storageEstimate } from "@/server/vfs.js";
import { applySettings } from "../SettingsSync.js";
/** Pre-generates the natural voice for all approved lessons (runs in this browser). */
export function PrepareVoices({ target = "all", label = "🎙️ Prepare voices for all lessons" }) {
    const [busy, setBusy] = useState(false);
    const [pct, setPct] = useState(null);
    const [msg, setMsg] = useState(null);
    return (html`<div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <${Button} disabled=${busy} onClick=${async () => {
        setBusy(true);
        setMsg(null);
        setPct(0);
        try {
            await streamSSE("/api/tts/prepare", { target }, (_ev, d) => {
                const x = d;
                if (x?.progress !== undefined)
                    setPct(x.progress);
                if (x?.msg)
                    setMsg(x.msg);
            });
        }
        catch (e) {
            setMsg(e.message);
        }
        setBusy(false);
    }}>
          ${busy ? "Preparing…" : label}
        <//>
        ${msg && html`<span className="text-sm">${msg}</span>`}
      </div>
      ${busy && pct !== null && html`<${ProgressBar} value=${pct} tone="bg-sky" />`}
    </div>`);
}
/** The background warm-up (server makes the voice for every lesson while nobody is tapping). */
function VoiceWarmUp() {
    const { data, reload } = useApi("/api/settings");
    const w = data?.voiceWarmUp;
    useEffect(() => {
        if (!w?.running)
            return;
        const t = setInterval(reload, 5000);
        return () => clearInterval(t);
    }, [w?.running, reload]);
    if (!w?.running || !w.total)
        return null;
    return (html`<div className="mt-3 rounded-2xl border-2 border-sky bg-sky-soft p-3 text-sm" role="status">
      <p className="font-bold">
        🎙️ Getting the voice ready for all lessons in the background: ${w.done}/${w.total}
      </p>
      <p className="text-ink-soft">The app can be used meanwhile — what your child taps is always made first.</p>
      <${ProgressBar} value=${(w.done / w.total) * 100} tone="bg-sky" />
    </div>`);
}
/** The natural voice is made in this browser: the parent downloads the voice model once (about 90 MB). */
function NaturalVoiceSetup({ onReady }) {
    const [allowed, setAllowed] = useState(naturalVoiceAllowed);
    const [m, setM] = useState(modelState);
    useEffect(() => onModelState(setM), []);
    useEffect(() => {
        if (allowed && m.status === "off")
            loadModel().catch(() => { });
    }, [allowed, m.status]);
    useEffect(() => {
        if (m.status === "ready")
            onReady?.();
    }, [m.status]);
    if (allowed && m.status === "ready")
        return html`<p className="mb-3 rounded-2xl bg-grass-soft p-3 text-sm font-bold text-grass-deep">✅ The natural voice is ready in this browser.</p>`;
    const pct = m.total ? Math.round((m.loaded / m.total) * 100) : 0;
    return (html`<div className="mb-4 flex flex-col gap-2 rounded-2xl border-2 border-sky bg-sky-soft p-3">
      ${!allowed ? html`<${Fragment}>
          <p><b>The natural voice runs inside this browser.</b> The first time, it downloads the voice (about 90 MB, once — it is kept for next time). Until it is ready, the browser voice speaks.</p>
          <div><${Button} variant="sun" onClick=${() => {
        allowNaturalVoice(true);
        setAllowed(true);
    }}>⬇️ Download the natural voice<//></div>
        <//>` : m.status === "error" ? html`<${Fragment}>
          <p className="font-bold text-berry-deep">❌ The natural voice could not start: ${m.error}</p>
          <p className="text-sm">Check the internet connection (needed for the first download), then try again. The browser voice speaks meanwhile.</p>
          <div><${Button} onClick=${() => loadModel().catch(() => { })}>🔄 Try again<//></div>
        <//>` : html`<${Fragment}>
          <p className="font-bold">⏳ ${m.total ? `Downloading the natural voice… ${pct}% (${Math.round(m.loaded / 1048576)} / ${Math.round(m.total / 1048576)} MB)` : "Starting the natural voice…"}</p>
          <${ProgressBar} value=${pct} tone="bg-sky" />
          <p className="text-sm text-ink-soft">The app can be used meanwhile (the browser voice speaks until it is ready).</p>
        <//>`}
    </div>`);
}
/** Backup to a file (and restore) — the family's data lives only in this browser. */
async function downloadBackup() {
    const res = await fetch("/api/backup");
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `emma-english-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
function StorageInfo() {
    const [est, setEst] = useState(null);
    useEffect(() => {
        void storageEstimate().then(setEst);
    }, []);
    if (!est?.usage)
        return null;
    return html`<p className="mt-2 text-sm text-ink-soft">This browser keeps ${(est.usage / 1048576).toFixed(1)} MB for the app${est.quota ? ` (room for about ${Math.round(est.quota / 1073741824)} GB)` : ""}.</p>`;
}
export function SettingsPage() {
    const { data, setData } = useApi("/api/settings");
    const [voices, setVoices] = useState([]);
    const [pin, setPin] = useState({ current: "", next: "" });
    const [msg, setMsg] = useState(null);
    useEffect(() => {
        loadVoices().then(setVoices);
    }, []);
    if (!data)
        return html`<${Loading} />`;
    const s = data.settings;
    const save = async (patch) => {
        const r = await api("/api/settings", { method: "PATCH", body: patch });
        setData({ settings: r.settings });
        applySettings(r.settings);
    };
    const auto = pickVoice(voices);
    const SAMPLE = "Hello, friend! Look, a little green clover! It has four leaves. Can you say clover? Great job!";
    return (html`<div className="mx-auto flex max-w-4xl flex-col gap-6">
      <${PageHeader} emoji="⚙️" title="Settings" />

      <${Panel} title="🔊 Voice (American English)">
        <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Voice type">
          ${[
        ["natural", "🌟 Natural voice (recommended)", "Human-like and expressive. Made in this browser after a one-time download (~90 MB)."],
        ["browser", "🖥️ Browser voice", "The browser's built-in voice. Nothing to download; sounds more robotic."],
    ].map(([k, label, hint]) => (html`<button key=${k} role="radio" aria-checked=${s.ttsEngine === k} onClick=${() => save({ ttsEngine: k })} className=${`flex-1 rounded-2xl border-2 p-3 text-left ${s.ttsEngine === k ? "border-ink bg-sun-soft" : "border-line bg-paper"}`}>
              <b>${label}</b>
              <span className="block text-sm text-ink-soft">${hint}</span>
            </button>`))}
        </div>

        ${s.ttsEngine === "natural" ? (html`<${Fragment}>
            <${NaturalVoiceSetup} onReady=${() => warmVoices(1000)} />
            <p className="mb-2 font-bold">Choose a voice — press ▶ to listen</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              ${NATURAL_VOICES.map((v) => (html`<div key=${v.id} className=${`flex items-center gap-2 rounded-2xl border-2 p-2 ${s.ttsVoice === v.id ? "border-ink bg-sun-soft" : "border-line"}`}>
                  <button aria-label=${`Listen to ${v.label}`} onClick=${() => speak(SAMPLE, { voice: v.id })} className="btn-3d h-11 w-11 shrink-0 rounded-full border-2 border-ink bg-sky text-lg [--shadow:#0277bd]">
                    ▶
                  </button>
                  <button className="min-w-0 flex-1 text-left" onClick=${() => save({ ttsVoice: v.id })}>
                    <b>
                      ${v.gender === "female" ? "👩" : "👨"} ${v.label}
                    </b>
                    ${s.ttsVoice === v.id && html`<span className="ml-1 text-grass-deep">✓</span>`}
                    <span className="block text-xs text-ink-soft">${v.note}</span>
                  </button>
                </div>`))}
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              Each time the app opens, the voice engine loads for a few seconds. Every sentence is made once and saved in this browser, then plays instantly. After you change the voice or the speed, the app makes the new voice for all lessons by itself in the background.
            </p>
            <${VoiceWarmUp} />
            <${PrepareVoices} />
          <//>`) : (html`<${Field} label="Browser voice" hint=${voices.length ? `${voices.length} en-US voice(s) in this browser. Microsoft Edge has the most natural ones (e.g. “Ana”, “Ava”, “Jenny”).` : "No en-US voice found — try Microsoft Edge."}>
            <select className=${inputCls} value=${s.voiceName} onChange=${(e) => save({ voiceName: e.target.value })}>
              <option value="">Automatic${auto ? ` (${auto.name})` : ""}</option>
              ${voices.map((v) => (html`<option key=${v.name} value=${v.name}>
                  ${v.name}
                </option>`))}
            </select>
          <//>`)}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <${Field} label=${`Speed for children: ${s.childRate.toFixed(2)}`} hint="0.85 is a good speed for young learners. The 🐢 button is always slower.">
            <input type="range" min=${0.6} max=${1.2} step=${0.05} value=${s.childRate} onChange=${(e) => save({ childRate: Number(e.target.value) })} />
          <//>
          <div className="flex items-end">
            <${Button} variant="sun" onClick=${() => speak(SAMPLE)}>
              ▶ Test the current voice
            <//>
          </div>
        </div>
      <//>

      <${Panel} title="🎈 Fun & healthy habits">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 font-bold">
            <input type="checkbox" className="h-6 w-6" checked=${s.soundOn} onChange=${(e) => void save({ soundOn: e.target.checked }).then(() => sfx("correct"))} />
            Sound effects
          </label>
          <${Field} label="Suggest a break after (minutes per day)">
            <input className=${inputCls} type="number" min=${5} max=${90} value=${s.breakMinutes} onChange=${(e) => save({ breakMinutes: Number(e.target.value) })} />
          <//>
        </div>
      <//>

      <${Panel} title="🔒 Parent PIN">
        <div className="flex flex-wrap items-end gap-3">
          <${Field} label="Current PIN">
            <input className=${inputCls} type="password" inputMode="numeric" maxLength=${4} value=${pin.current} onChange=${(e) => setPin({ ...pin, current: e.target.value })} />
          <//>
          <${Field} label="New PIN (4 digits)">
            <input className=${inputCls} type="password" inputMode="numeric" maxLength=${4} value=${pin.next} onChange=${(e) => setPin({ ...pin, next: e.target.value })} />
          <//>
          <${Button} variant="primary" onClick=${async () => {
        try {
            await api("/api/settings/pin", { body: { action: "set", pin: pin.next, currentPin: pin.current } });
            setMsg("PIN changed.");
            setPin({ current: "", next: "" });
        }
        catch (e) {
            setMsg(e.message);
        }
    }}>
            Change PIN
          <//>
        </div>
        ${msg && html`<p className="mt-2 font-bold">${msg}</p>`}
      <//>

      <${Panel} title="💾 Backup">
        <p className="mb-3 text-ink-soft">
          Everything is saved <b>in this browser, on this device</b> (nothing is sent to the internet). Export a backup file now and then to keep it safe, or to move it to another computer or browser. The file has the children, progress, books' units and lessons (not the book PDFs — add a PDF again on the other device to see its pages). Backups from the desktop app can be restored here too.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick=${() => void downloadBackup()} className="btn-3d inline-flex min-h-11 items-center rounded-2xl border-2 border-ink bg-sun px-4 font-bold [--shadow:#e09b00]">
            ⬇️ Export backup
          </button>
          <label className="btn-3d inline-flex min-h-11 cursor-pointer items-center rounded-2xl border-2 border-line bg-paper px-4 font-bold">
            ⬆️ Restore from file
            <input type="file" accept="application/json" className="hidden" onChange=${async (e) => {
        const f = e.target.files?.[0];
        if (!f || !confirm("Replace ALL current data with this backup?"))
            return;
        try {
            await api("/api/backup", { body: JSON.parse(await f.text()) });
            alert("Restored!");
            location.reload();
        }
        catch (err) {
            alert(err.message);
        }
    }} />
          </label>
        </div>
        <${StorageInfo} />
      <//>
    </div>`);
}
