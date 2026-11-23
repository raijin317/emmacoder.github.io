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
/**
 * Map of word → picture URL (plus emoji → URL when an emoji belongs to one word only).
 * o.drawn: the book's drawings (picKey → version) — they come first; o.crops: also use pictures
 * cut from the book pages (only when the PDF's pages are in this browser).
 */
export function buildPictureMap(bookId, units, o = { crops: true }) {
    const map = {};
    const emojiOwners = new Map();
    for (const u of units)
        for (const v of u.vocabulary) {
            const k = picKey(v.word);
            if (v.emoji)
                emojiOwners.set(v.emoji, (emojiOwners.get(v.emoji) ?? new Set()).add(k));
        }
    for (const u of units)
        for (const v of u.vocabulary) {
            const k = picKey(v.word);
            const version = o.drawn?.get(k);
            const url = version !== undefined ? drawnUrl(bookId, k, version) : v.pic && o.crops !== false ? cropUrl(bookId, v.pic) : null;
            if (!url)
                continue;
            map[`w:${k}`] ??= url;
            if (v.emoji && emojiOwners.get(v.emoji)?.size === 1)
                map[`e:${v.emoji}`] ??= url;
        }
    return map;
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
