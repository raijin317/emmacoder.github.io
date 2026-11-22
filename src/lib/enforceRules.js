import { RULE, ruleOn } from "./rules.js";
import { bookTexts, isFromBook, wordsOutsideBook } from "./bookText.js";

/**
 * Applies the family's rules to lessons written by Claude (book packages, see Import_Book.md):
 * an item that uses words which are not in the book is dropped (rule "book-only"), and so is a reading
 * whose passage is not the book's own text (rule "book-reading"). The offline builder then makes those
 * types from the book itself. Pure — used by the app and by tools/book-package.mjs.
 */
export function enforceRules(items, o) {
    const texts = bookTexts(o.unit.extract);
    return items.filter((it) => {
        if (ruleOn(o.rules, RULE.bookOnly)) {
            const outside = wordsOutsideBook(it, o.allowedWords);
            if (outside.length) {
                o.log?.(`Unit ${o.unit.order}: “${it.title}” used words that are not in the book (${outside.slice(0, 4).join(", ")}) — left out.`);
                return false;
            }
        }
        if (it.type === "reading" && ruleOn(o.rules, RULE.bookReading) && !isFromBook(it.data.passage, texts)) {
            o.log?.(`Unit ${o.unit.order}: the reading text was not the book's own — left out.`);
            return false;
        }
        return true;
    });
}
