import { PROFILES } from "@/lib/assessment.js";
import { createItem, deleteItem, getBook, listItems, listUnits, setBookStatus, updateUnit } from "../repo.js";
import { offlineItemsForUnit } from "../content.js";
import { tx } from "../db.js";
/**
 * The learning resources of a unit ("bộ tài nguyên học"), made offline from the unit's own words,
 * sentences, patterns and reading texts (the static site has no AI): words, listening, speaking,
 * grammar (from the sentence patterns), reading (the book's text), two mini games, quiz, worksheet,
 * home lesson plan and a unit check. They are live (approved) right away; the parent can edit or hide them.
 */
const ORDER = ["vocabulary", "listening", "speaking", "grammar", "reading", "game", "quiz", "worksheet", "lessonPlan", "test"];
export async function generateUnitResources(unit, book, opts = {}) {
    const stage = book.assessment?.stage ?? "early-reader";
    const profile = book.assessment?.generationProfile ?? PROFILES[stage];
    const items = offlineItemsForUnit(unit, profile, unit.id);
    items.sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
    tx(() => {
        for (const item of items) {
            createItem({ source: "book", bookId: unit.bookId, unitId: unit.id, inspirationTopicId: null, type: item.type, title: item.title, status: "approved", stage, data: item.data, createdBy: "parent" });
        }
    });
    opts.log?.(`Unit ${unit.order}: ${items.length} lessons made.`);
    return { created: items.length, mode: "local" };
}
/** Makes the resources for every unit of a book (skips units that already have them unless `force`). */
export async function generateBookResources(bookId, opts = {}) {
    const book = getBook(bookId);
    if (!book)
        throw new Error("Book not found");
    const units = listUnits(bookId);
    const log = opts.log ?? (() => { });
    let made = 0;
    for (const [i, unit] of units.entries()) {
        const pct = Math.round(((i + 1) / units.length) * 100);
        const existing = listItems({ unitId: unit.id });
        if (existing.length && !opts.force) {
            log(`Unit ${unit.order}: resources already there (${existing.length} items).`, pct);
            continue;
        }
        if (unit.extract.vocabulary.filter((v) => v.word.trim()).length < 3) {
            log(`Unit ${unit.order}: fewer than 3 words — skipped (add words in the unit page, then make its lessons).`, pct);
            continue;
        }
        setBookStatus(bookId, "generating", `Making resources: unit ${i + 1}/${units.length}`);
        log(`Making resources for unit ${unit.order}: ${unit.title}…`, Math.max(0, pct - 1));
        if (opts.force)
            for (const it of existing)
                deleteItem(it.id);
        if (unit.status !== "approved")
            updateUnit(unit.id, { status: "approved" });
        await generateUnitResources(unit, getBook(bookId));
        made++;
        log(`Unit ${unit.order}: lessons ready.`, pct);
        // Let the page breathe between units (everything runs in this browser tab).
        await new Promise((r) => setTimeout(r, 0));
    }
    setBookStatus(bookId, units.some((u) => listItems({ unitId: u.id, status: "approved" }).length) ? "ready" : "needs-review");
    return { units: units.length, made };
}
