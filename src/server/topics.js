import { PROFILES } from "@/lib/assessment.js";
import { buildQuickPack } from "@/lib/quickPack.js";
import { gameHistory } from "@/lib/games.js";
import { grammarItem } from "@/lib/offlineGrammar.js";
import { DEFAULT_RULES } from "@/lib/rules.js";
import { listItems, listTopics } from "./repo.js";

/**
 * Inspiration topics made without AI: the parent types a word list (with emoji) and, if they like,
 * a few sentences and a sentence pattern; the offline builder makes the lessons (words, listening,
 * speaking, grammar, reading, two games that fit the topic, quiz, worksheet, lesson plan, check).
 */

/** The game kinds of the existing topics, oldest first (so a new topic gets different games). */
export function topicGames() {
  return listTopics()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((t) => listItems({ topicId: t.id, type: "game" }).map((i) => i.data.game));
}

export function buildTopicItems(t) {
  const profile = PROFILES[t.stage] ?? PROFILES["early-reader"];
  const unit = {
    title: t.title,
    topic: `${t.title} ${t.description ?? ""}`,
    vocabulary: t.words.map((w) => ({ word: w.word, emoji: w.emoji || "⭐", vi: w.vi || undefined })),
    patterns: t.pattern ? [{ text: t.pattern, function: "" }] : [],
    sentences: t.sentences ?? [],
    readings: t.reading ? [{ title: t.title, text: t.reading }] : [],
  };
  const seed = `${t.title}|${Date.now()}`;
  // Free topics are not tied to a book, so only the reading rule (use the parent's own text) applies.
  const rules = DEFAULT_RULES;
  const items = buildQuickPack(unit, profile, { seed, rules, games: gameHistory(topicGames()) });
  const grammar = grammarItem(unit, profile, { seed, sentences: unit.sentences });
  if (grammar) items.splice(Math.max(0, items.findIndex((i) => i.type === "reading" || i.type === "quiz")), 0, grammar);
  return items;
}
