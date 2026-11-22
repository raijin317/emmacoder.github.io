import { html, Fragment } from "@/lib/html.js";
import { ApiImg } from "@/components/ApiImg.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, streamSSE, useApi } from "@/lib/client/api.js";
import { Badge, Button, EmptyState, LinkButton, PageHeader, Panel, ProgressBar, inputCls } from "@/components/ui.js";
import { ErrorBox, Loading } from "@/components/kids/index.js";
import { STAGE_INFO } from "@/lib/assessment.js";
import { AssessmentBadges, BookCover, LocalDataBadge, STATUS_BADGE, useJob } from "./common.js";
import { PrepareVoices } from "./settings.js";
import { RulesNote } from "./rules.js";
import { cropUrl } from "@/lib/pictures.js";
/* ------------------------------ Import panel ------------------------------ */
export function JobLog({ job }) {
    if (!job.running && !job.log.length)
        return null;
    return (html`<div className="mt-4">
      <${ProgressBar} value=${job.progress} tone="bg-sky" />
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-ink p-3 text-sm text-cream">${job.log.join("\n")}</pre>
    </div>`);
}
/**
 * Prepares a textbook PDF in this browser (its pages are drawn and kept on this device — nothing is uploaded).
 * `bookId`: add the PDF to a book that is already there. Returns the book's id.
 */
