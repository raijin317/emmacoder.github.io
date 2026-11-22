import { assessBook } from "@/lib/assessment.js";
import { buildQuickPack } from "@/lib/quickPack.js";
import { createItem, getBook, getSetting, listItems, saveChild, listChildren, setSetting, upsertBook, upsertUnit } from "./repo.js";
import { tx } from "./db.js";
/** Original demo content so the app is usable before real books are imported. */
const DEMO_BOOK_ID = "demo-sunny-starter";
const units = [
    {
        id: `${DEMO_BOOK_ID}-u01`,
        bookId: DEMO_BOOK_ID,
        order: 1,
        pages: [1, 1],
        title: "My Toys",
        topic: "toys",
        vocabulary: [
            { word: "ball", emoji: "⚽", vi: "quả bóng" },
            { word: "car", emoji: "🚗", vi: "ô tô" },
            { word: "doll", emoji: "🪆", vi: "búp bê" },
            { word: "kite", emoji: "🪁", vi: "con diều" },
            { word: "robot", emoji: "🤖", vi: "người máy" },
            { word: "teddy bear", emoji: "🧸", vi: "gấu bông" },
            { word: "train", emoji: "🚂", vi: "tàu hỏa" },
        ],
        patterns: [
            { text: "It's a ___.", function: "naming things" },
            { text: "I have a ___.", function: "talking about what you have" },
        ],
        sentences: [],
        readings: [],
        phonics: [{ focus: "b", examples: ["ball", "bear", "bike"] }],
        songsChants: [],
        skills: ["listening", "speaking", "reading", "writing"],
        activityTypes: ["listen and point", "say", "trace"],
        longestReadingWords: 25,
        confidence: 1,
        notes: "Demo unit (original content).",
    },
    {
        id: `${DEMO_BOOK_ID}-u02`,
        bookId: DEMO_BOOK_ID,
        order: 2,
        pages: [2, 2],
        title: "Animals at the Farm",
        topic: "farm animals",
        vocabulary: [
            { word: "cow", emoji: "🐄", vi: "con bò" },
            { word: "pig", emoji: "🐖", vi: "con lợn" },
            { word: "duck", emoji: "🦆", vi: "con vịt" },
            { word: "horse", emoji: "🐎", vi: "con ngựa" },
            { word: "sheep", emoji: "🐑", vi: "con cừu" },
            { word: "hen", emoji: "🐔", vi: "con gà mái" },
        ],
        patterns: [
            { text: "I can see a ___.", function: "saying what you see" },
            { text: "The ___ is big.", function: "describing" },
        ],
        sentences: [],
        readings: [],
        phonics: [{ focus: "d", examples: ["duck", "dog", "doll"] }],
        songsChants: [],
        skills: ["listening", "speaking", "reading", "writing"],
        activityTypes: ["listen and number", "point and say", "read and circle"],
        longestReadingWords: 32,
        confidence: 1,
        notes: "Demo unit (original content).",
    },
];
const handWritten = {
    [`${DEMO_BOOK_ID}-u01`]: [
        {
            type: "grammar",
            title: "It's a … / I have a …",
            data: {
                pattern: "I have a ___.",
                explanation: "Say “I have a …” and then your toy. Use “It's a …” to name a thing.",
                examples: [
                    { text: "I have a ball.", emoji: "⚽" },
                    { text: "I have a kite.", emoji: "🪁" },
                    { text: "It's a robot.", emoji: "🤖" },
                ],
                practice: [
                    { kind: "fill", sentence: "I have a ___.", options: ["car", "cow"], answer: "car" },
                    { kind: "order", prompt: "Put the words in order.", emoji: "🪆", words: ["I", "have", "a", "doll"] },
                    { kind: "mc", prompt: "Which is right?", emoji: "🚂", options: ["It's a train.", "It a train."], answer: "It's a train." },
                ],
            },
        },
        {
            type: "reading",
            title: "Mia's Toy Box",
            data: {
                emoji: "🧸",
                passage: "This is Mia. She has a toy box. In the box, she has a ball, a doll and a red car. Her teddy bear is on the bed. Mia likes her kite. It's big and blue!",
                questions: [
                    { kind: "tf", statement: "Mia has a toy box.", emoji: "📦", answer: true },
                    { kind: "mc", prompt: "Where is the teddy bear?", emoji: "🧸", options: ["on the bed", "in the box", "on the car"], answer: "on the bed" },
                    { kind: "mc", prompt: "What color is the kite?", emoji: "🪁", options: ["red", "blue", "green"], answer: "blue" },
                ],
            },
        },
    ],
    [`${DEMO_BOOK_ID}-u02`]: [
        {
            type: "grammar",
            title: "I can see a …",
            data: {
                pattern: "I can see a ___.",
                explanation: "Look around and say “I can see a …” with an animal.",
                examples: [
                    { text: "I can see a cow.", emoji: "🐄" },
                    { text: "I can see a duck.", emoji: "🦆" },
                    { text: "The horse is big.", emoji: "🐎" },
                ],
                practice: [
                    { kind: "fill", sentence: "I can see a ___.", options: ["pig", "car"], answer: "pig" },
                    { kind: "order", prompt: "Put the words in order.", emoji: "🐑", words: ["I", "can", "see", "a", "sheep"] },
                ],
            },
        },
        {
            type: "reading",
            title: "Grandpa's Farm",
            data: {
                emoji: "🚜",
                passage: "I am at Grandpa's farm. I can see a cow and a horse. The horse is big and brown. I can see three ducks in the pond. The pig is pink. It is happy in the mud!",
                questions: [
                    { kind: "tf", statement: "The horse is small.", emoji: "🐎", answer: false },
                    { kind: "mc", prompt: "How many ducks?", emoji: "🦆", options: ["two", "three", "four"], answer: "three" },
                    { kind: "mc", prompt: "What color is the pig?", emoji: "🐖", options: ["pink", "brown", "white"], answer: "pink" },
                ],
            },
        },
    ],
};
export function seedDemo(force = false) {
    if (!force && (getSetting("demoSeeded") === "1" || getBook(DEMO_BOOK_ID)))
        return false;
    const assessment = assessBook(1, units);
    tx(() => {
        upsertBook({
            id: DEMO_BOOK_ID,
            fileName: "(demo)",
            title: "Emma Starter — Demo Book",
            series: "Demo",
            bookType: "student-book",
            grade: 1,
            pageCount: 2,
            status: "ready",
            isDemo: true,
            assessment,
            meta: { title: "Emma Starter — Demo Book", series: "Demo", bookType: "student-book", grade: 1, units: units.map((u) => ({ order: u.order, title: u.title, startPage: u.pages[0], endPage: u.pages[1] })) },
            importedAt: new Date().toISOString(),
        });
        for (const u of units) {
            upsertUnit(u, "approved");
            if (listItems({ unitId: u.id }).length)
                continue;
            const pack = [...handWritten[u.id], ...buildQuickPack(u, assessment.generationProfile, { seed: u.id })];
            for (const it of pack) {
                createItem({ source: "book", bookId: DEMO_BOOK_ID, unitId: u.id, inspirationTopicId: null, type: it.type, title: it.title, status: "approved", stage: assessment.stage, data: it.data, createdBy: "demo" });
            }
        }
        if (!listChildren().length)
            saveChild({ name: "Little Star", avatar: "🐻", age: 6, activeBookId: DEMO_BOOK_ID });
        setSetting("demoSeeded", "1");
    });
    return true;
}
export { DEMO_BOOK_ID };
