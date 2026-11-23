import { sha256Hex } from "./sha256.js";
import { db, newId, now, syncStickers, tx } from "./db.js";
import { TOPIC_PICTURE_MODES } from "@/lib/types.js";
import { STARS_PER_STICKER, STICKERS, albumState } from "@/lib/stickers.js";
import { DEFAULT_VOICE, isNaturalVoice } from "@/lib/voices.js";
import { mergeRules } from "@/lib/rules.js";
const j = (v, fallback) => {
    if (typeof v !== "string" || !v)
        return fallback;
    try {
        return JSON.parse(v);
    }
    catch {
        return fallback;
    }
};
const s = (v) => (v === null || v === undefined ? null : String(v));
/* ------------------------------- settings ------------------------------- */
export function getSetting(key) {
    const r = db().prepare("SELECT value FROM settings WHERE key = ?").get(key);
    return r ? String(r.value) : null;
}
export function setSetting(key, value) {
    db().prepare("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
export function getAppSettings() {
    const voice = getSetting("ttsVoice") ?? DEFAULT_VOICE;
    return {
        // The natural voice is downloaded into the browser only when the parent turns it on (Settings).
        ttsEngine: getSetting("ttsEngine") === "natural" ? "natural" : "browser",
        ttsVoice: isNaturalVoice(voice) ? voice : DEFAULT_VOICE,
        voiceName: getSetting("voiceName") ?? "",
        childRate: Number(getSetting("childRate") ?? 0.85),
        soundOn: (getSetting("soundOn") ?? "1") === "1",
        breakMinutes: Number(getSetting("breakMinutes") ?? 20),
        hasPin: !!getSetting("pinHash"),
        topicPictures: TOPIC_PICTURE_MODES.includes(getSetting("topicPictures") ?? "") ? getSetting("topicPictures") : "draw",
    };
}
/** The family's lesson rules (built-ins always present). */
export function getLessonRules() {
    return mergeRules(j(getSetting("lessonRules"), []));
}
export function setLessonRules(rules) {
    setSetting("lessonRules", JSON.stringify(mergeRules(rules)));
    return getLessonRules();
}
// Same hash as the desktop app, so a restored backup keeps its PIN.
const hashPin = (pin) => sha256Hex("sunny-english:" + pin);
export function setPin(pin) {
    setSetting("pinHash", hashPin(pin));
}
export function checkPin(pin) {
    const h = getSetting("pinHash");
    return !h || h === hashPin(pin);
}
/* --------------------------------- books -------------------------------- */
function toBook(r) {
    return {
        id: String(r.id),
        fileName: String(r.file_name),
        fileHash: s(r.file_hash),
        title: String(r.title),
        series: s(r.series),
        bookType: s(r.book_type),
        grade: r.grade === null || r.grade === undefined ? null : Number(r.grade),
        pageCount: Number(r.page_count ?? 0),
        status: String(r.status),
        statusDetail: s(r.status_detail),
        meta: j(r.meta, null),
        assessment: j(r.assessment, null),
        isDemo: Number(r.is_demo) === 1,
        importedAt: s(r.imported_at),
        unitCount: r.unit_count === undefined ? undefined : Number(r.unit_count),
        approvedUnits: r.approved_units === undefined ? undefined : Number(r.approved_units),
        readyUnits: r.ready_units === undefined ? undefined : Number(r.ready_units),
    };
}
export function listBooks() {
    const rows = db()
        .prepare(`SELECT b.*, (SELECT COUNT(*) FROM units u WHERE u.book_id = b.id) AS unit_count,
              (SELECT COUNT(*) FROM units u WHERE u.book_id = b.id AND u.status = 'approved') AS approved_units,
              (SELECT COUNT(DISTINCT i.unit_id) FROM content_items i WHERE i.book_id = b.id AND i.status = 'approved') AS ready_units
       FROM books b ORDER BY b.is_demo ASC, COALESCE(b.grade, 99), b.title`)
        .all();
    return rows.map(toBook);
}
export function getBook(id) {
    const r = db().prepare("SELECT * FROM books WHERE id = ?").get(id);
    return r ? toBook(r) : null;
}
export function upsertBook(b) {
    const cur = getBook(b.id);
    const m = { ...cur, ...b };
    db()
        .prepare(`INSERT INTO books(id, file_name, file_hash, title, series, book_type, grade, page_count, status, status_detail, meta, assessment, is_demo, imported_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET file_name=excluded.file_name, file_hash=excluded.file_hash, title=excluded.title, series=excluded.series,
         book_type=excluded.book_type, grade=excluded.grade, page_count=excluded.page_count, status=excluded.status, status_detail=excluded.status_detail,
         meta=excluded.meta, assessment=excluded.assessment, is_demo=excluded.is_demo, imported_at=excluded.imported_at`)
        .run(m.id, m.fileName, m.fileHash ?? null, m.title, m.series ?? null, m.bookType ?? null, m.grade ?? null, m.pageCount ?? 0, m.status ?? "new", m.statusDetail ?? null, m.meta ? JSON.stringify(m.meta) : null, m.assessment ? JSON.stringify(m.assessment) : null, m.isDemo ? 1 : 0, m.importedAt ?? null);
}
export function setBookStatus(id, status, detail = null) {
    db().prepare("UPDATE books SET status = ?, status_detail = ? WHERE id = ?").run(status, detail, id);
}
export function deleteBook(id) {
    tx(() => {
        for (const c of listChildren().filter((x) => x.bookIds.includes(id)))
            saveChild({ ...c, bookIds: c.bookIds.filter((b) => b !== id) });
        db().prepare("DELETE FROM content_items WHERE book_id = ?").run(id);
        db().prepare("DELETE FROM units WHERE book_id = ?").run(id);
        db().prepare("DELETE FROM book_pictures WHERE book_id = ?").run(id);
        db().prepare("DELETE FROM own_pictures WHERE book_id = ?").run(id);
        db().prepare("DELETE FROM books WHERE id = ?").run(id);
    });
}
/* ------------------------- drawn pictures (lesson rule 2) ------------------------ */
/** The words of a book that have a drawing: picKey(word) → version (changes when the drawing changes). */
export function bookPictureKeys(bookId) {
    return new Map(db().prepare("SELECT word_key, version FROM book_pictures WHERE book_id = ?").all(bookId).map((r) => [String(r.word_key), String(r.version)]));
}
export function getBookPicture(bookId, key) {
    const r = db().prepare("SELECT svg FROM book_pictures WHERE book_id = ? AND word_key = ?").get(bookId, key);
    return r ? String(r.svg) : null;
}
/** Replaces all drawings of a book. */
export function setBookPictures(bookId, pictures) {
    db().prepare("DELETE FROM book_pictures WHERE book_id = ?").run(bookId);
    for (const [key, p] of Object.entries(pictures))
        db().prepare("INSERT INTO book_pictures(book_id, word_key, svg, version) VALUES(?,?,?,?)").run(bookId, key, p.svg, p.version);
}
/* -------------------- the parent's own pictures for words -------------------- */
/** The words of a book that have a picture the parent added: picKey(word) → version. */
export function ownPictureKeys(bookId) {
    return new Map(db().prepare("SELECT word_key, version FROM own_pictures WHERE book_id = ?").all(bookId).map((r) => [String(r.word_key), String(r.version)]));
}
export function getOwnPicture(bookId, key) {
    const r = db().prepare("SELECT mime, data FROM own_pictures WHERE book_id = ? AND word_key = ?").get(bookId, key);
    return r ? { mime: String(r.mime), data: String(r.data) } : null;
}
/** Adds or replaces the parent's picture of a word (data = base64). */
export function setOwnPicture(bookId, key, mime, data) {
    db().prepare(`INSERT INTO own_pictures(book_id, word_key, mime, data, version) VALUES(?,?,?,?,?)
       ON CONFLICT(book_id, word_key) DO UPDATE SET mime=excluded.mime, data=excluded.data, version=excluded.version`).run(bookId, key, mime, data, Date.now().toString(36));
}
export function deleteOwnPicture(bookId, key) {
    db().prepare("DELETE FROM own_pictures WHERE book_id = ? AND word_key = ?").run(bookId, key);
}
/* --------------------------------- units -------------------------------- */
/** Units saved before sentences/readings existed get empty lists. */
const withListDefaults = (e) => ({ ...e, sentences: e.sentences ?? [], readings: e.readings ?? [] });
function toUnit(r) {
    return {
        id: String(r.id),
        bookId: String(r.book_id),
        order: Number(r.ord),
        title: String(r.title),
        topic: s(r.topic),
        pages: [Number(r.page_start ?? 0), Number(r.page_end ?? 0)],
        extract: withListDefaults(j(r.extract, {})),
        status: String(r.status),
        itemCount: r.item_count === undefined ? undefined : Number(r.item_count),
        approvedItemCount: r.approved_count === undefined ? undefined : Number(r.approved_count),
    };
}
export function listUnits(bookId) {
    return db()
        .prepare(`SELECT u.*, (SELECT COUNT(*) FROM content_items i WHERE i.unit_id = u.id) AS item_count,
                (SELECT COUNT(*) FROM content_items i WHERE i.unit_id = u.id AND i.status = 'approved') AS approved_count
         FROM units u WHERE u.book_id = ? ORDER BY u.ord`)
        .all(bookId).map(toUnit);
}
export function getUnit(id) {
    const r = db().prepare("SELECT * FROM units WHERE id = ?").get(id);
    return r ? toUnit(r) : null;
}
export function upsertUnit(u, status = "needs-review") {
    db()
        .prepare(`INSERT INTO units(id, book_id, ord, title, topic, page_start, page_end, extract, status) VALUES(?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET ord=excluded.ord, title=excluded.title, topic=excluded.topic, page_start=excluded.page_start,
         page_end=excluded.page_end, extract=excluded.extract`)
        .run(u.id, u.bookId, u.order, u.title, u.topic, u.pages[0], u.pages[1], JSON.stringify(u), status);
}
export function updateUnit(id, patch) {
    if (patch.extract) {
        const e = patch.extract;
        db().prepare("UPDATE units SET extract = ?, title = ?, topic = ? WHERE id = ?").run(JSON.stringify(e), e.title, e.topic, id);
    }
    if (patch.status)
        db().prepare("UPDATE units SET status = ? WHERE id = ?").run(patch.status, id);
}
/** Removes a unit and its lessons (the parent made it by hand, or it is not wanted). */
export function deleteUnit(id) {
    tx(() => {
        db().prepare("DELETE FROM content_items WHERE unit_id = ?").run(id);
        db().prepare("DELETE FROM units WHERE id = ?").run(id);
    });
}
/* --------------------------------- items -------------------------------- */
function toItem(r) {
    return {
        id: String(r.id),
        source: String(r.source),
        bookId: s(r.book_id),
        unitId: s(r.unit_id),
        inspirationTopicId: s(r.inspiration_topic_id),
        type: String(r.type),
        title: String(r.title),
        status: String(r.status),
        stage: String(r.stage),
        data: j(r.data, {}),
        createdBy: String(r.created_by),
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
    };
}
export function listItems(f) {
    const where = [];
    const args = [];
    const filters = [
        ["unit_id", f.unitId],
        ["inspiration_topic_id", f.topicId],
        ["book_id", f.bookId],
        ["status", f.status],
        ["type", f.type],
    ];
    for (const [col, val] of filters) {
        if (!val)
            continue;
        where.push(`${col} = ?`);
        args.push(val);
    }
    const sql = `SELECT * FROM content_items ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at, rowid`;
    return db().prepare(sql).all(...args).map(toItem);
}
export function getItem(id) {
    const r = db().prepare("SELECT * FROM content_items WHERE id = ?").get(id);
    return r ? toItem(r) : null;
}
export function createItem(i) {
    const id = i.id ?? newId("it_");
    const t = now();
    db()
        .prepare(`INSERT INTO content_items(id, source, book_id, unit_id, inspiration_topic_id, type, title, status, stage, data, created_by, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, i.source, i.bookId, i.unitId, i.inspirationTopicId, i.type, i.title, i.status, i.stage, JSON.stringify(i.data), i.createdBy, t, t);
    return getItem(id);
}
export function updateItem(id, patch) {
    const cur = getItem(id);
    if (!cur)
        return null;
    db()
        .prepare("UPDATE content_items SET title = ?, data = ?, status = ?, updated_at = ? WHERE id = ?")
        .run(patch.title ?? cur.title, JSON.stringify(patch.data ?? cur.data), patch.status ?? cur.status, now(), id);
    return getItem(id);
}
export function deleteItem(id) {
    db().prepare("DELETE FROM content_items WHERE id = ?").run(id);
}
/* ---------------------------- inspiration topics ------------------------- */
function toTopic(r) {
    return {
        id: String(r.id),
        title: String(r.title),
        emoji: String(r.emoji),
        description: s(r.description),
        stage: String(r.stage),
        status: String(r.status),
        createdAt: String(r.created_at),
        itemCount: r.item_count === undefined ? undefined : Number(r.item_count),
    };
}
export function listTopics(status) {
    const rows = db()
        .prepare(`SELECT t.*, (SELECT COUNT(*) FROM content_items i WHERE i.inspiration_topic_id = t.id) AS item_count
       FROM inspiration_topics t ${status ? "WHERE t.status = ?" : ""} ORDER BY t.created_at DESC`)
        .all(...(status ? [status] : []));
    return rows.map(toTopic);
}
export function getTopic(id) {
    const r = db().prepare("SELECT * FROM inspiration_topics WHERE id = ?").get(id);
    return r ? toTopic(r) : null;
}
export function createTopic(t) {
    const id = newId("tp_");
    db().prepare("INSERT INTO inspiration_topics(id, title, emoji, description, stage, status, created_at) VALUES(?,?,?,?,?,?,?)").run(id, t.title, t.emoji, t.description, t.stage, "draft", now());
    return getTopic(id);
}
export function updateTopic(id, patch) {
    const cur = getTopic(id);
    if (!cur)
        return null;
    db().prepare("UPDATE inspiration_topics SET status = ?, title = ? WHERE id = ?").run(patch.status ?? cur.status, patch.title ?? cur.title, id);
    if (patch.status)
        db().prepare("UPDATE content_items SET status = ? WHERE inspiration_topic_id = ?").run(patch.status, id);
    return getTopic(id);
}
export function deleteTopic(id) {
    tx(() => {
        db().prepare("DELETE FROM content_items WHERE inspiration_topic_id = ?").run(id);
        db().prepare("DELETE FROM inspiration_topics WHERE id = ?").run(id);
        for (const c of listChildren().filter((x) => x.topicIds.includes(id)))
            saveChild({ ...c, topicIds: c.topicIds.filter((t) => t !== id) });
    });
}
/** The pictures found or drawn for a topic's words (key = picKey(word)). */
export function getTopicPictures(id) {
    const r = db().prepare("SELECT pictures FROM inspiration_topics WHERE id = ?").get(id);
    return j(r?.pictures, {});
}
export function setTopicPictures(id, pictures) {
    db().prepare("UPDATE inspiration_topics SET pictures = ? WHERE id = ?").run(JSON.stringify(pictures), id);
}
/* -------------------------------- children ------------------------------- */
function toChild(r) {
    const bookIds = j(r.book_ids, []).filter((x) => typeof x === "string");
    const active = s(r.active_book_id);
    return {
        id: String(r.id),
        name: String(r.name),
        avatar: String(r.avatar),
        age: Number(r.age),
        bookIds,
        activeBookId: active && bookIds.includes(active) ? active : (bookIds[0] ?? null),
        topicIds: j(r.topic_ids, []).filter((x) => typeof x === "string"),
        dailyGoalMinutes: Number(r.daily_goal_minutes),
        createdAt: String(r.created_at),
    };
}
export function listChildren() {
    return db().prepare("SELECT * FROM children ORDER BY created_at").all().map(toChild);
}
export function getChild(id) {
    const r = db().prepare("SELECT * FROM children WHERE id = ?").get(id);
    return r ? toChild(r) : null;
}
export function saveChild(c) {
    const id = c.id ?? newId("ch_");
    const bookIds = [...new Set(c.bookIds ?? (c.activeBookId ? [c.activeBookId] : []))];
    const active = c.activeBookId && bookIds.includes(c.activeBookId) ? c.activeBookId : (bookIds[0] ?? null);
    // Topics are only changed when given (an older caller that doesn't know them keeps the child's topics).
    const topicIds = c.topicIds ? [...new Set(c.topicIds)] : (getChild(id)?.topicIds ?? []);
    db()
        .prepare(`INSERT INTO children(id, name, avatar, age, active_book_id, book_ids, topic_ids, daily_goal_minutes, created_at) VALUES(?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, avatar=excluded.avatar, age=excluded.age, active_book_id=excluded.active_book_id,
         book_ids=excluded.book_ids, topic_ids=excluded.topic_ids, daily_goal_minutes=excluded.daily_goal_minutes`)
        .run(id, c.name, c.avatar, c.age, active, JSON.stringify(bookIds), JSON.stringify(topicIds), c.dailyGoalMinutes ?? 15, c.createdAt ?? now());
    return getChild(id);
}
/** The children a topic is given to. */
export function topicChildren(topicId) {
    return listChildren()
        .filter((c) => c.topicIds.includes(topicId))
        .map((c) => ({ id: c.id, name: c.name, avatar: c.avatar }));
}
export function setActiveBook(childId, bookId) {
    const c = getChild(childId);
    if (c && c.bookIds.includes(bookId))
        db().prepare("UPDATE children SET active_book_id = ? WHERE id = ?").run(bookId, childId);
}
export function deleteChild(id) {
    tx(() => {
        db().prepare("DELETE FROM attempts WHERE child_id = ?").run(id);
        db().prepare("DELETE FROM stickers WHERE child_id = ?").run(id);
        db().prepare("DELETE FROM children WHERE id = ?").run(id);
    });
}
/* ------------------------------ attempts/stats ---------------------------- */
export { STARS_PER_STICKER };
const ownedStickers = (childId) => db().prepare("SELECT code FROM stickers WHERE child_id = ? ORDER BY earned_at, rowid").all(childId).map((r) => String(r.code));
/** Saves an attempt; returns its stars, the stickers it earned and the trophies of sticker pages it completed. */
export function recordAttempt(a) {
    const ratio = a.maxScore > 0 ? a.score / a.maxScore : 1;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    return tx(() => {
        db()
            .prepare("INSERT INTO attempts(id, child_id, content_item_id, score, max_score, stars, duration_sec, missed, created_at) VALUES(?,?,?,?,?,?,?,?,?)")
            .run(newId("at_"), a.childId, a.itemId, a.score, a.maxScore, stars, Math.max(0, Math.round(a.durationSec)), JSON.stringify(a.missed.slice(0, 30)), now());
        const total = Number(db().prepare("SELECT COALESCE(SUM(stars),0) AS s FROM attempts WHERE child_id = ?").get(a.childId).s);
        const owned = ownedStickers(a.childId);
        const before = albumState(owned.length).trophies;
        const shouldOwn = Math.min(STICKERS.length, Math.floor(total / STARS_PER_STICKER));
        const newStickers = [];
        for (let k = owned.length; k < shouldOwn; k++) {
            const code = STICKERS[k];
            db().prepare("INSERT INTO stickers(id, child_id, code, earned_at) VALUES(?,?,?,?)").run(newId("st_"), a.childId, code, now());
            newStickers.push(code);
        }
        const after = albumState(Math.max(owned.length, shouldOwn));
        return { stars, newStickers, newTrophies: after.trophies.filter((t) => !before.includes(t)), level: after.level };
    });
}
export function childStats(childId) {
    const rows = db().prepare("SELECT * FROM attempts WHERE child_id = ? ORDER BY created_at").all(childId);
    const today = new Date();
    const dayKey = (d) => d.toISOString().slice(0, 10);
    const week = [];
    for (let k = 6; k >= 0; k--) {
        const d = new Date(today);
        d.setDate(d.getDate() - k);
        week.push({ date: dayKey(d), minutes: 0, stars: 0 });
    }
    const best = {};
    const misses = {};
    let totalStars = 0;
    for (const r of rows) {
        const stars = Number(r.stars);
        totalStars += stars;
        const id = String(r.content_item_id);
        best[id] = Math.max(best[id] ?? 0, stars);
        const day = week.find((w) => w.date === String(r.created_at).slice(0, 10));
        if (day) {
            day.minutes += Number(r.duration_sec) / 60;
            day.stars += stars;
        }
        for (const m of j(r.missed, []))
            misses[m.toLowerCase()] = (misses[m.toLowerCase()] ?? 0) + 1;
    }
    week.forEach((w) => (w.minutes = Math.round(w.minutes)));
    const stickers = ownedStickers(childId);
    const album = albumState(stickers.length);
    return {
        totalStars,
        attempts: rows.length,
        minutesToday: week[6].minutes,
        minutesWeek: week.reduce((a, w) => a + w.minutes, 0),
        stickers,
        trophies: album.trophies,
        level: album.level,
        completedItemIds: Object.keys(best),
        bestStarsByItem: best,
        weakWords: Object.entries(misses)
            .map(([word, n]) => ({ word, misses: n }))
            .sort((a, b) => b.misses - a.misses)
            .slice(0, 12),
        week,
    };
}
/* ---------------------------------- chat --------------------------------- */
function toThread(r) {
    return { id: String(r.id), title: String(r.title), claudeSessionId: s(r.claude_session_id), createdAt: String(r.created_at), updatedAt: String(r.updated_at) };
}
export function listThreads() {
    return db().prepare("SELECT * FROM chat_threads ORDER BY updated_at DESC").all().map(toThread);
}
export function getThread(id) {
    const r = db().prepare("SELECT * FROM chat_threads WHERE id = ?").get(id);
    return r ? toThread(r) : null;
}
export function createThread(title) {
    const id = newId("th_");
    const t = now();
    db().prepare("INSERT INTO chat_threads(id, title, claude_session_id, created_at, updated_at) VALUES(?,?,?,?,?)").run(id, title, null, t, t);
    return getThread(id);
}
export function updateThread(id, patch) {
    const cur = getThread(id);
    if (!cur)
        return;
    db()
        .prepare("UPDATE chat_threads SET claude_session_id = ?, title = ?, updated_at = ? WHERE id = ?")
        .run(patch.claudeSessionId !== undefined ? patch.claudeSessionId : cur.claudeSessionId, patch.title ?? cur.title, now(), id);
}
export function deleteThread(id) {
    tx(() => {
        db().prepare("DELETE FROM chat_messages WHERE thread_id = ?").run(id);
        db().prepare("DELETE FROM chat_threads WHERE id = ?").run(id);
    });
}
export function listMessages(threadId) {
    return db().prepare("SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at, rowid").all(threadId).map((r) => ({
        id: String(r.id),
        threadId: String(r.thread_id),
        role: String(r.role),
        text: String(r.text),
        pack: j(r.pack_json, null),
        files: j(r.files, []),
        createdAt: String(r.created_at),
    }));
}
export function addMessage(threadId, role, text, pack = null, files = []) {
    db()
        .prepare("INSERT INTO chat_messages(id, thread_id, role, text, pack_json, files, created_at) VALUES(?,?,?,?,?,?,?)")
        .run(newId("msg_"), threadId, role, text, pack ? JSON.stringify(pack) : null, files.length ? JSON.stringify(files) : null, now());
    updateThread(threadId, {});
}
/* --------------------------------- backup -------------------------------- */
const BACKUP_TABLES = ["settings", "books", "units", "book_pictures", "own_pictures", "inspiration_topics", "content_items", "children", "attempts", "stickers", "chat_threads", "chat_messages"];
export function exportAll() {
    const out = {};
    for (const t of BACKUP_TABLES)
        out[t] = db().prepare(`SELECT * FROM ${t}`).all();
    return { app: "emma-english-studio", version: 1, exportedAt: now(), tables: out };
}
export function importAll(dump) {
    tx(() => {
        for (const t of BACKUP_TABLES) {
            const rows = dump.tables[t];
            if (!Array.isArray(rows))
                continue;
            db().exec(`DELETE FROM ${t}`);
            // Only columns this version has (a backup may carry a column that is no longer used).
            const known = new Set(db().prepare(`PRAGMA table_info(${t})`).all().map((c) => String(c.name)));
            for (const r of rows) {
                const cols = Object.keys(r).filter((c) => /^[a-z_]+$/.test(c) && known.has(c));
                if (!cols.length)
                    continue;
                db()
                    .prepare(`INSERT INTO ${t}(${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")})`)
                    .run(...cols.map((c) => r[c]));
            }
        }
        // A backup from before topics were given per child: the children keep the live topics (as after the upgrade).
        db().exec("UPDATE children SET topic_ids = (SELECT json_group_array(id) FROM inspiration_topics WHERE status = 'approved') WHERE topic_ids IS NULL");
        // An older backup has the old sticker list: move it into the album.
        syncStickers(db());
    });
}
