import { html, Fragment } from "@/lib/html.js";
import Link from "next/link";
import { useApi } from "@/lib/client/api.js";
import { Badge, EmptyState, LinkButton, PageHeader, Panel, ProgressBar } from "@/components/ui.js";
import { Loading } from "@/components/kids/index.js";
import { childFit } from "@/lib/assessment.js";
import { AssessmentBadges, BookCover, FitBadge, LocalDataBadge, STATUS_BADGE } from "./common.js";
export function ParentHome() {
    const kids = useApi("/api/children");
    const books = useApi("/api/books");
    if (!kids.data || !books.data)
        return html`<${Loading} />`;
    const bookById = new Map(books.data.books.map((b) => [b.id, b]));
    const toReview = books.data.books.filter((b) => b.status !== "ready" || (b.unitCount ?? 0) > (b.readyUnits ?? 0));
    return (html`<div className="mx-auto flex max-w-6xl flex-col gap-6">
      <${PageHeader} emoji="🏠" title="Welcome back!" subtitle=${html`<${LocalDataBadge} />`} actions=${html`<${Fragment}>
            <${LinkButton} href="/parent/books" variant="sun">
              📚 Add books
            <//>
            <${LinkButton} href="/parent/inspiration" variant="grape">
              ✨ New topic
            <//>
          <//>`} />

      ${!kids.data.children.length && (html`<${EmptyState} emoji="👧" title="Add your child first">
          <${LinkButton} href="/parent/children" variant="primary">
            Add a child
          <//>
        <//>`)}

      <div className="grid gap-4 md:grid-cols-2">
        ${kids.data.children.map((c) => {
        const childBooks = c.bookIds.map((id) => bookById.get(id)).filter((b) => !!b);
        const book = childBooks.find((b) => b.id === c.activeBookId) ?? childBooks[0];
        const fit = book?.assessment ? childFit(c.age, book.assessment) : null;
        return (html`<${Panel} key=${c.id}>
              <div className="flex items-start gap-4">
                <span className="text-6xl">${c.avatar}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-extrabold">
                    ${c.name} <span className="text-base font-bold text-ink-soft">· ${c.age} years old</span>
                  </h2>
                  ${childBooks.length ? (html`<ul className="mt-1 flex flex-col gap-1">
                      ${childBooks.map((b) => (html`<li key=${b.id} className="flex flex-wrap items-center gap-2">
                          📘 <b>${b.title}</b> <${FitBadge} fit=${b.assessment ? childFit(c.age, b.assessment) : null} />
                          <span className="text-sm text-ink-soft">
                            🎒 ${b.readyUnits}/${b.unitCount} units
                          </span>
                        </li>`))}
                    </ul>`) : (html`<p className="mt-1 text-ink-soft">No book chosen yet</p>`)}
                  ${fit && childBooks.length === 1 && html`<p className="text-sm text-ink-soft">${fit.reason}</p>`}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <${Stat} label="Stars" value=${`⭐ ${c.stats.totalStars}`} />
                <${Stat} label="This week" value=${`${c.stats.minutesWeek} min`} />
                <${Stat} label="Stickers · trophies" value=${`${c.stats.stickers.length} · 🏆 ${c.stats.level}`} />
              </div>
              <div className="mt-4">
                <p className="mb-1 text-sm font-bold">
                  Today: ${c.stats.minutesToday}/${c.dailyGoalMinutes} min
                </p>
                <${ProgressBar} value=${(c.stats.minutesToday / c.dailyGoalMinutes) * 100} />
              </div>
              ${c.stats.weakWords.length > 0 && (html`<p className="mt-3 text-sm">
                  <b>Practice more:</b> ${c.stats.weakWords.slice(0, 6).map((w) => w.word).join(", ")}
                </p>`)}
              <div className="mt-4 flex gap-2">
                <${LinkButton} href="/parent/children">Details<//>
                ${book && html`<${LinkButton} href=${`/parent/books/${book.id}`}>Open book<//>`}
              </div>
            <//>`);
    })}
      </div>

      <${Panel} title="📚 Books" actions=${html`<${LinkButton} href="/parent/books">All books<//>`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          ${books.data.books.map((b) => (html`<${Link} key=${b.id} href=${`/parent/books/${b.id}`} className="flex gap-3 rounded-2xl border-2 border-line p-3 hover:border-sun">
              <${BookCover} book=${b} className="h-20 w-16 shrink-0" />
              <div className="min-w-0">
                <p className="truncate font-bold">${b.title}</p>
                <${AssessmentBadges} a=${b.assessment} />
                <p className="mt-1 text-sm text-ink-soft">
                  🎒 ${b.readyUnits}/${b.unitCount} units · <${Badge} tone=${STATUS_BADGE[b.status][1]}>${STATUS_BADGE[b.status][0]}<//>
                </p>
              </div>
            <//>`))}
        </div>
        ${toReview.length > 0 && html`<p className="mt-3 text-sm font-bold text-orange-deep">👉 ${toReview.length} book(s) still need lessons — open the book and press “Make lessons”.</p>`}
      <//>
    </div>`);
}
function Stat({ label, value }) {
    return (html`<div className="rounded-2xl bg-cream p-2">
      <p className="font-display text-xl font-extrabold">${value}</p>
      <p className="text-xs font-bold text-ink-soft">${label}</p>
    </div>`);
}
