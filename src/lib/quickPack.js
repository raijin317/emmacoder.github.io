import { gameItems } from "./games.js";
import { DEFAULT_RULES, RULE, ruleOn } from "./rules.js";
import { bookSentenceFor, bookTexts } from "./bookText.js";
/**
 * Offline "quick pack": builds practice items from a unit's words, sentences and patterns without AI.
 * Examples, listening scripts and the reading text come from the book's own sentences when it has them.
 * Grammar lessons are made separately from the unit's sentence patterns (src/lib/offlineGrammar.js).
 */
function rng(seedText) {
    let h = 2166136261;
    for (const c of seedText)
        h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
        h = Math.imul(h ^ (h >>> 15), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
}
export function fillPattern(pattern, word) {
    return pattern.replace(/_{2,}/, word);
}
export function buildQuickPack(unit, profile, opts = { seed: "x" }) {
    const rules = opts.rules ?? DEFAULT_RULES;
    const sentences = (unit.sentences ?? []).map((s) => s.trim()).filter(Boolean);
    const rand = rng(opts.seed);
    const shuffle = (a) => {
        const b = [...a];
        for (let i = b.length - 1; i > 0; i--) {
            const k = Math.floor(rand() * (i + 1));
            [b[i], b[k]] = [b[k], b[i]];
        }
        return b;
    };
    const words = unit.vocabulary
        .filter((v) => v.word.trim())
        .slice(0, 10)
        .map((v) => ({ word: v.word.trim(), emoji: v.emoji?.trim() || "⭐", vi: v.vi }));
    if (words.length < 3)
        return [];
    const pool = [...words, ...(opts.reviewWords ?? []).filter((r) => !words.some((w) => w.word === r.word))];
    const others = (w, n) => shuffle(pool.filter((p) => p.word !== w.word)).slice(0, n);
    // Only patterns with exactly one gap can be filled with one word ("Hi, ___. I'm ___." can't).
    const slotPatterns = unit.patterns.map((p) => p.text).filter((t) => (t.match(/_{2,}/g) ?? []).length === 1);
    const pattern = slotPatterns[0];
    // The book's own sentence for a word wins over a filled-in pattern.
    const example = (w) => bookSentenceFor(w.word, sentences, profile.maxSentenceWords + 2) ?? (pattern ? fillPattern(pattern, w.word) : undefined);
    const nQ = Math.min(profile.questionsPerQuiz, words.length + 2);
    const young = !profile.allowReadingInstructions;
    const pictureQ = (w) => ({
        kind: "picture",
        prompt: `Find the ${w.word}.`,
        options: shuffle([w, ...others(w, young ? 2 : 3)]).map((o) => ({ emoji: o.emoji, label: o.word })),
        answer: w.word,
    });
    const mcQ = (w) => ({
        kind: "mc",
        prompt: "What is this?",
        emoji: w.emoji,
        options: shuffle([w.word, ...others(w, 2).map((o) => o.word)]),
        answer: w.word,
    });
    const tfQ = (w) => {
        const truth = rand() > 0.5;
        const shown = truth ? w : others(w, 1)[0];
        return { kind: "tf", statement: `This is a ${w.word}.`, emoji: shown.emoji, answer: truth };
    };
    const fillQ = (w) => pattern ? { kind: "fill", sentence: pattern.replace(/_{2,}/, "___"), options: shuffle([w.word, ...others(w, 2).map((o) => o.word)]), answer: w.word } : null;
    const orderQ = (w) => {
        const s = example(w);
        if (!s)
            return null;
        const parts = s.replace(/[.?!]$/, "").split(/\s+/);
        return parts.length >= 3 && parts.length <= 8 ? { kind: "order", prompt: "Put the words in order.", emoji: w.emoji, words: parts } : null;
    };
    const emojiFor = (text) => words.find((w) => bookSentenceFor(w.word, [text]))?.emoji;
    /** Short sentences to say aloud: the book's own sentences first, then filled-in patterns. */
    function speakSentences() {
        const max = young ? 3 : 4;
        const fromBook = sentences.filter((s) => s.split(/\s+/).length <= profile.maxSentenceWords).slice(0, max);
        const list = fromBook.length ? fromBook : young ? [] : words.slice(0, 3).flatMap((w) => (example(w) ? [example(w)] : []));
        return list.map((text) => ({ mode: "repeat", text, emoji: emojiFor(text) ?? "💬" }));
    }
    /** "Read along" with the book's own text (rule: reading = the book's sentences). */
    function readingItems() {
        if (!ruleOn(rules, RULE.bookReading))
            return [];
        const text = bookTexts(unit)[0];
        if (!text)
            return [];
        const inText = words.filter((w) => bookSentenceFor(w.word, [text.text]));
        const questions = inText.slice(0, 3).map(pictureQ);
        const firstLine = text.text.split(/\n|(?<=[.!?])\s+/).map((l) => l.replace(/^[A-Z][a-z]+:\s*/, "").trim()).find((l) => {
            const n = l.replace(/[.?!]$/, "").split(/\s+/).length;
            return n >= 3 && n <= 7;
        });
        if (!young && firstLine)
            questions.push({ kind: "order", prompt: "Put the words in order.", emoji: emojiFor(firstLine), words: firstLine.replace(/[.?!]$/, "").split(/\s+/) });
        if (!questions.length)
            questions.push(...shuffle(words).slice(0, 2).map(pictureQ));
        return [{ type: "reading", title: text.title ? `${unit.title}: ${text.title}` : `${unit.title}: Read along`, data: { passage: text.text, emoji: inText[0]?.emoji, questions } }];
    }
    const quizQuestions = [];
    shuffle(words).forEach((w, i) => {
        const makers = young ? [pictureQ, tfQ] : [pictureQ, mcQ, fillQ, tfQ, orderQ];
        const q = makers[i % makers.length](w) ?? pictureQ(w);
        quizQuestions.push(q);
    });
    if (words.length >= 4)
        quizQuestions.push({ kind: "match", prompt: "Match the pictures and the words.", pairs: shuffle(words).slice(0, young ? 3 : 4).map((w) => ({ emoji: w.emoji, word: w.word })) });
    const items = [
        {
            type: "vocabulary",
            title: `${unit.title}: Words`,
            data: { words: words.map((w) => ({ word: w.word, emoji: w.emoji, example: example(w), vi: w.vi })) },
        },
        {
            type: "listening",
            title: `${unit.title}: Listen and choose`,
            data: {
                intro: "Listen and tap the right picture.",
                tasks: shuffle(words)
                    .slice(0, Math.min(6, words.length))
                    .map((w) => ({
                    say: example(w) ?? `${w.word}`,
                    question: "Which picture?",
                    options: shuffle([w, ...others(w, young ? 2 : 3)]).map((o) => ({ emoji: o.emoji, label: o.word })),
                    answer: w.word,
                })),
            },
        },
        {
            type: "speaking",
            title: `${unit.title}: Say it!`,
            data: {
                prompts: [
                    ...words.slice(0, 6).map((w) => ({ mode: "repeat", text: w.word, emoji: w.emoji })),
                    ...speakSentences(),
                ],
            },
        },
        ...readingItems(),
        { type: "quiz", title: `${unit.title}: Quiz`, data: { questions: quizQuestions.slice(0, Math.max(nQ, 3)) } },
        // Two mini games that fit the unit's topic and differ from the units just before (src/lib/games.ts).
        ...gameItems({
            text: `${unit.title} ${unit.topic ?? ""}`,
            words,
            profile,
            seed: opts.seed,
            recent: opts.games?.recent,
            used: opts.games?.used,
            young: !profile.allowWriting,
        }),
    ];
    const gameNames = items.filter((i) => i.type === "game").map((i) => i.title);
    items.push({
        type: "worksheet",
        title: `${unit.title}: Worksheet`,
        data: {
            instructions: young ? "Parent: read each instruction aloud." : undefined,
            sections: [
                profile.allowWriting
                    ? { kind: "trace", title: "Trace the words.", words: words.slice(0, 6).map((w) => w.word) }
                    : { kind: "draw", title: "Draw and color.", prompt: `Draw your favorite: ${words.slice(0, 3).map((w) => w.word).join(", ")}.` },
                { kind: "match", title: "Match.", pairs: shuffle(words).slice(0, 5).map((w) => ({ emoji: w.emoji, word: w.word })) },
                { kind: "circle", title: "Look and circle.", items: shuffle(words).slice(0, 4).map((w) => ({ emoji: w.emoji, options: shuffle([w.word, ...others(w, 2).map((o) => o.word)]), answer: w.word })) },
                ...(profile.allowWriting && words.filter((w) => /^[a-z]{3,9}$/i.test(w.word)).length >= 3
                    ? [{ kind: "wordsearch", title: "Find the words.", words: words.filter((w) => /^[a-z]{3,9}$/i.test(w.word)).slice(0, 6).map((w) => w.word) }]
                    : []),
            ],
        },
    });
    const list = words.slice(0, 6).map((w) => w.word).join(", ");
    items.push({
        type: "lessonPlan",
        title: `${unit.title}: Home lesson`,
        data: {
            minutes: profile.sessionMinutes,
            objectives: [`Say and recognize: ${list}.`, ...(pattern ? [`Use the pattern “${pattern}”.`] : [])],
            materials: ["Flashcards on screen", "Printed worksheet", "Crayons"],
            steps: [
                { stage: "warm-up", minutes: 2, activity: "Hello song and quick review", parentScript: "Say “Hello! How are you?” Sing a hello song together and clap." },
                { stage: "learn", minutes: Math.max(3, Math.round(profile.sessionMinutes * 0.25)), activity: "Flashcards", parentScript: `Open Words. Tap each card, listen, then say it together: ${list}.` },
                { stage: "practice", minutes: Math.max(3, Math.round(profile.sessionMinutes * 0.25)), activity: "Listen and choose + Say it", parentScript: "Do “Listen and choose”, then “Say it!”. Praise every try." },
                { stage: "play", minutes: Math.max(3, Math.round(profile.sessionMinutes * 0.25)), activity: gameNames.join(" or ") || "A game", parentScript: "Let your child pick a game. Say each word aloud when it appears." },
                { stage: "review", minutes: 2, activity: "Quiz + sticker", parentScript: "Do the quiz together. Celebrate the stars and the sticker!" },
            ],
        },
    });
    const listeningQs = shuffle(words).slice(0, 3).map(pictureQ);
    const vocabQs = shuffle(words).slice(0, 3).map((w) => (young ? tfQ(w) : mcQ(w)));
    const grammarQs = pattern ? shuffle(words).slice(0, 3).map((w) => fillQ(w)) : [];
    items.push({
        type: "test",
        title: `${unit.title}: Unit check`,
        data: {
            minutes: young ? 10 : 15,
            sections: [
                { title: "Listen and choose", skill: "listening", questions: listeningQs },
                { title: "Words", skill: "vocabulary", questions: vocabQs },
                ...(grammarQs.length && !young ? [{ title: "Sentences", skill: "grammar", questions: grammarQs }] : []),
            ],
        },
    });
    return items;
}
