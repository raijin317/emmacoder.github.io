import { buildPictureMap, cropUrl, drawnUrl, picKey } from "@/lib/pictures.js";
import { RULE, ruleOn } from "@/lib/rules.js";
import { bookPictureKeys, getLessonRules, getUnit, listUnits } from "./repo.js";
import { hasPages } from "./books/pages.js";
/**
 * Pictures for a unit's words (lesson rule 2): first the pictures Claude drew for the book (book package),
 * then — for words without a drawing — the picture cut from the book page when the PDF's pages are in this
 * browser. Its own words plus the earlier units' words (used for review). Nothing when the parent switched
 * the rule off (then the emoji are used).
 */
export function picturesForUnit(unit) {
    if (!unit || !ruleOn(getLessonRules(), RULE.bookPictures))
        return {};
    const drawn = bookPictureKeys(unit.bookId);
    const crops = hasPages(unit.bookId);
    if (!drawn.size && !crops)
        return {};
    const all = listUnits(unit.bookId);
    // This unit first, so its pictures win when a word appears twice.
    const ordered = [unit, ...all.filter((u) => u.id !== unit.id && u.order < unit.order).reverse()];
    return buildPictureMap(unit.bookId, ordered.map((u) => u.extract), { drawn, crops });
}
/** Book items: the book's pictures. Inspiration topics use their emoji. */
export function picturesForItem(item) {
    if (item.source === "book")
        return item.unitId ? picturesForUnit(getUnit(item.unitId)) : {};
    return {};
}
/** Up to `n` picture URLs of a unit's words, for covers and banners (drawings first). */
export function unitCovers(unit, n = 4) {
    const drawn = bookPictureKeys(unit.bookId);
    const crops = hasPages(unit.bookId);
    return unit.extract.vocabulary
        .flatMap((v) => {
        const k = picKey(v.word);
        if (drawn.has(k))
            return [drawnUrl(unit.bookId, k, drawn.get(k))];
        return v.pic && crops ? [cropUrl(unit.bookId, v.pic, 320)] : [];
    })
        .slice(0, n);
}
/** The book's drawings as word → URL (for the parent's book and unit pages). */
export function drawnMap(bookId) {
    return Object.fromEntries([...bookPictureKeys(bookId)].map(([k, v]) => [k, drawnUrl(bookId, k, v)]));
}