export async function uploadPdf(file, bookId, onEvent, signal) {
    const fd = new FormData();
    fd.append("file", file);
    if (bookId)
        fd.append("bookId", bookId);
    let id = bookId ?? null;
    let problem = null;
    await streamSSE("/api/books/upload", fd, (ev, d) => {
        if (ev === "book")
            id = d?.bookId ?? id;
        if (ev === "error")
            problem = d?.message ?? "The PDF could not be read.";
        onEvent?.(ev, d);
    }, signal);
    if (problem)
        throw new Error(problem);
    return id;
}
function ImportPanel({ onDone }) {
    const router = useRouter();
    const [busy, setBusy] = useState(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);
    const [title, setTitle] = useState("");
    const [grade, setGrade] = useState("");
    const fileInput = useRef(null);
    const pkgInput = useRef(null);
    const [pkgMsg, setPkgMsg] = useState(null);
    /** A book package made by Claude (Import_Book.md): units + lessons in one file. */
    const importPackage = async (file) => {
        setError(null);
        setPkgMsg(null);
        setBusy(file.name);
        try {
            let json;
            try {
                json = JSON.parse(await file.text());
            }
            catch {
                throw new Error("This file is not a book package (it is not JSON).");
            }
            const r = await api("/api/books/package", { body: { package: json } });
            const kept = [...new Set([...r.keptUnits, ...r.keptLessons])];
            setPkgMsg(`✅ ${r.units} units and ${r.lessons} lessons added.${kept.length ? ` Your own changes in unit ${kept.join(", ")} were kept.` : ""}`);
            onDone();
            router.push(`/parent/books/${r.bookId}`);
        }
        catch (e) {
            setError(`${e.message}${e.details ? `\n${e.details}` : ""}`);
        }
        setBusy(null);
    };
    const upload = async (file) => {
        setError(null);
        setBusy(file.name);
        setProgress(0);
        setStatus(null);
        try {
            const id = await uploadPdf(file, null, (_ev, d) => {
                if (d?.progress !== undefined)
                    setProgress(d.progress);
                if (d?.msg)
                    setStatus(d.msg);
            });
            onDone();
            if (id)
                router.push(`/parent/books/${id}`);
        }
        catch (e) {
            setError(e.message);
            onDone();
        }
        setBusy(null);
    };
    const create = async () => {
        setError(null);
        try {
            const r = await api("/api/books", { body: { title, grade: grade === "" ? null : Number(grade) } });
            setTitle("");
            onDone();
            router.push(`/parent/books/${r.book.id}`);
        }
        catch (e) {
            setError(e.message);
        }
    };
    return (html`<${Panel} title="📥 Add books" actions=${html`<${LocalDataBadge} compact />`}>
      <p className="text-ink-soft">
        Choose your child's textbook (PDF). Its pages are prepared <b>in this browser</b> and stay on this device — nothing is uploaded. Then add the book's units (title and pages) and type in what each unit teaches: words, sentence patterns, sentences and reading texts — and pick each word's picture on the book page. Press <b>✨ Make lessons</b> and the app makes a full set of lessons for every unit (words, listening, speaking, grammar, reading, games, quiz, worksheet, lesson plan, test).
      </p>
      <div className="mt-2">
        <${RulesNote} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <${Button} variant="primary" className="min-h-14 px-6 text-lg" disabled=${!!busy} onClick=${() => fileInput.current?.click()}>
          ${busy ? `Preparing ${busy}…` : "📤 Add a PDF book"}
        <//>
        <input ref=${fileInput} type="file" accept="application/pdf,.pdf" className="hidden" data-testid="book-file" onChange=${(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f)
            void upload(f);
    }} />
        <${Button} disabled=${!!busy} onClick=${() => pkgInput.current?.click()} title="A book prepared by Claude with Import_Book.md (a .json file): its units and lessons are added at once">
          📦 Import a book package
        <//>
        <input ref=${pkgInput} type="file" accept="application/json,.json" className="hidden" data-testid="book-package" onChange=${(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f)
            void importPackage(f);
    }} />
        <span className="text-sm text-ink-soft">A big book can take a minute or two — keep this tab open.</span>
      </div>
      ${pkgMsg && html`<p className="mt-2 font-bold text-grass-deep">${pkgMsg}</p>`}
      ${busy && html`<div className="mt-3">
          <${ProgressBar} value=${progress} tone="bg-sky" />
          ${status && html`<p className="mt-1 text-sm font-bold">${status}</p>`}
        </div>`}
      <form className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl bg-cream p-3" onSubmit=${(e) => {
        e.preventDefault();
        void create();
    }}>
        <label className="flex min-w-56 flex-1 flex-col gap-1">
          <span className="text-sm font-bold">…or a book without a PDF</span>
          <input className=${inputCls} placeholder="Title (e.g. Tiếng Anh 2 — Student book)" value=${title} onChange=${(e) => setTitle(e.target.value)} maxLength=${120} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold">Grade</span>
          <select className=${inputCls} value=${grade} onChange=${(e) => setGrade(e.target.value)}>
            <option value="">Unknown</option>
            <option value="0">Preschool / Kindergarten</option>
            ${[1, 2, 3, 4, 5].map((g) => html`<option key=${g} value=${g}>Grade ${g}</option>`)}
          </select>
        </label>
        <${Button} type="submit" disabled=${!title.trim()}>➕ New book<//>
      </form>
      ${error && html`<p className="mt-2 whitespace-pre-wrap font-bold text-berry-deep">❌ ${error}</p>`}
    <//>`);
}
/* -------------------------------- List -------------------------------- */
export function BooksPage() {
    const { data, error, reload } = useApi("/api/books");
    return (html`<div className="mx-auto flex max-w-6xl flex-col gap-6">
      <${PageHeader} emoji="📚" title="Books" subtitle="Your child's textbooks — the source of all practice." />
      <${ImportPanel} onDone=${reload} />
      ${error && html`<${ErrorBox} message=${error} onRetry=${reload} />`}
      ${!data ? (html`<${Loading} />`) : !data.books.length ? (html`<${EmptyState} emoji="📚" title="No books yet" />`) : (html`<div className="grid gap-4 md:grid-cols-2">
          ${data.books.map((b) => (html`<${Link} key=${b.id} href=${`/parent/books/${b.id}`} className="flex gap-4 rounded-3xl border-2 border-line bg-paper p-4 shadow-[0_4px_0_0_#efe2c6] hover:border-sun">
              <${BookCover} book=${b} className="h-32 w-24 shrink-0" />
              <div className="flex min-w-0 flex-col gap-2">
                <h2 className="text-xl font-extrabold">${b.title}</h2>
                <p className="text-sm text-ink-soft">
                  ${[b.series, b.grade === 0 ? "Preschool" : b.grade ? `Grade ${b.grade}` : null, b.pageCount ? `${b.pageCount} pages` : null].filter(Boolean).join(" · ")}
                  ${b.isDemo && " · demo content"}
                </p>
                <${AssessmentBadges} a=${b.assessment} />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <${Badge} tone=${STATUS_BADGE[b.status][1]}>${STATUS_BADGE[b.status][0]}<//>
                  <span>
                    🎒 ${b.readyUnits}/${b.unitCount} units with lessons
                  </span>
                </div>
                ${b.status === "error" && b.statusDetail && html`<p className="text-sm text-berry-deep">${b.statusDetail}</p>`}
                ${["rendering", "reading", "extracting", "generating"].includes(b.status) && b.statusDetail && html`<p className="text-sm text-sky-deep">${b.statusDetail}</p>`}
              </div>
            <//>`))}
        </div>`)}
    </div>`);
}
/* ------------------------------- Detail ------------------------------- */
export function BookDetail({ bookId }) {
    const { data, error, reload } = useApi(`/api/books/${bookId}`);
    const router = useRouter();
    const [page, setPage] = useState(null);
    const [showPages, setShowPages] = useState(false);
    const [pdf, setPdf] = useState(null);
    const [pdfError, setPdfError] = useState(null);
    const [newUnit, setNewUnit] = useState(null);
    const pdfInput = useRef(null);
    const job = useJob(reload);
    if (error)
        return html`<${ErrorBox} message=${error} onRetry=${reload} />`;
    if (!data)
        return html`<${Loading} />`;
    const { book, units } = data;
    const a = book.assessment;
    const withLessons = units.filter((u) => (u.approvedItemCount ?? 0) > 0).length;
    const makeResources = (force) => job.run("/api/books/import", { target: bookId, mode: "resources", force });
    const setGrade = async (v) => {
        await api(`/api/books/${bookId}`, { method: "PATCH", body: { grade: v === "" ? null : Number(v) } });
        reload();
    };
    const setTitle = async (v) => {
        if (!v.trim() || v.trim() === book.title)
            return;
        await api(`/api/books/${bookId}`, { method: "PATCH", body: { title: v.trim() } });
        reload();
    };
    const attachPdf = async (file) => {
        setPdfError(null);
        setPdf({ progress: 0, msg: `Preparing ${file.name}…` });
        try {
            await uploadPdf(file, bookId, (_ev, d) => setPdf((p) => ({ progress: d?.progress ?? p?.progress ?? 0, msg: d?.msg ?? p?.msg })));
        }
        catch (e) {
            setPdfError(e.message);
        }
        setPdf(null);
        reload();
    };
    const lastPage = units.length ? Math.max(...units.map((u) => u.pages[1])) : 0;
    const addUnit = async () => {
        try {
            const r = await api(`/api/books/${bookId}/units`, { body: newUnit });
            setNewUnit(null);
            router.push(`/parent/units/${r.unit.id}`);
        }
        catch (e) {
            setNewUnit((u) => ({ ...u, error: e.message }));
        }
    };
    return (html`<div className="mx-auto flex max-w-6xl flex-col gap-6">
      <p className="text-sm font-bold text-ink-soft">
        <${Link} href="/parent/books" className="underline">
          Books
        <//>${" "}
        › ${book.title}
      </p>
      <${PageHeader} title=${book.title} subtitle=${html`<${AssessmentBadges} a=${a} />`} actions=${html`<${Fragment}>
            ${!book.isDemo && (html`<${Button} variant="danger" onClick=${async () => {
        if (!confirm("Remove this book, its units and all its practice items from the app? (Its pages saved in this browser are deleted too.)"))
            return;
        await api(`/api/books/${bookId}`, { method: "DELETE" });
        router.push("/parent/books");
    }}>
                Remove
              <//>`)}
          <//>`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <${Panel} title="🎯 Level & age (from the book's content)">
          ${a ? (html`<${Fragment}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-5xl">${STAGE_INFO[a.stage].emoji}</span>
                <div>
                  <p className="text-2xl font-extrabold">
                    Suits ages ${a.estimatedAge.min}–${a.estimatedAge.max}
                  </p>
                  <p className="text-ink-soft">
                    ${STAGE_INFO[a.stage].label} · CEFR ${a.cefr}
                  </p>
                </div>
              </div>
              <ul className="list-disc pl-6">
                ${a.rationale.map((r) => (html`<li key=${r}>${r}</li>`))}
              </ul>
              <p className="mt-3 text-sm text-ink-soft">
                Practice is written with max ${a.generationProfile.maxSentenceWords} words per sentence, ${a.generationProfile.questionsPerQuiz} questions per quiz, ${a.generationProfile.sessionMinutes}-minute sessions${a.generationProfile.allowWriting ? ", with writing" : ", no writing"}.
              </p>
            <//>`) : (html`<p>Not assessed yet — add the book's units and their words first.</p>`)}
        <//>
        <${Panel} title="⚙️ Book details">
          ${!book.isDemo && html`<label className="mb-3 flex flex-col gap-1">
              <span className="font-bold">Title</span>
              <input key=${book.title} className=${inputCls} defaultValue=${book.title} maxLength=${120} onBlur=${(e) => void setTitle(e.target.value)} />
            </label>`}
          <label className="flex flex-col gap-1">
            <span className="font-bold">Grade</span>
            <select className=${inputCls} value=${book.grade ?? ""} onChange=${(e) => setGrade(e.target.value)}>
              <option value="">Unknown</option>
              <option value="0">Preschool / Kindergarten</option>
              ${[1, 2, 3, 4, 5].map((g) => (html`<option key=${g} value=${g}>
                  Grade ${g}
                </option>`))}
            </select>
            <span className="text-sm text-ink-soft">Changing it updates the level assessment.</span>
          </label>
          <p className="mt-3 text-sm text-ink-soft">File: ${book.fileName}</p>
          ${book.pageCount > 0 && !book.isDemo && book.hasPages && (html`<${Button} className="mt-3" onClick=${() => setShowPages((s) => !s)}>
              📄 ${showPages ? "Hide pages" : `View pages (${book.pageCount})`}
            <//>`)}
          ${!book.isDemo && !book.hasPages && html`<div className="mt-3 flex flex-col gap-2">
              <${Button} disabled=${!!pdf} onClick=${() => pdfInput.current?.click()}>📎 ${book.pageCount ? "Add this book's PDF again" : "Add the book's PDF"}<//>
              <span className="text-sm text-ink-soft">${book.pageCount ? "The pages are not in this browser yet — add the same PDF to see them and the book's pictures." : "Optional: the pages let you pick each word's picture from the book."}</span>
              <input ref=${pdfInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange=${(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f)
            void attachPdf(f);
    }} />
              ${pdf && html`<${ProgressBar} value=${pdf.progress} tone="bg-sky" />`}
              ${pdf?.msg && html`<span className="text-sm font-bold">${pdf.msg}</span>`}
              ${pdfError && html`<span className="text-sm font-bold text-berry-deep">❌ ${pdfError}</span>`}
            </div>`}
        <//>
      </div>

      ${showPages && (html`<${Panel} title="📄 Pages (for your reference)">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
            ${Array.from({ length: book.pageCount }, (_, k) => (html`<button key=${k} onClick=${() => setPage(k + 1)} className="rounded-lg border-2 border-line hover:border-sun">
                
                <${ApiImg} src=${`/api/books/${bookId}/pages/${k + 1}?thumb=1`} alt=${`Page ${k + 1}`} loading="lazy" className="w-full rounded-md" />
                <span className="text-xs">${k + 1}</span>
              </button>`))}
          </div>
        <//>`)}
      ${page && html`<${PageModal} bookId=${bookId} page=${page} max=${book.pageCount} onClose=${() => setPage(null)} onGo=${setPage} />`}

      <${Panel} title="🎒 Learning resources">
        <p className="text-lg">
          <b>
            ${withLessons}/${units.length}
          </b>${" "}
          units have a full set of lessons (words, listening, speaking, grammar, reading, games, quiz, worksheet, lesson plan, test).
        </p>
        <${RulesNote} />
        ${book.status === "generating" && book.statusDetail && html`<p className="text-sky-deep">⏳ ${book.statusDetail}</p>`}
        <div className="mt-3 flex flex-wrap gap-2">
          ${withLessons < units.length && (html`<${Button} variant="grape" disabled=${job.running} onClick=${() => makeResources(false)}>
              ✨ Make lessons for ${withLessons ? "the missing units" : "all units"}
            <//>`)}
          ${withLessons > 0 && (html`<${Button} disabled=${job.running} onClick=${() => confirm("Remake ALL lessons of this book? Current lessons (and your edits) will be replaced.") && makeResources(true)}>
              ♻️ Remake all lessons
            <//>`)}
          ${job.running && html`<${Button} onClick=${job.cancel}>Stop watching<//>`}
        </div>
        <${JobLog} job=${job} />
        <${PrepareVoices} target=${bookId} label="🎙️ Prepare the voice for this book" />
      <//>

      <${Panel} title=${`📗 Units (${units.length})`} actions=${!book.isDemo && html`<${Button} variant="sun" onClick=${() => setNewUnit({ title: "", startPage: lastPage + 1 || 1, endPage: lastPage + 1 || 1 })}>➕ Add unit<//>`}>
        ${newUnit && html`<form className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border-2 border-sun bg-sun-soft p-3" onSubmit=${(e) => {
        e.preventDefault();
        void addUnit();
    }}>
            <label className="flex min-w-56 flex-1 flex-col gap-1">
              <span className="text-sm font-bold">Unit ${units.length ? Math.max(...units.map((u) => u.order)) + 1 : 1} — title (as printed in the book)</span>
              <input autoFocus className=${inputCls} placeholder="e.g. In the school playground" value=${newUnit.title} onChange=${(e) => setNewUnit({ ...newUnit, title: e.target.value })} maxLength=${120} />
            </label>
            <label className="flex w-28 flex-col gap-1">
              <span className="text-sm font-bold">From page</span>
              <input className=${inputCls} type="number" min=${1} max=${book.pageCount || undefined} value=${newUnit.startPage} onChange=${(e) => setNewUnit({ ...newUnit, startPage: Number(e.target.value), endPage: Math.max(Number(e.target.value), newUnit.endPage) })} />
            </label>
            <label className="flex w-28 flex-col gap-1">
              <span className="text-sm font-bold">To page</span>
              <input className=${inputCls} type="number" min=${newUnit.startPage} max=${book.pageCount || undefined} value=${newUnit.endPage} onChange=${(e) => setNewUnit({ ...newUnit, endPage: Number(e.target.value) })} />
            </label>
            <${Button} type="submit" variant="primary" disabled=${!newUnit.title.trim()}>Add<//>
            <${Button} type="button" onClick=${() => setNewUnit(null)}>Cancel<//>
            ${newUnit.error && html`<p className="w-full font-bold text-berry-deep">❌ ${newUnit.error}</p>`}
          </form>`}
        ${!units.length && html`<p className="text-ink-soft">No units yet.${!book.isDemo ? " Press ➕ Add unit for each unit of the book." : ""}</p>`}
        <div className="flex flex-col gap-2">
          ${units.map((u) => (html`<${Link} key=${u.id} href=${`/parent/units/${u.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-line p-3 hover:border-sun">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sun font-display text-xl font-bold">${u.order}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 font-bold">
                  ${u.extract.vocabulary.slice(0, 3).map((v, k) => v.pic && book.hasPages ? (
    // eslint-disable-next-line @next/next/no-img-element
    html`<${ApiImg} key=${k} src=${cropUrl(book.id, v.pic, 160)} alt=${v.word} className="h-8 w-8 rounded-md border border-line bg-white object-contain" />`) : (html`<span key=${k}>${v.emoji}</span>`))}${" "}
                  ${u.title}
                </p>
                <p className="text-sm text-ink-soft">
                  ${u.extract.vocabulary.length} words · ${u.extract.patterns.length} patterns${book.pageCount ? ` · pages ${u.pages[0]}–${u.pages[1]}` : ""}
                  ${u.extract.confidence < 0.6 && " · ⚠️ please check"}
                </p>
              </div>
              ${(u.approvedItemCount ?? 0) > 0 ? html`<${Badge} tone="grass">🎒 ${u.approvedItemCount} lessons<//>` : html`<${Badge} tone="orange">No lessons yet<//>`}
              ${(u.itemCount ?? 0) > (u.approvedItemCount ?? 0) && html`<${Badge} tone="gray">${(u.itemCount ?? 0) - (u.approvedItemCount ?? 0)} hidden/draft<//>`}
            <//>`))}
        </div>
      <//>
    </div>`);
}
export function PageModal({ bookId, page, max, onClose, onGo }) {
    return (html`<div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-ink/80 p-4" onClick=${onClose} role="dialog" aria-label=${`Page ${page}`}>
      
      <${ApiImg} src=${`/api/books/${bookId}/pages/${page}`} alt=${`Page ${page}`} className="max-h-[85vh] max-w-full rounded-xl bg-white" onClick=${(e) => e.stopPropagation()} />
      <div className="flex gap-2" onClick=${(e) => e.stopPropagation()}>
        <${Button} disabled=${page <= 1} onClick=${() => onGo(page - 1)}>
          ◀
        <//>
        <span className="rounded-xl bg-paper px-4 py-2 font-bold">
          ${page} / ${max}
        </span>
        <${Button} disabled=${page >= max} onClick=${() => onGo(page + 1)}>
          ▶
        <//>
        <${Button} onClick=${onClose}>Close<//>
      </div>
    </div>`);
}
export function LinkToBooks() {
    return html`<${LinkButton} href="/parent/books">📚 Books<//>`;
}
