import { buildPictureMap, drawnUrl, ownUrl, pictureUrl } from "@/lib/pictures.js";
import { RULE, ruleOn } from "@/lib/rules.js";
import { bookPictureKeys, getLessonRules, getUnit, listUnits, ownPictureKeys } from "./repo.js";
import { hasPages } from "./books/pages.js";
/**
 * Pictures for a unit's words (lesson rule 2): for each word the picture chosen in the unit's word list —
 * the parent's own picture, the picture Claude drew (book package), the picture cut from the book page (when
 * the PDF's pages are in this browser) or the emoji; not chosen = the parent's picture, then the drawing, then
 * the book picture, then the emoji. Its own words plus the earlier units' words (used for review). Nothing when
 * the parent switched the rule off (then the emoji are used).
 */
export function picturesForUnit(unit) {
    if (!unit || !ruleOn(getLessonRules(), RULE.bookPictures))
        return {};
    const o = pictureSources(unit.bookId);
    if (!o.own.size && !o.drawn.size && !o.crops)
        return {};
    const all = listUnits(unit.bookId);
    // This unit first, so its pictures win when a word appears twice.
    const ordered = [unit, ...all.filter((u) => u.id !== unit.id && u.order < unit.order).reverse()];
    return buildPictureMap(unit.bookId, ordered.map((u) => u.extract), o);
}
/** What pictures a book has in this browser (options for buildPictureMap / pictureUrl). */
export function pictureSources(bookId) {
    return { own: ownPictureKeys(bookId), drawn: bookPictureKeys(bookId), crops: hasPages(bookId) };
}
/** Book items: the book's pictures. Inspiration topics use their emoji. */
export function picturesForItem(item) {
    if (item.source === "book")
        return item.unitId ? picturesForUnit(getUnit(item.unitId)) : {};
    return {};
}
/** Up to `n` picture URLs of a unit's words, for covers and banners (the picture chosen for each word). */
export function unitCovers(unit, n = 4) {
    const o = pictureSources(unit.bookId);
    return unit.extract.vocabulary
        .flatMap((v) => {
        const url = pictureUrl(unit.bookId, v, o, 320);
        return url ? [url] : [];
    })
        .slice(0, n);
}
/** The book's drawings as word → URL (for the parent's book and unit pages). */
export function drawnMap(bookId) {
    return Object.fromEntries([...bookPictureKeys(bookId)].map(([k, v]) => [k, drawnUrl(bookId, k, v)]));
}
/** The parent's own pictures as word → URL (for the parent's book and unit pages). */
export function ownMap(bookId) {
    return Object.fromEntries([...ownPictureKeys(bookId)].map(([k, v]) => [k, ownUrl(bookId, k, v)]));
}
