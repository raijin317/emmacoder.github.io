/** "a Ball!" → "ball", "teddy bears" stays as written apart from case/punctuation. */
export function picKey(word) {
    return word
        .toLowerCase()
        .replace(/[“”"!?.,:;()]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^(a|an|the) /, "");
}
export function cropUrl(bookId, pic, size = 400) {
    return `/api/books/${bookId}/crop?p=${pic.page}&b=${pic.box.map((n) => n.toFixed(4)).join(",")}&s=${size}`;
}
/** A picture Claude drew for a word of the book (book packages, lesson rule 2). */
export function drawnUrl(bookId, key, version = "") {
    return `/api/books/${bookId}/drawn/${encodeURIComponent(key)}${version ? `?v=${encodeURIComponent(version)}` : ""}`;
}
/** The three pictures a word can have, in the order used when the parent has not chosen one. */
export const PICTURE_KINDS = ["drawing", "book", "emoji"];
/**
 * Which picture the child sees for a word: the parent's choice (v.show) when that picture is there,
 * otherwise Claude's drawing, then the book's own picture, then the emoji.
 * has.drawing: the book has a drawing of the word; has.book: the word's book picture can be shown
 * (a box is set and the PDF's pages are in this browser).
 */
export function pictureKind(v, has) {
    const order = v.show ? [v.show, ...PICTURE_KINDS] : PICTURE_KINDS;
    return order.find((k) => k === "emoji" || has[k]) ?? "emoji";
}
/**
 * Map of word → picture URL (plus emoji → URL when an emoji belongs to one word only).
 * o.drawn: the book's drawings (picKey → version); o.crops: pictures cut from the book pages can be
 * shown (only when the PDF's pages are in this browser). Each word shows the picture chosen for it
 * (pictureKind); the first unit that has the word decides. A word met again (review units) without its
 * own book picture or choice uses the ones it has in the other units.
 */
export function buildPictureMap(bookId, units, o = { crops: true }) {
    const map = {};
    const emojiOwners = new Map();
    const decided = new Set();
    const known = wordPictures(units);
    for (const u of units)
        for (const v of u.vocabulary) {
            const k = picKey(v.word);
            if (v.emoji)
                emojiOwners.set(v.emoji, (emojiOwners.get(v.emoji) ?? new Set()).add(k));
        }
    for (const u of units)
        for (const v of u.vocabulary) {
            const k = picKey(v.word);
            if (!k || decided.has(k))
                continue;
            decided.add(k);
            const url = pictureUrl(bookId, { ...v, pic: v.pic ?? known.pic.get(k), show: v.show ?? known.show.get(k) }, o);
            if (!url)
                continue;
            map[`w:${k}`] = url;
            if (v.emoji && emojiOwners.get(v.emoji)?.size === 1)
                map[`e:${v.emoji}`] ??= url;
        }
    return map;
}
/** For each word (picKey) of these units: the first book picture box and the first parent's choice found. */
export function wordPictures(units) {
    const pic = new Map();
    const show = new Map();
    for (const u of units)
        for (const v of u.vocabulary) {
            const k = picKey(v.word);
            if (v.pic && !pic.has(k))
                pic.set(k, v.pic);
            if (v.show && !show.has(k))
                show.set(k, v.show);
        }
    return { pic, show };
}
/** URL of the picture chosen for a word (null = its emoji). Options as for buildPictureMap. */
export function pictureUrl(bookId, v, o = { crops: true }, size = 400) {
    const k = picKey(v.word);
    const version = o.drawn?.get(k);
    const kind = pictureKind(v, { drawing: version !== undefined, book: !!v.pic && o.crops !== false });
    if (kind === "drawing")
        return drawnUrl(bookId, k, version);
    if (kind === "book")
        return cropUrl(bookId, v.pic, size);
    return null;
}
/** Finds the picture for a word (preferred) or an emoji. */
export function lookupPicture(map, word, emoji) {
    if (!map)
        return null;
    if (word) {
        const k = picKey(word);
        const hit = map[`w:${k}`] ?? (k.endsWith("s") ? (map[`w:${k.slice(0, -1)}`] ?? (k.endsWith("es") ? map[`w:${k.slice(0, -2)}`] : undefined)) : undefined);
        if (hit)
            return hit;
    }
    return (emoji && map[`e:${emoji}`]) || null;
}
