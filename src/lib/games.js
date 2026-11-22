export const GAMES = {
    memory: {
        label: "Memory match",
        icon: "🧠",
        family: "memory",
        blurb: "turn the cards over and find each picture with its word",
        themes: /famil|friend|job|feel|cloth|wear|toy|house|home|room|furniture|face/i,
        maxWords: 6,
    },
    balloon: {
        label: "Balloon pop",
        icon: "🎈",
        family: "find",
        blurb: "hear a word and pop the balloon with its picture",
        themes: /colou?r|party|birthday|shape|festival|celebrat|circus|fair|holiday|new year|tet\b/i,
        maxWords: 8,
    },
    spelling: {
        label: "Spelling bee",
        icon: "🐝",
        family: "read",
        needs: "writing",
        blurb: "hear a word and build it letter by letter",
        themes: /letter|alphabet|abc|phonic|spell|sound/i,
        maxWords: 6,
    },
    sort: {
        label: "Sort into baskets",
        icon: "🧺",
        family: "sort",
        needs: "categories",
        blurb: "put each picture into the right basket (needs 2+ categories)",
        themes: /sort|group|kind|type/i,
        maxWords: 10,
    },
    fishing: {
        label: "Go fishing",
        icon: "🎣",
        family: "find",
        blurb: "hear a word and catch the swimming fish that carries its picture",
        themes: /sea|ocean|fish|beach|seaside|water|swim|river|lake|pond|boat|ship|summer|aquarium|pet|island|shell|crab/i,
        maxWords: 8,
    },
    feed: {
        label: "Feed Munchy",
        icon: "😋",
        family: "find",
        blurb: "a hungry monster asks for something — give it the right picture (tap or drag)",
        themes: /food|fruit|eat|drink|lunch|breakfast|dinner|meal|kitchen|cook|cake|party|picnic|restaurant|caf[eé]|snack|vegetable|hungry|grocer|supermarket|bakery|dining|candy|pizza|milk|juice|bread|rice|apple|banana/i,
        maxWords: 8,
    },
    spy: {
        label: "I spy",
        icon: "🔍",
        family: "find",
        blurb: "only a small part of each picture shows through a magnifying glass — find the word",
        themes: /animal|zoo|house|home|room|thing|school|classroom|toy|shape|body|face|cloth|bedroom|living|bathroom|object|bag|pencil/i,
        maxWords: 8,
    },
    popup: {
        label: "Pop-up friends",
        icon: "🐹",
        family: "find",
        blurb: "pictures pop up from holes in the grass — tap the right one quickly",
        themes: /farm|garden|yard|park|forest|nature|spring|flower|insect|bug|jungle|playground|countryside|backyard|animal|tree|hide/i,
        maxWords: 8,
    },
    echo: {
        label: "Copy the parrot",
        icon: "🦜",
        family: "memory",
        blurb: "the parrot says 2–3 words — tap the pictures in the same order",
        themes: /music|song|family|friend|body|action|sport|school|classroom|number|day|week|bird|jungle|game|play|hobby|move/i,
        maxWords: 6,
    },
    traffic: {
        label: "Go, car, go!",
        icon: "🚦",
        family: "judge",
        blurb: "see a picture and hear a word: green for yes, red for no — the car races to the flag",
        themes: /car|bus|vehicle|transport|road|street|town|city|travel|trip|bike|train|place|direction|stop|journey|traffic|plane|taxi|truck/i,
        maxWords: 8,
    },
    rocket: {
        label: "Rocket words",
        icon: "🚀",
        family: "read",
        needs: "reading",
        blurb: "read the words on the planets and pick the one for the picture; the rocket blasts off at the end",
        themes: /space|planet|star|moon|sun|sky|weather|robot|night|future|season|cloud|rain/i,
        maxWords: 8,
    },
};
export const GAME_KINDS = Object.keys(GAMES);
/* ------------------------------ what the games say ------------------------------ */
/** "shoes", "pants" → plural; "bus", "glass", "octopus", "Christmas" → not. */
export function isPlural(word) {
    const last = word.trim().toLowerCase().split(/\s+/).pop() ?? "";
    if (last.length < 3 || !last.endsWith("s"))
        return false;
    if (/(ss|us|ous|ics)$/.test(last))
        return false;
    return !["christmas", "yes", "gas", "this", "his", "was", "has", "lens", "tennis", "iris", "axis", "news", "atlas", "canvas"].includes(last);
}
/** The sentence each game says for a word (kept here so the players and the voice warm-up say exactly the same). */
export const GAME_SAY = {
    balloon: (w) => `Pop the ${w}!`,
    fishing: (w) => `Catch the ${w}!`,
    feed: (w) => `Give me the ${w}, please!`,
    spy: (w) => `${isPlural(w) ? "Where are" : "Where is"} the ${w}?`,
    popup: (w) => `Tap the ${w}!`,
    traffic: (w) => `${isPlural(w) ? "Are these" : "Is this"} the ${w}?`,
};
/** Fixed lines of the games. */
export const GAME_LINES = {
    feedThanks: "Yummy! Thank you!",
    echoIntro: "Listen, then tap in the same order!",
    echoTurn: "Your turn!",
    echoAgain: "Listen again.",
    trafficWin: "Hooray! You won the race!",
    rocketLaunch: "Three, two, one. Blast off!",
    fishingDone: "Wow! A bucket full of fish!",
};
/** Everything a game item can say (for the natural-voice warm-up). */
export function gameSpeakables(kind, words) {
    const out = [];
    const n = (text, slow = false) => out.push({ text, slow });
    for (const w of words) {
        n(w);
        if (kind in GAME_SAY)
            n(GAME_SAY[kind](w));
        if (kind === "spelling")
            n(w.split("").join(", "), true);
    }
    if (kind === "feed")
        n(GAME_LINES.feedThanks);
    if (kind === "echo")
        [GAME_LINES.echoIntro, GAME_LINES.echoTurn, GAME_LINES.echoAgain].forEach((t) => n(t));
    if (kind === "traffic")
        n(GAME_LINES.trafficWin);
    if (kind === "rocket")
        n(GAME_LINES.rocketLaunch);
    if (kind === "fishing")
        n(GAME_LINES.fishingDone);
    return out;
}
const spellable = (words) => words.filter((w) => /^[a-z]{2,8}$/i.test(w.word));
/** The games this word list and level can be played with. */
export function playableGames(words, profile, o = {}) {
    return GAME_KINDS.filter((k) => {
        const g = GAMES[k];
        if (words.length < 3)
            return false;
        if (g.needs === "categories")
            return !!o.categories;
        if (g.needs === "writing")
            return profile.allowWriting && spellable(words).length >= 3;
        if (g.needs === "reading")
            return profile.allowWriting; // early readers and up read short words
        return true;
    });
}
function hash01(text) {
    let h = 2166136261;
    for (const c of text)
        h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Scores of every playable game (higher = better fit), for tests and the explanation in the editor. */
export function scoreGames(p) {
    const hay = `${p.text} ${p.words.map((w) => w.word).join(" ")}`;
    const recent = p.recent ?? [];
    return playableGames(p.words, p.profile)
        .filter((k) => !p.exclude?.includes(k))
        .map((kind) => {
        let score = 1 + hash01(`${p.seed}|${kind}`) * 0.8;
        if (GAMES[kind].themes.test(hay))
            score += 2.5;
        if (recent[0]?.includes(kind))
            score -= 3;
        if (recent[1]?.includes(kind))
            score -= 1.5;
        score -= (p.used?.[kind] ?? 0) * 0.6;
        return { kind, score };
    })
        .sort((a, b) => b.score - a.score);
}
/** Picks the games for a unit/topic (2 by default), different kinds and — when possible — different ways of playing. */
export function pickGames(p) {
    const count = p.count ?? 2;
    const ranked = scoreGames(p);
    const picked = [];
    while (picked.length < count && ranked.length) {
        const families = picked.map((k) => GAMES[k].family);
        ranked.sort((a, b) => b.score - (families.includes(GAMES[b.kind].family) ? 2 : 0) - (a.score - (families.includes(GAMES[a.kind].family) ? 2 : 0)));
        picked.push(ranked.shift().kind);
    }
    return picked;
}
/** Counts and recent lists from earlier groups of game kinds (oldest first). */
export function gameHistory(groups) {
    const used = {};
    for (const g of groups)
        for (const k of g)
            used[k] = (used[k] ?? 0) + 1;
    return { recent: [...groups].reverse().slice(0, 2), used };
}
/* ------------------------------ building a game item ------------------------------ */
function shuffled(arr, seed) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const k = Math.floor(hash01(`${seed}#${i}`) * (i + 1));
        [a[i], a[k]] = [a[k], a[i]];
    }
    return a;
}
/** A game item for a word list (null when the words don't suit that game). */
export function gameItem(kind, words, o) {
    const g = GAMES[kind];
    const unique = words.filter((w, k) => w.word.trim() && words.findIndex((x) => x.word.toLowerCase() === w.word.toLowerCase()) === k);
    let list;
    if (kind === "spelling")
        list = spellable(unique).slice(0, g.maxWords);
    else if (kind === "memory")
        list = shuffled(unique, o.seed).slice(0, o.young ? 4 : 6);
    else if (kind === "sort")
        return null;
    else
        list = unique.slice(0, g.maxWords);
    if (list.length < 3)
        return null;
    return { type: "game", title: g.label, data: { game: kind, words: list.map((w) => ({ word: w.word, emoji: w.emoji })) } };
}
/** The two (or `count`) picked games as items, skipping any that can't be built. */
export function gameItems(p) {
    const items = [];
    for (const kind of pickGames({ ...p, count: GAME_KINDS.length })) {
        if (items.length >= (p.count ?? 2))
            break;
        const it = gameItem(kind, p.words, { seed: `${p.seed}|${kind}`, young: p.young });
        if (it)
            items.push(it);
    }
    return items;
}
