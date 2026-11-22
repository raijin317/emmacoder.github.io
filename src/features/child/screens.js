import { html, Fragment } from "@/lib/html.js";
import { ApiImg } from "@/components/ApiImg.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, childSession, useApi, useChildId } from "@/lib/client/api.js";
import { BigButton, CloverMascot, ErrorBox, Loading, Mascot, SpeakButton, StickerArt, Trophy } from "@/components/kids/index.js";
import { TYPE_META, GAME_ICON } from "@/lib/contentMeta.js";
import { STARS_PER_STICKER, STICKERS, albumState } from "@/lib/stickers.js";
import { ItemPlayer } from "../players/ItemPlayer.js";
import { speak } from "@/lib/client/speech.js";
import { sfx } from "@/lib/client/sfx.js";
function useLearn() {
    const childId = useChildId();
    const router = useRouter();
    useEffect(() => {
        if (childId === null)
            router.replace("/");
    }, [childId, router]);
    const res = useApi(childId ? `/api/learn/${childId}` : null);
    return { childId, ...res };
}
/* ------------------------------ top bar ------------------------------ */
function KidTopBar({ child, stars, trophies = 0, back, title }) {
    return (html`<div className="sticky top-0 z-20 flex items-center gap-3 border-b-[3px] border-ink bg-sun px-4 py-3">
      ${back ? (html`<${Link} href=${back} aria-label="Back" className="btn-3d flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-ink bg-paper text-3xl [--shadow:#e09b00]">
          ◀
        <//>`) : (html`<${Link} href="/" aria-label="Change child" className="btn-3d flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-ink bg-paper text-4xl [--shadow:#e09b00]">
          ${child?.avatar ?? "🏠"}
        <//>`)}
      <div className="min-w-0 flex-1 font-display text-2xl font-extrabold">${title ?? (child ? `Hi, ${child.name}!` : "")}</div>
      ${stars !== undefined && (html`<${Link} href="/learn/stickers" aria-label=${`My sticker book: ${stars} stars${trophies ? `, ${trophies} trophies` : ""}`} className="btn-3d flex items-center gap-3 rounded-2xl border-[3px] border-ink bg-paper px-4 py-2 font-display text-2xl font-bold [--shadow:#e09b00]">
          <span>⭐ ${stars}</span>
          ${trophies > 0 && html`<span>🏆 ${trophies}</span>`}
        <//>`)}
    </div>`);
}
/* --------------------------- who's learning --------------------------- */
export function WhoIsLearning() {
    const { data, error, loading, reload } = useApi("/api/children");
    const router = useRouter();
    return (html`<main className="bg-dots flex min-h-screen flex-col">
      <div className="flex justify-end p-4">
        <${Link} href="/parent" className="btn-3d rounded-2xl border-2 border-ink bg-paper px-4 py-2 font-bold [--shadow:#e3d3ad]">
          👪 Parent
        <//>
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-10 px-4 pb-16">
        <${Mascot} size=${130} say="Hello! Who's learning today?" />
        ${loading && html`<${Loading} />`}
        ${error && html`<${ErrorBox} message=${error} onRetry=${reload} />`}
        ${data && !data.children.length && (html`<p className="text-center text-2xl">
            No learners yet! Ask your parent to add you in <b>👪 Parent → Children</b>.
          </p>`)}
        <div className="grid w-full grid-cols-2 gap-6 md:grid-cols-3">
          ${data?.children.map((c, k) => (html`<button key=${c.id} onClick=${() => {
        childSession.set(c.id);
        speak(`Hello, ${c.name}!`);
        router.push("/learn");
    }} style=${{ animationDelay: `${k * 90}ms` }} className=${`btn-3d lift flex flex-col items-center gap-2 rounded-[32px] border-4 border-ink p-6 motion-safe:animate-pop-in ${["bg-sky", "bg-berry", "bg-grass", "bg-orange", "bg-grape", "bg-sun"][k % 6]} [--shadow:#2b2d42]`}>
              <span className="text-8xl motion-safe:animate-float" style=${{ animationDelay: `${k * 0.4}s` }}>
                ${c.avatar}
              </span>
              <span className="font-display text-3xl font-extrabold">${c.name}</span>
              <span className="rounded-full bg-paper/80 px-3 font-bold">⭐ ${c.stats.totalStars}</span>
            </button>`))}
        </div>
      </div>
    </main>`);
}
/* ------------------------------ My World ------------------------------ */
const ISLAND = [
    { bg: "bg-sky", ring: "#0277bd" },
    { bg: "bg-grass", ring: "#2e7d32" },
    { bg: "bg-berry", ring: "#c2185b" },
    { bg: "bg-orange", ring: "#d9480f" },
    { bg: "bg-grape", ring: "#6a3fb5" },
    { bg: "bg-sun", ring: "#e09b00" },
];
/** Horizontal position (%) of each stop on the winding path. */
const PATH_X = [50, 76, 50, 24];
const ROW = 210;
function Clouds() {
    return (html`<div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      ${[
        { top: "4%", size: "text-6xl", delay: "-8s", dur: "70s" },
        { top: "22%", size: "text-5xl", delay: "-35s", dur: "90s" },
        { top: "48%", size: "text-7xl", delay: "-20s", dur: "110s" },
    ].map((c, k) => (html`<span key=${k} className=${`absolute left-0 opacity-80 motion-safe:animate-drift ${c.size}`} style=${{ top: c.top, animationDelay: c.delay, animationDuration: c.dur }}>
          ☁️
        </span>`))}
    </div>`);
}
/** The unit's book picture in a circle (or its emoji). */
function IslandPicture({ src, emoji, className = "" }) {
    return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    html`<${ApiImg} src=${src} alt="" draggable=${false} className=${`h-full w-full rounded-full bg-white object-contain p-2 ${className}`} />`) : (html`<span className=${`text-6xl md:text-7xl ${className}`}>${emoji}</span>`);
}
export function MyWorld() {
    const { data, error, reload, setData } = useLearn();
    if (!data)
        return error ? html`<${ErrorBox} message=${error} onRetry=${reload} />` : html`<${Loading} />`;
    const { child, books, topics, stats } = data;
    const book = books.find((b) => b.id === child.activeBookId) ?? books[0] ?? null;
    const units = book?.units ?? [];
    const pickBook = (id) => {
        sfx("tap");
        setData({ ...data, child: { ...child, activeBookId: id } });
        void api(`/api/children/${child.id}`, { method: "PATCH", body: { activeBookId: id } }).catch(() => { });
    };
    const done = (items) => items.filter((i) => stats.bestStarsByItem[i.id]).length;
    const goalPct = Math.min(100, (stats.minutesToday / Math.max(1, child.dailyGoalMinutes)) * 100);
    const needBreak = stats.minutesToday >= data.settings.breakMinutes;
    const nextUnit = units.find((u) => done(u.items) < u.items.length) ?? null;
    return (html`<main className="flex min-h-screen flex-col">
      <${KidTopBar} child=${child} stars=${stats.totalStars} trophies=${stats.trophies.length} />
      <div className="sky-bg relative flex-1">
        <${Clouds} />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 motion-safe:animate-page-in">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <${Mascot} size=${90} say=${needBreak ? "Great work! Time for a little break 🧃" : nextUnit ? `Let's go to ${nextUnit.title}!` : units.length ? "You did them all! Play again? 🌟" : "Your parent is getting things ready!"} />
            <div className="min-w-60 rounded-3xl border-[3px] border-ink bg-paper/90 p-4">
              <p className="font-display text-lg font-bold">
                🌻 Today: ${stats.minutesToday} / ${child.dailyGoalMinutes} min
              </p>
              <div className="mt-2 h-5 overflow-hidden rounded-full border-2 border-ink bg-cream">
                <div className="h-full rounded-full bg-grass transition-all duration-700" style=${{ width: `${goalPct}%` }} />
              </div>
            </div>
          </div>

          ${books.length > 1 ? (html`<div className="flex gap-4 overflow-x-auto pb-2 pt-1" role="tablist" aria-label="My books">
              ${books.map((b) => {
        const on = b.id === book?.id;
        return (html`<button key=${b.id} role="tab" aria-selected=${on} onClick=${() => pickBook(b.id)} className=${`lift flex shrink-0 items-center gap-3 rounded-[22px] border-[3px] border-ink px-3 py-2 font-display text-xl font-extrabold ${on ? "bg-sun shadow-[0_6px_0_0_#e09b00]" : "bg-paper opacity-80 shadow-[0_6px_0_0_#e3d3ad]"}`}>
                    <${BookCoverThumb} src=${b.cover} />
                    <span className="max-w-56 text-left leading-tight">${b.title}</span>
                  </button>`);
    })}
            </div>`) : (book && (html`<div className="flex items-center gap-3">
                <${BookCoverThumb} src=${book.cover} />
                <h2 className="font-display text-3xl font-extrabold">${book.title}</h2>
              </div>`))}
          ${book && !units.length && (html`<p className="rounded-3xl border-[3px] border-dashed border-ink bg-paper p-5 text-center font-display text-2xl">
              ${book.status === "ready" ? "This book has no lessons yet." : "Your lessons are being made… 🍀 Come back soon!"}
            </p>`)}
          ${!books.length && html`<p className="text-center font-display text-2xl">Ask your parent to choose a book for you 📚</p>`}

          ${units.length > 0 && html`<${AdventurePath} key=${book?.id} units=${units} done=${done} nextId=${nextUnit?.id ?? null} />`}

          ${topics.length > 0 && (html`<section className="mt-4">
              <h2 className="mb-4 font-display text-3xl font-extrabold">✨ Bonus islands</h2>
              <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
                ${topics.map((t, k) => (html`<${Link} key=${t.id} href=${`/learn/topic/${t.id}`} onClick=${() => sfx("pop")} style=${{ animationDelay: `${k * 80}ms` }} className="lift relative flex flex-col items-center gap-1 rounded-[50%/40%] border-4 border-ink bg-grape-soft px-4 py-8 text-center shadow-[0_6px_0_0_#6a3fb5] motion-safe:animate-pop-in">
                    <span className="absolute -right-1 -top-2 text-3xl motion-safe:animate-wiggle">✨</span>
                    ${t.pic ? (
    // eslint-disable-next-line @next/next/no-img-element
    html`<${ApiImg} src=${t.pic} alt="" draggable=${false} className="h-24 w-24 rounded-full border-[3px] border-ink bg-white object-cover" />`) : (html`<span className="text-7xl">${t.emoji}</span>`)}
                    <span className="font-display text-2xl font-extrabold">${t.title}</span>
                    <${StarProgress} done=${done(t.items)} total=${t.items.length} />
                  <//>`))}
              </div>
            </section>`)}
        </div>
      </div>
    </main>`);
}
function BookCoverThumb({ src }) {
    return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    html`<${ApiImg} src=${src} alt="" className="h-16 w-12 shrink-0 rounded-md border-2 border-ink bg-white object-cover shadow-sm" />`) : (html`<span className="text-4xl">📘</span>`);
}
function StarProgress({ done, total }) {
    return (html`<span className="rounded-full border-2 border-ink bg-paper px-3 py-0.5 text-sm font-extrabold">
      ⭐ ${done}/${total}
    </span>`);
}
/** Units as stops on a winding path; the next stop to play glows and the clover waits there. */
function AdventurePath({ units, done, nextId }) {
    const height = units.length * ROW;
    const pts = units.map((_, k) => ({ x: PATH_X[k % PATH_X.length], y: k * ROW + 70 }));
    const d = pts.map((p, k) => (k === 0 ? `M ${p.x} ${p.y}` : `C ${pts[k - 1].x} ${pts[k - 1].y + ROW / 2}, ${p.x} ${p.y - ROW / 2}, ${p.x} ${p.y}`)).join(" ");
    return (html`<div className="relative mx-auto w-full max-w-3xl" style=${{ height }}>
      <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox=${`0 0 100 ${height}`} preserveAspectRatio="none">
        <path d=${d} fill="none" stroke="#fff" strokeWidth=${26} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity=${0.9} />
        <path d=${d} fill="none" stroke="#e3d3ad" strokeWidth=${6} strokeDasharray="2 18" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      ${units.map((u, k) => {
        const n = done(u.items);
        const pct = u.items.length ? n / u.items.length : 0;
        const complete = n >= u.items.length;
        const next = u.id === nextId;
        const c = ISLAND[k % ISLAND.length];
        const left = pts[k].x;
        return (html`<${Link} key=${u.id} href=${`/learn/unit/${u.id}`} onClick=${() => sfx("pop")} aria-label=${`Unit ${u.order}: ${u.title} — ${n} of ${u.items.length} done`} className="group absolute flex w-44 -translate-x-1/2 flex-col items-center gap-2 outline-none motion-safe:animate-pop-in" style=${{ left: `${left}%`, top: k * ROW, animationDelay: `${k * 90}ms` }}>
            <span className="lift relative block rounded-full p-[7px]" style=${{ background: `conic-gradient(#66bb6a ${pct * 360}deg, rgba(255,255,255,0.85) 0)` }}>
              <span className=${`relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-ink md:h-32 md:w-32 ${c.bg} ${next ? "motion-safe:animate-glow" : ""}`} style=${{ boxShadow: next ? undefined : `0 6px 0 0 ${c.ring}` }}>
                <${IslandPicture} src=${u.pics[0]} emoji=${u.emoji} />
              </span>
              <span className="absolute -left-1 -top-1 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ink bg-sun font-display text-xl font-extrabold">${u.order}</span>
              ${complete && html`<span className="absolute -right-2 -top-3 text-4xl motion-safe:animate-pop-in">👑</span>`}
            </span>
            <span className="max-w-full rounded-full border-[3px] border-ink bg-paper px-3 py-0.5 text-center font-display text-lg font-extrabold leading-tight group-focus-visible:ring-4 group-focus-visible:ring-sky-deep">
              ${u.title}
            </span>
            <${StarProgress} done=${n} total=${u.items.length} />
            ${next && (html`<span className=${`pointer-events-none absolute top-6 motion-safe:animate-bob ${left > 50 ? "-left-16" : "-right-16"}`} aria-hidden>
                <${CloverMascot} size=${64} className="" />
              </span>`)}
          <//>`);
    })}
    </div>`);
}
/* ---------------------------- Playground ---------------------------- */
const STEPS = [
    { label: "Learn", icon: "🌱", types: ["vocabulary", "listening", "speaking"], tone: "bg-grass-soft" },
    { label: "Practice", icon: "🧩", types: ["grammar", "reading"], tone: "bg-orange-soft" },
    { label: "Play", icon: "🎮", types: ["game"], tone: "bg-sky-soft" },
    { label: "Check", icon: "🏅", types: ["quiz", "test"], tone: "bg-grape-soft" },
];
export function Playground({ kind, id }) {
    const { data, error, reload } = useLearn();
    if (!data)
        return error ? html`<${ErrorBox} message=${error} onRetry=${reload} />` : html`<${Loading} />`;
    const group = kind === "unit" ? data.books.flatMap((b) => b.units).find((u) => u.id === id) : data.topics.find((t) => t.id === id);
    if (!group)
        return html`<${ErrorBox} message="This island isn't ready yet." />`;
    const back = `/learn/${kind}/${id}`;
    const best = (it) => data.stats.bestStarsByItem[it.id] ?? 0;
    const next = STEPS.flatMap((s) => group.items.filter((it) => s.types.includes(it.type))).find((it) => !best(it));
    const unit = kind === "unit" ? group : null;
    const pics = unit?.pics ?? [];
    const emojis = unit?.emojis ?? [group.emoji];
    // Cards pop in one after another, in the order they appear.
    const order = new Map(STEPS.flatMap((s) => group.items.filter((it) => s.types.includes(it.type))).map((it, k) => [it.id, k]));
    return (html`<main className="flex min-h-screen flex-col">
      <${KidTopBar} child=${data.child} stars=${data.stats.totalStars} back="/learn" title=${html`<span>${group.title}</span>`} />
      <div className="sky-bg relative flex-1">
        <div className="relative mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 motion-safe:animate-page-in">
          
          <div className="flex flex-wrap items-center gap-4 rounded-[32px] border-4 border-ink bg-paper/90 p-4 shadow-[0_6px_0_0_#e3d3ad]">
            <div className="flex -space-x-3">
              ${(pics.length ? pics : emojis).slice(0, 4).map((p, k) => (html`<span key=${k} className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-[3px] border-ink bg-white text-5xl shadow-md motion-safe:animate-pop-in md:h-24 md:w-24" style=${{ rotate: `${[-6, 4, -3, 6][k]}deg`, animationDelay: `${k * 90}ms` }}>
                  ${pics.length ? (
    // eslint-disable-next-line @next/next/no-img-element
    html`<${ApiImg} src=${p} alt="" className="h-full w-full object-contain p-1" />`) : (p)}
                </span>`))}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-extrabold leading-tight md:text-4xl">${group.title}</h1>
              <p className="font-display text-lg text-ink-soft">
                ⭐ ${group.items.filter((it) => best(it)).length} / ${group.items.length} done
              </p>
            </div>
            <${SpeakButton} text=${group.title} size=${60} label=${`Listen: ${group.title}`} />
          </div>

          ${STEPS.map((step, s) => {
        const items = group.items.filter((it) => step.types.includes(it.type));
        if (!items.length)
            return null;
        return (html`<section key=${step.label} className=${`rounded-[32px] border-[3px] border-ink/10 p-4 ${step.tone}`}>
                <h2 className="mb-3 flex items-center gap-2 font-display text-2xl font-extrabold">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ink bg-paper">${s + 1}</span>
                  ${step.icon} ${step.label}
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  ${items.map((it) => {
            const m = TYPE_META[it.type];
            const stars = best(it);
            const isNext = it.id === next?.id;
            const delay = (order.get(it.id) ?? 0) * 60;
            return (html`<${Link} key=${it.id} href=${`/learn/play/${it.id}?back=${encodeURIComponent(back)}`} onClick=${() => sfx("pop")} style=${{ ["--shadow"]: m.shadow, animationDelay: `${delay}ms` }} className=${`btn-3d lift relative flex min-h-44 flex-col items-center justify-center gap-2 rounded-[28px] border-4 border-ink p-3 text-center motion-safe:animate-pop-in ${m.bg} ${isNext ? "ring-4 ring-sun ring-offset-4 ring-offset-transparent" : ""}`}>
                        ${isNext && html`<span className="absolute -top-4 rounded-full border-[3px] border-ink bg-sun px-3 font-display text-sm font-extrabold motion-safe:animate-bob">Start here!</span>`}
                        ${stars > 0 && html`<span className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-ink bg-grass text-lg">✔</span>`}
                        <span className="flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-ink bg-paper text-5xl">
                          ${it.type === "game" && it.data?.game ? GAME_ICON[it.data.game] : m.icon}
                        </span>
                        <span className="font-display text-xl font-extrabold leading-tight">${it.type === "game" ? it.title : m.kidLabel}</span>
                        <span className="text-xl" aria-label=${`${stars} stars`}>
                          ${stars ? "⭐".repeat(stars) + "☆".repeat(3 - stars) : "☆☆☆"}
                        </span>
                      <//>`);
        })}
                </div>
              </section>`);
    })}
        </div>
      </div>
    </main>`);
}
/* ------------------------------ Play ------------------------------ */
export function PlayScreen({ itemId, back }) {
    const childId = useChildId();
    const router = useRouter();
    const { data, error } = useApi(`/api/items/${itemId}`);
    if (!data || data.item.id !== itemId || childId === undefined)
        return error ? html`<${ErrorBox} message=${error} />` : html`<${Loading} />`;
    return (html`<main className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 border-b-[3px] border-ink bg-sun px-4 py-3">
        <${Link} href=${back} aria-label="Back" className="btn-3d flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-ink bg-paper text-3xl [--shadow:#e09b00]">
          ✖
        <//>
      </div>
      <div className="bg-dots flex-1 px-4 py-6 motion-safe:animate-page-in">
        <div className="mx-auto max-w-5xl">
          <${ItemPlayer} item=${data.item} pictures=${data.pictures} childId=${childId} onExit=${() => router.push(back)} />
        </div>
      </div>
    </main>`);
}
/* ---------------------------- Stickers ---------------------------- */
/** The sticker album: one page per theme; a full page wins its trophy (= one level up). */
export function StickerBook() {
    const { data, error, loading } = useLearn();
    const [picked, setPicked] = useState(null);
    if (loading || !data)
        return error ? html`<${ErrorBox} message=${error} />` : html`<${Loading} />`;
    const album = albumState(data.stats.stickers.length);
    const shown = picked ?? album.current;
    const { page, have, done } = album.pages[shown];
    const nextIn = STARS_PER_STICKER - (data.stats.totalStars % STARS_PER_STICKER);
    const all = album.owned >= STICKERS.length;
    const open = (k) => {
        sfx("tap");
        setPicked(k);
        speak(album.pages[k].page.title);
    };
    return (html`<main className="flex min-h-screen flex-col">
      <${KidTopBar} child=${data.child} stars=${data.stats.totalStars} trophies=${album.level} back="/learn" title="My sticker book" />
      <div className="bg-dots flex-1 px-4 py-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5">
          <${Mascot} size=${80} say=${all ? "You collected them all! 🏆" : `${nextIn} more ⭐ for a new sticker!`} />

          
          <section aria-label="My trophies" className="w-full rounded-[28px] border-[3px] border-ink bg-paper/90 p-4">
            <h2 className="font-display text-2xl font-extrabold">
              🏆 My trophies ${album.level > 0 && html`<span className="text-grape-deep">· Level ${album.level}</span>`}
            </h2>
            ${album.level ? (html`<div className="mt-2 flex gap-4 overflow-x-auto pb-1">
                ${album.pages
        .map((p, k) => ({ p, k }))
        .filter(({ p }) => p.done)
        .map(({ p, k }) => (html`<button key=${p.page.id} onClick=${() => open(k)} className="shrink-0" aria-label=${`${p.page.title} trophy, level ${k + 1}`}>
                      <${Trophy} page=${p.page} level=${k + 1} size=${72} />
                    </button>`))}
              </div>`) : (html`<p className="mt-1 text-lg text-ink-soft">Fill a whole page with stickers to win a trophy!</p>`)}
          </section>

          
          <div role="tablist" aria-label="Sticker pages" className="flex w-full gap-2 overflow-x-auto pb-2">
            ${album.pages.map((p, k) => (html`<button key=${p.page.id} role="tab" aria-selected=${k === shown} aria-label=${p.page.title} onClick=${() => open(k)} className=${`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-[3px] border-ink text-3xl ${k === shown ? "bg-sun ring-4 ring-sun-deep" : p.have ? "bg-paper" : "bg-paper/60 opacity-60"}`}>
                ${p.page.icon}
                ${p.done && html`<span className="absolute -right-2 -top-2 text-lg">🏆</span>`}
              </button>`))}
          </div>

          
          <section key=${page.id} aria-label=${page.title} className=${`w-full rounded-[32px] border-4 border-ink p-5 motion-safe:animate-page-in ${page.tone}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <${BigButton} color="white" size="sm" disabled=${shown === 0} onClick=${() => open(shown - 1)} aria-label="Previous page">
                  ◀
                <//>
                <h2 className="font-display text-3xl font-extrabold">
                  ${page.icon} ${page.title}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border-2 border-ink bg-paper px-3 py-1 font-display text-xl font-bold">
                  ${have} / ${page.stickers.length}
                </span>
                <${BigButton} color="white" size="sm" disabled=${shown === album.pages.length - 1} onClick=${() => open(shown + 1)} aria-label="Next page">
                  ▶
                <//>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              ${page.stickers.map((s, k) => {
        const mine = k < have;
        return (html`<button key=${s.id} disabled=${!mine} onClick=${() => (sfx("pop"), speak(s.name))} aria-label=${mine ? s.name : "A sticker to win"} className=${`flex aspect-square flex-col items-center justify-center gap-1 rounded-3xl border-[3px] p-2 ${mine ? "lift border-ink bg-paper shadow-[0_5px_0_0_#e3d3ad]" : "border-dashed border-ink/30 bg-paper/50"}`}>
                    <span className=${`text-6xl leading-none md:text-7xl ${mine ? "motion-safe:animate-pop" : "opacity-15 brightness-0"}`}>
                      <${StickerArt} id=${s.id} />
                    </span>
                    <span className="font-display text-lg font-bold">${mine ? s.name : "?"}</span>
                  </button>`);
    })}
            </div>
            <div className="mt-5 flex flex-col items-center gap-2 text-center">
              ${done ? (html`<${Fragment}>
                  <${Trophy} page=${page} level=${shown + 1} size=${110} label=${false} className="motion-safe:animate-bob" />
                  <p className="font-display text-2xl font-extrabold">Page complete! Level ${shown + 1} 🎉</p>
                <//>`) : (html`<${Fragment}>
                  <span className="opacity-30 grayscale">
                    <${Trophy} page=${page} level=${shown + 1} size=${80} label=${false} />
                  </span>
                  <p className="font-display text-xl font-bold">
                    ${page.stickers.length - have} more ${page.stickers.length - have === 1 ? "sticker" : "stickers"} to win this trophy!
                  </p>
                <//>`)}
            </div>
          </section>

          <${BigButton} color="grass" onClick=${() => history.back()}>
            ◀ Back
          <//>
        </div>
      </div>
    </main>`);
}
