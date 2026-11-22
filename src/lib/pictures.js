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
/** Map of word → picture URL (plus emoji → URL when an emoji belongs to one word only). */
export function buildPictureMap(bookId, units) {
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
            if (!v.pic)
                continue;
            const url = cropUrl(bookId, v.pic);
            const k = picKey(v.word);
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
