import { buildPictureMap, cropUrl } from "@/lib/pictures.js";
import { RULE, ruleOn } from "@/lib/rules.js";
import { getLessonRules, getUnit, listUnits } from "./repo.js";
import { hasPages } from "./books/pages.js";
/**
 * Pictures from the book for a unit: its own words plus the earlier units' words (used for review),
 * or nothing when the parent switched the "book pictures" rule off, or when the book's PDF pages
 * are not stored in this browser (then the emoji are used).
 */
export function picturesForUnit(unit) {
    if (!unit || !ruleOn(getLessonRules(), RULE.bookPictures) || !hasPages(unit.bookId))
        return {};
    const all = listUnits(unit.bookId);
    // This unit first, so its pictures win when a word appears twice.
    const ordered = [unit, ...all.filter((u) => u.id !== unit.id && u.order < unit.order).reverse()];
    return buildPictureMap(unit.bookId, ordered.map((u) => u.extract));
}
/** Book items: the book's pictures. Inspiration topics use their emoji. */
export function picturesForItem(item) {
    if (item.source === "book")
        return item.unitId ? picturesForUnit(getUnit(item.unitId)) : {};
    return {};
}
/** Up to `n` picture URLs of a unit's words, for covers and banners. */
export function unitCovers(unit, n = 4) {
    if (!hasPages(unit.bookId))
        return [];
    return unit.extract.vocabulary.flatMap((v) => (v.pic ? [cropUrl(unit.bookId, v.pic, 320)] : [])).slice(0, n);
}
