import { html } from "@/lib/html.js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, parentSession, useParentUnlocked } from "@/lib/client/api.js";
import { CloverMascot, Mascot } from "@/components/kids/index.js";
const NAV = [
    { href: "/parent", label: "Home", icon: "🏠" },
    { href: "/parent/books", label: "Books", icon: "📚" },
    { href: "/parent/rules", label: "Lesson rules", icon: "📏" },
    { href: "/parent/inspiration", label: "Inspiration", icon: "✨" },
    { href: "/parent/children", label: "Children", icon: "👧" },
    { href: "/parent/settings", label: "Settings", icon: "⚙️" },
];
export function ParentShell({ children }) {
    const unlocked = useParentUnlocked();
    const path = usePathname();
    if (unlocked === null)
        return null;
    if (!unlocked)
        return html`<${PinGate} onUnlock=${() => parentSession.unlock()} />`;
    const active = (href) => (href === "/parent" ? path === "/parent" : path.startsWith(href));
    return (html`<div className="flex min-h-screen flex-col md:flex-row">
      <aside className="no-print flex shrink-0 flex-col gap-1 border-b-2 border-line bg-paper p-3 md:sticky md:top-0 md:h-screen md:w-60 md:border-b-0 md:border-r-2">
        <${Link} href="/parent" className="mb-2 hidden items-center gap-2 px-2 md:flex">
          <${CloverMascot} size=${44} className="shrink-0" />
          <span className="font-display text-xl font-extrabold leading-tight">
            Emma English
            <br />
            <span className="text-sm font-bold text-ink-soft">Parent area</span>
          </span>
        <//>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          ${NAV.map((n) => (html`<${Link} key=${n.href} href=${n.href} className=${`flex min-h-11 shrink-0 items-center gap-3 rounded-2xl px-3 py-2 font-bold ${active(n.href) ? "bg-sun text-ink" : "text-ink-soft hover:bg-cream"} ${n.href === "/parent/inspiration" && !active(n.href) ? "text-grape-deep" : ""}`}>
              <span className="text-xl">${n.icon}</span>
              ${n.label}
            <//>`))}
        </nav>
        <div className="mt-auto hidden flex-col gap-2 md:flex">
          <${Link} href="/" className="btn-3d rounded-2xl border-2 border-ink bg-sky px-3 py-2 text-center font-bold [--shadow:#0277bd]">
            🧒 Child mode
          <//>
          <button onClick=${() => parentSession.lock()} className="rounded-2xl px-3 py-2 text-sm font-bold text-ink-soft hover:bg-cream">
            🔒 Lock
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">${children}</main>
    </div>`);
}
function PinGate({ onUnlock }) {
    const [pin, setPin] = useState("");
    const [setup, setSetup] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        api("/api/settings/pin", { body: { action: "verify", pin: "" } })
            .then((r) => r.needsSetup && setSetup({}))
            .catch(() => { });
    }, []);
    const submit = async (value) => {
        setError(null);
        if (setup) {
            if (!setup.first) {
                setSetup({ first: value });
                setPin("");
                return;
            }
            if (setup.first !== value) {
                setError("The two PINs don't match. Try again.");
                setSetup({});
                setPin("");
                return;
            }
            await api("/api/settings/pin", { body: { action: "set", pin: value } });
            onUnlock();
            return;
        }
        try {
            await api("/api/settings/pin", { body: { action: "verify", pin: value } });
            onUnlock();
        }
        catch {
            setError("Wrong PIN.");
            setPin("");
        }
    };
    const press = (d) => {
        if (d === "⌫")
            return setPin((p) => p.slice(0, -1));
        const next = (pin + d).slice(0, 4);
        setPin(next);
        if (next.length === 4)
            void submit(next);
    };
    return (html`<main className="bg-dots flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <${Mascot} size=${90} say=${setup ? (setup.first ? "Type it again to confirm." : "Create a 4-digit parent PIN.") : "Parents only! Enter your PIN."} />
      <div className="flex gap-3" aria-label="PIN">
        ${[0, 1, 2, 3].map((k) => (html`<span key=${k} className=${`h-6 w-6 rounded-full border-[3px] border-ink ${k < pin.length ? "bg-ink" : "bg-paper"}`} />`))}
      </div>
      ${error && html`<p className="font-bold text-berry-deep">${error}</p>`}
      <div className="grid grid-cols-3 gap-3">
        ${["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, k) => d ? (html`<button key=${k} onClick=${() => press(d)} className="btn-3d h-20 w-20 rounded-3xl border-[3px] border-ink bg-paper font-display text-3xl font-bold [--shadow:#e3d3ad]">
              ${d}
            </button>`) : (html`<span key=${k} />`))}
      </div>
      <${Link} href="/" className="font-bold text-ink-soft underline">
        ← Back to child mode
      <//>
    </main>`);
}
