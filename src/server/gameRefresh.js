import { PROFILES } from "@/lib/assessment.js";
import { gameHistory, gameItems } from "@/lib/games.js";
/**
 * One-time update (games v2): units made before there were 11 mini games all had the same three games
 * (Memory match, Balloon pop, Spelling bee). Those automatic, never-edited game items are replaced by the
 * TWO games picked for each unit's topic (different from the units just before). Games the parent made or
 * edited are kept. AI Studio topics with fewer than two games get one more that fits the topic.
 * Stars already earned stay (attempts are kept); the new games are simply new to play.
 */
const FLAG = "games_v2";
const OLD_TITLES = new Set(["Memory match", "Balloon pop", "Spelling bee"]);
const j = (v, fallback) => {
    try {
        return typeof v === "string" && v ? JSON.parse(v) : fallback;
    }
    catch {
        return fallback;
    }
};
const hasTable = (d, t) => !!d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
const newId = () => "it_" + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2) + Date.now().toString(16)).replace(/-/g, "").slice(0, 12);
export function refreshGames(d) {
    if (!["settings", "books", "units", "content_items", "inspiration_topics"].every((t) => hasTable(d, t)))
        return;
    if (d.prepare("SELECT 1 FROM settings WHERE key = ?").get(FLAG))
        return;
    const at = new Date().toISOString();
    const insert = d.prepare(`INSERT INTO content_items(id, source, book_id, unit_id, inspiration_topic_id, type, title, status, stage, data, created_by, created_at, updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    let changed = 0;
    d.exec("BEGIN");
    try {
        for (const book of d.prepare("SELECT id, assessment FROM books").all()) {
            const assessment = j(book.assessment, null);
            const stage = assessment?.stage ?? "early-reader";
            const profile = assessment?.generationProfile ?? PROFILES[stage];
            const done = [];
            for (const unit of d.prepare("SELECT id, title, topic, extract FROM units WHERE book_id = ? ORDER BY ord").all(String(book.id))) {
                const games = d.prepare("SELECT id, title, data, status, stage, created_by, created_at, updated_at FROM content_items WHERE unit_id = ? AND type = 'game'").all(String(unit.id));
                const kinds = games.map((g) => j(g.data, {}).game).filter((k) => !!k);
                const automatic = games.every((g) => g.created_by === "parent" && g.created_at === g.updated_at && OLD_TITLES.has(String(g.title)));
                const extract = j(unit.extract, {});
                const words = (extract.vocabulary ?? [])
                    .filter((v) => v.word?.trim())
                    .slice(0, 10)
                    .map((v) => ({ word: v.word.trim(), emoji: v.emoji?.trim() || "⭐" }));
                if (!games.length || !automatic || words.length < 3) {
                    done.push(kinds);
                    continue;
                }
                const items = gameItems({ text: `${unit.title} ${unit.topic ?? ""}`, words, profile, seed: String(unit.id), ...gameHistory(done), young: !profile.allowWriting });
                if (items.length < 2) {
                    done.push(kinds);
                    continue;
                }
                for (const g of games)
                    d.prepare("DELETE FROM content_items WHERE id = ?").run(String(g.id));
                const first = games[0];
                for (const it of items)
                    insert.run(newId(), "book", String(book.id), String(unit.id), null, "game", it.title, String(first.status), String(first.stage), JSON.stringify(it.data), "parent", at, at);
                done.push(items.map((i) => i.data.game));
                changed++;
            }
        }
        // AI Studio topics: two games each (one more when Claude made only one).
        const topicGames = [];
        for (const topic of d.prepare("SELECT id, title, description, stage, status FROM inspiration_topics ORDER BY created_at").all()) {
            const items = d.prepare("SELECT type, data, status FROM content_items WHERE inspiration_topic_id = ?").all(String(topic.id));
            const kinds = items.filter((i) => i.type === "game").map((i) => j(i.data, {}).game).filter((k) => !!k);
            const words = topicWordList(items.map((i) => j(i.data, null)));
            if (kinds.length < 2 && words.length >= 3) {
                const stage = String(topic.stage) in PROFILES ? String(topic.stage) : "early-reader";
                const profile = PROFILES[stage];
                const extra = gameItems({ text: `${topic.title} ${topic.description ?? ""}`, words, profile, seed: String(topic.id), ...gameHistory(topicGames), exclude: kinds, count: 2 - kinds.length, young: !profile.allowWriting });
                for (const it of extra)
                    insert.run(newId(), "inspiration", null, null, String(topic.id), "game", it.title, topic.status === "approved" ? "approved" : String(items[0]?.status ?? "draft"), stage, JSON.stringify(it.data), "parent", at, at);
                kinds.push(...extra.map((i) => i.data.game));
                if (extra.length)
                    changed++;
            }
            topicGames.push(kinds);
        }
        d.prepare("INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)").run(FLAG, JSON.stringify({ at, changed }));
        d.exec("COMMIT");
    }
    catch (e) {
        d.exec("ROLLBACK");
        console.error("[games v2] could not update the games:", e.message);
    }
}
/** Words with an emoji anywhere in a topic's items (vocabulary words, picture options, pairs…), first seen first. */
export function topicWordList(datas, max = 10) {
    const out = new Map();
    const walk = (v) => {
        if (Array.isArray(v))
            return v.forEach(walk);
        if (!v || typeof v !== "object")
            return;
        const o = v;
        const word = typeof o.word === "string" ? o.word : typeof o.label === "string" ? o.label : null;
        if (word?.trim() && typeof o.emoji === "string" && word.trim().split(/\s+/).length <= 3) {
            const key = word.trim().toLowerCase();
            if (!out.has(key))
                out.set(key, { word: word.trim(), emoji: o.emoji });
        }
        Object.values(o).forEach(walk);
    };
    datas.forEach(walk);
    return [...out.values()].slice(0, max);
}
/** Tops a saved AI Studio pack up to two games (kinds not in it yet, fitting the topic, different from recent topics). */
export function topUpGames(items, o) {
    const kinds = items.filter((i) => i.type === "game").map((i) => i.data.game);
    if (kinds.length >= 2)
        return [];
    const words = topicWordList(items.map((i) => i.data));
    if (words.length < 3)
        return [];
    const profile = PROFILES[o.stage];
    return gameItems({ text: `${o.title} ${o.description}`, words, profile, seed: o.seed, ...gameHistory(o.recent), exclude: kinds, count: 2 - kinds.length, young: !profile.allowWriting });
}
