/**
 * Imports a book package (see src/lib/schemas/package.js and Import_Book.md) — the static site's
 * version of the desktop app's "Import Book": book + units (approved), level assessment, then per unit
 * Claude's lessons (checked against the lesson rules) + the offline builder's word-based lessons.
 *
 * Importing again (a newer package version) keeps what the parent changed: a unit whose words the parent
 * edited keeps them, and a unit whose lessons the parent edited keeps its lessons. `force` replaces all.
 */
import { z } from "zod";
import { assessBook, PROFILES } from "@/lib/assessment.js";
import { BookPackage, CLAUDE_TYPES, LOCAL_TYPES, packageUnitId } from "@/lib/schemas/package.js";
import { UnitExtract } from "@/lib/schemas/book.js";
import { createItem, deleteItem, getBook, getItem, getLessonRules, getSetting, getUnit, listItems, listUnits, setBookPictures, setSetting, upsertBook, upsertUnit } from "../repo.js";
import { normalizeSvg } from "@/lib/safeSvg.js";
import { earlierLanguage, enforceRules, offlineItemsForUnit } from "../content.js";
import { JobError } from "../api.js";
import { sha256Hex } from "../sha256.js";
import { tx } from "../db.js";

const ORDER = ["vocabulary", "listening", "speaking", "grammar", "reading", "game", "quiz", "worksheet", "lessonPlan", "test"];
const key = {
    version: (bookId) => `bookPackage:${bookId}`,
    removed: (bookId) => `bookPackage:${bookId}:removed`,
    unit: (unitId) => `bookPackage:unit:${unitId}`,
};
const hashOf = (extract) => sha256Hex(JSON.stringify(extract));
const j = (v, fallback) => {
    try {
        return v ? JSON.parse(v) : fallback;
    }
    catch {
        return fallback;
    }
};

export function parsePackage(raw) {
    const parsed = BookPackage.safeParse(raw);
    if (!parsed.success)
        throw new JobError("This is not a valid book package.", z.prettifyError(parsed.error));
    return parsed.data;
}

/** The version of a book's package that is already in this browser (0 = none). */
export const importedVersion = (bookId) => Number(getSetting(key.version(bookId)) ?? 0);
export const packageRemoved = (bookId) => getSetting(key.removed(bookId)) === "1";
/** The parent removed a book that came from a package: don't bring it back by itself. */
export function markPackageRemoved(bookId) {
    if (getSetting(key.version(bookId)))
        setSetting(key.removed(bookId), "1");
}

