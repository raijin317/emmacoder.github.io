import { buildQuickPack } from "@/lib/quickPack.js";
import { PROFILES, assessBook } from "@/lib/assessment.js";
import { RULE, ruleOn } from "@/lib/rules.js";
import { bookTexts, isFromBook, wordsOutsideBook } from "@/lib/bookText.js";
import { gameHistory } from "@/lib/games.js";
import { createItem, getBook, getLessonRules, listItems, listUnits, upsertBook } from "./repo.js";
import { grammarItem } from "@/lib/offlineGrammar.js";
/** Recomputes the level/age assessment after the parent edits units or the grade. */
export function reassessBook(bookId) {
    const book = getBook(bookId);
    if (!book)
        return null;
    const units = listUnits(bookId);
    if (!units.length)
        return book;
    const assessment = assessBook(book.grade, units.map((u) => u.extract));
    upsertBook({ ...book, assessment });
    return getBook(bookId);
}
/** The mini games of the units before this one (oldest first), so the next unit gets different ones. */
export function earlierGames(unit) {
    const before = listUnits(unit.bookId)
        .filter((u) => u.order < unit.order)
        .sort((a, b) => a.order - b.order);
    return gameHistory(before.map((u) => listItems({ unitId: u.id, type: "game" }).map((i) => i.data.game)));
}
/** Words and patterns of the units before this one (for spiral review). */
export function earlierLanguage(unit) {
    const before = listUnits(unit.bookId).filter((u) => u.order < unit.order);
    return {
        words: [...new Set(before.flatMap((u) => u.extract.vocabulary.map((v) => v.word)))].slice(-60),
        patterns: [...new Set(before.flatMap((u) => u.extract.patterns.map((p) => p.text)))].slice(-15),
        wordCards: before.flatMap((u) => u.extract.vocabulary.filter((v) => v.emoji).map((v) => ({ word: v.word, emoji: v.emoji }))).slice(-20),
    };
}
/**
 * Applies the family's rules to Claude's items: an item that uses words which are not in the book is dropped
 * (rule "book-only"), and so is a reading whose passage is not the book's own text (rule "book-reading").
 * The offline builder then makes those types from the book itself.
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
function saveDrafts(unit, stage, items, by) {
    return items.map((it) => createItem({ source: "book", bookId: unit.bookId, unitId: unit.id, inspirationTopicId: null, type: it.type, title: it.title, status: "draft", stage: stage, data: it.data, createdBy: by }));
}
/**
 * Offline practice for a unit (no AI): every lesson type the offline builder can make, or only `types` when given.
 * Grammar comes from the unit's sentence patterns (src/lib/offlineGrammar.js).
 */
export function offlineItemsForUnit(unit, profile, seed) {
    const sentences = unit.extract.sentences ?? [];
    const items = buildQuickPack(unit.extract, profile, { seed, reviewWords: earlierLanguage(unit).wordCards, rules: getLessonRules(), games: earlierGames(unit) });
    const grammar = grammarItem(unit.extract, profile, { seed, sentences });
    if (grammar) items.splice(Math.max(0, items.findIndex((i) => i.type === "reading" || i.type === "quiz")), 0, grammar);
    return items;
}
export function quickPackForUnit(unit, types) {
    const book = getBook(unit.bookId);
    const stage = book?.assessment?.stage ?? "early-reader";
    const profile = book?.assessment?.generationProfile ?? PROFILES[stage];
    const items = offlineItemsForUnit(unit, profile, unit.id + Date.now()).filter((i) => !types?.length || types.includes(i.type));
    return saveDrafts(unit, stage, items, "parent");
}
