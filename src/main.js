/**
 * Emma English Studio — static edition (GitHub Pages).
 * Boot: open the family's database (SQLite in this browser), answer /api/… inside the page,
 * add the demo book on a brand-new device, then show the screen for the current #/route.
 */
import { Component } from "react";
import { createRoot } from "react-dom/client";
import { html } from "@/lib/html.js";
import { useRoute } from "next/navigation";
import Link from "next/link";
import { openDb } from "@/server/db.js";
import { installApi } from "@/server/routes.js";
import { seedDemo } from "@/server/demo.js";
import { getSetting, listBooks, listChildren } from "@/server/repo.js";
import { loadPageIndex } from "@/server/books/pages.js";
import { persistStorage } from "@/server/vfs.js";
import { SettingsSync } from "@/features/SettingsSync.js";
import { Loading } from "@/components/kids/index.js";
import { MyWorld, PlayScreen, Playground, StickerBook, WhoIsLearning } from "@/features/child/screens.js";
import { ParentShell } from "@/features/parent/shell.js";
import { ParentHome } from "@/features/parent/home.js";
import { BookDetail, BooksPage } from "@/features/parent/books.js";
import { ChildrenPage } from "@/features/parent/children.js";
import { InspirationPage, TopicDetail } from "@/features/parent/inspiration.js";
import { ItemDetail } from "@/features/parent/items.js";
import { RulesPage } from "@/features/parent/rules.js";
import { SettingsPage } from "@/features/parent/settings.js";
import { UnitWorkspace } from "@/features/parent/unit.js";
import { PresentScreen, PrintScreen } from "@/features/present.js";

/** The app's screens (same paths as the desktop app, after "#"). */
const ROUTES = [
  ["/", () => html`<${WhoIsLearning} />`],
  ["/learn", () => html`<${MyWorld} />`],
  ["/learn/stickers", () => html`<${StickerBook} />`],
  ["/learn/play/:itemId", ({ itemId }, q) => {
    const back = q.get("back");
    return html`<${PlayScreen} itemId=${itemId} back=${back && back.startsWith("/learn") ? back : "/learn"} />`;
  }],
  ["/learn/topic/:topicId", ({ topicId }) => html`<${Playground} kind="topic" id=${topicId} />`],
  ["/learn/unit/:unitId", ({ unitId }) => html`<${Playground} kind="unit" id=${unitId} />`],
  ["/parent", () => html`<${ParentHome} />`, true],
  ["/parent/books", () => html`<${BooksPage} />`, true],
  ["/parent/books/:bookId", ({ bookId }) => html`<${BookDetail} bookId=${bookId} />`, true],
  ["/parent/children", () => html`<${ChildrenPage} />`, true],
  ["/parent/inspiration", () => html`<${InspirationPage} />`, true],
  ["/parent/inspiration/:topicId", ({ topicId }) => html`<${TopicDetail} topicId=${topicId} />`, true],
  ["/parent/items/:itemId", ({ itemId }) => html`<${ItemDetail} itemId=${itemId} />`, true],
  ["/parent/rules", () => html`<${RulesPage} />`, true],
  ["/parent/settings", () => html`<${SettingsPage} />`, true],
  ["/parent/units/:unitId", ({ unitId }) => html`<${UnitWorkspace} unitId=${unitId} />`, true],
  ["/present/:itemId", ({ itemId }) => html`<${PresentScreen} itemId=${itemId} />`],
  ["/print/:itemId", ({ itemId }) => html`<${PrintScreen} itemId=${itemId} />`],
].map(([pattern, render, parent]) => ({
  keys: [...pattern.matchAll(/:(\w+)/g)].map((m) => m[1]),
  re: new RegExp("^" + pattern.replace(/:(\w+)/g, "([^/]+)") + "$"),
  render,
  parent: !!parent,
}));

function NotFound() {
  return html`<main className="bg-dots flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
    <p className="text-7xl">🍀</p>
    <h1 className="text-3xl font-extrabold">This page is not here</h1>
    <${Link} href="/" className="btn-3d rounded-2xl border-[3px] border-ink bg-sun px-6 py-3 font-display text-xl font-bold [--shadow:#e09b00]">🏠 Go home<//>
  </main>`;
}

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error(error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return html`<main className="bg-dots flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl">🙈</p>
      <h1 className="text-2xl font-extrabold">Oops! Something went wrong.</h1>
      <pre className="max-w-xl whitespace-pre-wrap rounded-xl bg-paper p-3 text-left text-sm">${String(this.state.error?.message ?? this.state.error)}</pre>
      <div className="flex gap-2">
        <button className="btn-3d rounded-2xl border-2 border-ink bg-sun px-4 py-2 font-bold [--shadow:#e09b00]" onClick=${() => this.setState({ error: null })}>Try again</button>
        <a className="btn-3d rounded-2xl border-2 border-line bg-paper px-4 py-2 font-bold" href="#/">🏠 Home</a>
      </div>
    </main>`;
  }
}

function Screen() {
  const { path, query } = useRoute();
  const q = new URLSearchParams(query);
  for (const r of ROUTES) {
    const m = r.re.exec(path);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const page = r.render(params, q);
    // A new key per path: a different unit/item is a fresh screen (like Next.js pages).
    return html`<${ErrorBoundary} key=${path}>${r.parent ? html`<${ParentShell}>${page}<//>` : page}<//>`;
  }
  return html`<${NotFound} />`;
}

function App() {
  return html`<${SettingsSync} /><${Screen} />`;
}

function BootError({ error }) {
  return html`<main className="bg-dots flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
    <p className="text-6xl">🍀</p>
    <h1 className="text-2xl font-extrabold">Emma English Studio could not start</h1>
    <p className="max-w-xl">${error}</p>
    <p className="max-w-xl text-sm text-ink-soft">Please use a recent Chrome, Edge, Safari or Firefox (not a private window), then reload the page.</p>
  </main>`;
}

async function boot() {
  const root = createRoot(document.getElementById("root"));
  root.render(html`<${Loading} />`);
  try {
    await openDb();
    await loadPageIndex();
    installApi();
    // A brand-new device gets the demo book and a demo child, so there is something to try at once.
    if (getSetting("demoSeeded") !== "1" && !listBooks().length && !listChildren().length) seedDemo();
    void persistStorage();
  } catch (e) {
    console.error(e);
    root.render(html`<${BootError} error=${e?.message ?? String(e)} />`);
    return;
  }
  root.render(html`<${App} />`);
}

void boot();