export function importBookPackage(raw, opts = {}) {
    const pkg = parsePackage(raw);
    const b = pkg.book;
    const log = opts.log ?? (() => { });
    const force = !!opts.force;
    const units = [...pkg.units].sort((a, c) => a.order - c.order);
    const report = { bookId: b.id, units: units.length, lessons: 0, keptUnits: [], keptLessons: [], dropped: [] };

    // 1. The book and its units (units are approved right away, like the desktop import).
    tx(() => {
        const cur = getBook(b.id);
        upsertBook({
            ...(cur ?? {}),
            id: b.id,
            fileName: b.fileName,
            title: b.title,
            series: b.series,
            bookType: b.bookType,
            grade: b.grade,
            pageCount: Math.max(cur?.pageCount ?? 0, b.pageCount),
            status: cur?.status ?? "needs-review",
            statusDetail: null,
            isDemo: false,
            meta: { title: b.title, series: b.series, bookType: b.bookType, grade: b.grade, units: units.map((u) => ({ order: u.order, title: u.title, startPage: u.pages[0], endPage: u.pages[1] })) },
            importedAt: new Date().toISOString(),
        });
        for (const u of units) {
            const id = packageUnitId(b.id, u.order);
            const { items: _items, ...core } = u;
            void _items;
            const extract = UnitExtract.parse({ ...core, id, bookId: b.id, order: u.order, pages: u.pages });
            const prev = getUnit(id);
            const edited = prev && getSetting(key.unit(id)) !== hashOf(prev.extract);
            if (prev && edited && !force) {
                report.keptUnits.push(u.order);
                log(`Unit ${u.order}: you changed this unit — your words and sentences are kept.`);
                continue;
            }
            upsertUnit(extract, "approved");
            setSetting(key.unit(id), hashOf(getUnit(id).extract));
        }
    });

    // 1b. The pictures Claude drew for the words (lesson rule 2) — shown instead of the emoji.
    const pictures = Object.fromEntries(Object.entries(pkg.pictures).map(([key, svg]) => {
        const clean = normalizeSvg(svg);
        return [key, { svg: clean, version: sha256Hex(clean).slice(0, 10) }];
    }));
    setBookPictures(b.id, pictures);
    report.pictures = Object.keys(pictures).length;
    if (report.pictures)
        log(`${report.pictures} pictures drawn for the words.`);

    // 2. Level & age from the book's content (decides how the lessons are pitched).
    const all = listUnits(b.id);
    const assessment = assessBook(b.grade, all.map((u) => u.extract));
    upsertBook({ ...getBook(b.id), assessment });
    const profile = assessment.generationProfile ?? PROFILES[assessment.stage];
    const rules = getLessonRules();

    // 3. Lessons, unit by unit in order (the games of earlier units decide the next unit's games).
    for (const u of units) {
        const unit = getUnit(packageUnitId(b.id, u.order));
        if (!unit)
            continue;
        const made = j(getSetting(`${key.unit(unit.id)}:items`), []);
        const existing = listItems({ unitId: unit.id });
        const ours = existing.filter((i) => made.includes(i.id));
        const touched = ours.some((i) => i.createdAt !== i.updatedAt) || made.some((id) => !getItem(id));
        if (existing.length && !force && (touched || !ours.length)) {
            // The parent edited, removed or made this unit's lessons: leave them as they are.
            report.keptLessons.push(u.order);
            log(`Unit ${u.order}: its lessons were changed by you — kept.`);
            continue;
        }
        if (unit.extract.vocabulary.filter((v) => v.word.trim()).length < 3) {
            log(`Unit ${u.order}: fewer than 3 words — no lessons made.`);
            continue;
        }
        const earlier = earlierLanguage(unit);
        const written = enforceRules(u.items.filter((i) => CLAUDE_TYPES.includes(i.type)), {
            unit,
            allowedWords: [...unit.extract.vocabulary.map((v) => v.word), ...earlier.words],
            rules,
            log: (msg) => {
                report.dropped.push(msg);
                log(msg);
            },
        });
        const writtenTypes = new Set(written.map((i) => i.type));
        const local = offlineItemsForUnit(unit, profile, unit.id).filter((i) => LOCAL_TYPES.includes(i.type) || !writtenTypes.has(i.type));
        const items = [...local.map((item) => ({ item, by: "parent" })), ...written.map((item) => ({ item, by: "claude" }))].sort((a, c) => ORDER.indexOf(a.item.type) - ORDER.indexOf(c.item.type));
        tx(() => {
            for (const it of (force ? existing : ours))
                deleteItem(it.id);
            const ids = items.map(({ item, by }) => createItem({ source: "book", bookId: b.id, unitId: unit.id, inspirationTopicId: null, type: item.type, title: item.title, status: "approved", stage: assessment.stage, data: item.data, createdBy: by }).id);
            setSetting(`${key.unit(unit.id)}:items`, JSON.stringify(ids));
        });
        report.lessons += items.length;
        log(`Unit ${u.order}: ${items.length} lessons (${written.length} written for the book, ${local.length} made by the app).`);
    }

    const ready = listUnits(b.id).some((u) => listItems({ unitId: u.id, status: "approved" }).length);
    upsertBook({ ...getBook(b.id), status: ready ? "ready" : "needs-review", statusDetail: null });
    setSetting(key.version(b.id), String(pkg.version));
    setSetting(key.removed(b.id), "0");
    return report;
}
