import { z } from "zod";
/* ------------------------------------------------------------------ */
/* Shared enums                                                        */
/* ------------------------------------------------------------------ */
export const Stage = z.enum(["pre-reader", "early-reader", "developing-reader", "independent-reader"]);
export const ContentType = z.enum([
    "vocabulary",
    "grammar",
    "reading",
    "listening",
    "speaking",
    "worksheet",
    "quiz",
    "lessonPlan",
    "game",
    "test",
]);
export const Source = z.enum(["book", "inspiration"]);
const emoji = z.string().min(1).max(16);
/* ------------------------------------------------------------------ */
/* Question building blocks (quiz, test, grammar, reading)            */
/* ------------------------------------------------------------------ */
const answerInOptions = (q) => q.options.includes(q.answer);
export const McQuestion = z
    .object({
    kind: z.literal("mc"),
    prompt: z.string().min(1),
    emoji: emoji.optional(),
    options: z.array(z.string().min(1)).min(2).max(4),
    answer: z.string().min(1),
})
    .refine(answerInOptions, { message: "answer must be one of the options", path: ["answer"] });
export const PictureOption = z.object({ emoji, label: z.string().min(1) });
export const PictureQuestion = z
    .object({
    kind: z.literal("picture"),
    prompt: z.string().min(1), // spoken aloud: "Find the cat."
    options: z.array(PictureOption).min(2).max(4),
    answer: z.string().min(1), // label of the right option
})
    .refine((q) => q.options.some((o) => o.label === q.answer), {
    message: "answer must match one option label",
    path: ["answer"],
});
export const TrueFalseQuestion = z.object({
    kind: z.literal("tf"),
    statement: z.string().min(1),
    emoji: emoji.optional(),
    answer: z.boolean(),
});
export const FillQuestion = z
    .object({
    kind: z.literal("fill"),
    sentence: z.string().includes("___", { message: "sentence must contain ___" }),
    options: z.array(z.string().min(1)).min(2).max(4),
    answer: z.string().min(1),
})
    .refine(answerInOptions, { message: "answer must be one of the options", path: ["answer"] });
export const MatchQuestion = z.object({
    kind: z.literal("match"),
    prompt: z.string().default("Match the pictures and the words."),
    pairs: z.array(z.object({ emoji, word: z.string().min(1) })).min(2).max(6),
});
export const OrderQuestion = z.object({
    kind: z.literal("order"),
    prompt: z.string().default("Put the words in order."),
    emoji: emoji.optional(),
    words: z.array(z.string().min(1)).min(2).max(8), // correct order
});
export const QuizQuestion = z.discriminatedUnion("kind", [
    McQuestion,
    PictureQuestion,
    TrueFalseQuestion,
    FillQuestion,
    MatchQuestion,
    OrderQuestion,
]);
/* ------------------------------------------------------------------ */
/* Content data per type                                               */
/* ------------------------------------------------------------------ */
export const WordCard = z.object({
    word: z.string().min(1),
    emoji: emoji,
    example: z.string().optional(),
    vi: z.string().optional(),
});
export const VocabularyData = z.object({ words: z.array(WordCard).min(1) });
export const GrammarData = z.object({
    pattern: z.string().min(1), // "I have a ___."
    explanation: z.string().min(1), // kid-friendly, no jargon
    examples: z.array(z.object({ text: z.string().min(1), emoji: emoji.optional() })).min(1),
    practice: z.array(QuizQuestion).default([]),
});
export const ReadingData = z.object({
    passage: z.string().min(1),
    emoji: emoji.optional(),
    questions: z.array(QuizQuestion).min(1),
});
export const ListeningTask = z
    .object({
    say: z.string().min(1), // what the TTS reads
    question: z.string().min(1),
    options: z.array(PictureOption).min(2).max(4),
    answer: z.string().min(1),
})
    .refine((t) => t.options.some((o) => o.label === t.answer), {
    message: "answer must match one option label",
    path: ["answer"],
});
export const ListeningData = z.object({
    intro: z.string().optional(),
    tasks: z.array(ListeningTask).min(1),
});
export const SpeakingData = z.object({
    prompts: z
        .array(z.object({
        mode: z.enum(["repeat", "answer"]).default("repeat"),
        question: z.string().optional(), // asked aloud when mode = answer
        text: z.string().min(1), // expected words
        emoji: emoji.optional(),
        hint: z.string().optional(),
    }))
        .min(1),
});
export const WorksheetSection = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("trace"), title: z.string().default("Trace the words."), words: z.array(z.string().min(1)).min(1) }),
    z.object({
        kind: z.literal("match"),
        title: z.string().default("Match."),
        pairs: z.array(z.object({ emoji, word: z.string().min(1) })).min(2).max(8),
    }),
    z.object({
        kind: z.literal("fill"),
        title: z.string().default("Fill in the blanks."),
        wordBank: z.array(z.string()).optional(),
        items: z.array(z.object({ sentence: z.string().min(1), answer: z.string().min(1) })).min(1),
    }),
    z.object({
        kind: z.literal("circle"),
        title: z.string().default("Look and circle."),
        items: z.array(z.object({ emoji, options: z.array(z.string().min(1)).min(2).max(4), answer: z.string().min(1) })).min(1),
    }),
    z.object({ kind: z.literal("wordsearch"), title: z.string().default("Find the words."), words: z.array(z.string().min(2)).min(3).max(10) }),
    z.object({ kind: z.literal("draw"), title: z.string().default("Draw and color."), prompt: z.string().min(1) }),
]);
export const WorksheetData = z.object({
    instructions: z.string().optional(),
    sections: z.array(WorksheetSection).min(1),
});
export const LessonStage = z.enum(["warm-up", "learn", "practice", "play", "review"]);
export const LessonPlanData = z.object({
    minutes: z.number().int().min(5).max(60),
    objectives: z.array(z.string().min(1)).min(1),
    materials: z.array(z.string()).default([]),
    steps: z
        .array(z.object({
        stage: LessonStage,
        minutes: z.number().int().min(1).max(30),
        activity: z.string().min(1),
        parentScript: z.string().min(1), // what the parent says/does
    }))
        .min(2),
});
/** Mini games (see src/lib/games.ts for what each one is and how two are chosen per unit/topic). */
export const GameKind = z.enum(["memory", "balloon", "spelling", "sort", "fishing", "feed", "spy", "popup", "echo", "traffic", "rocket"]);
export const GameData = z
    .object({
    game: GameKind,
    words: z.array(z.object({ word: z.string().min(1), emoji, category: z.string().optional() })).min(3),
    categories: z.array(z.string().min(1)).optional(),
})
    .refine((g) => g.game !== "sort" || ((g.categories?.length ?? 0) >= 2 && g.words.every((w) => w.category && g.categories.includes(w.category))), {
    message: "sort games need 2+ categories and every word must have one of them",
    path: ["categories"],
});
export const TestData = z.object({
    minutes: z.number().int().min(5).max(90).default(20),
    sections: z
        .array(z.object({
        title: z.string().min(1),
        skill: z.enum(["listening", "vocabulary", "grammar", "reading", "writing"]),
        questions: z.array(QuizQuestion).min(1),
    }))
        .min(1),
});
export const QuizData = z.object({ questions: z.array(QuizQuestion).min(1) });
export const dataSchemaByType = {
    vocabulary: VocabularyData,
    grammar: GrammarData,
    reading: ReadingData,
    listening: ListeningData,
    speaking: SpeakingData,
    worksheet: WorksheetData,
    quiz: QuizData,
    lessonPlan: LessonPlanData,
    game: GameData,
    test: TestData,
};
/* ------------------------------------------------------------------ */
/* Packs (AI output contracts)                                         */
/* ------------------------------------------------------------------ */
const packItem = (type) => z.object({ type: z.literal(type), title: z.string().min(1), data: dataSchemaByType[type] });
export const PackItem = z.discriminatedUnion("type", [
    packItem("vocabulary"),
    packItem("grammar"),
    packItem("reading"),
    packItem("listening"),
    packItem("speaking"),
    packItem("worksheet"),
    packItem("quiz"),
    packItem("lessonPlan"),
    packItem("game"),
    packItem("test"),
]);
export const PracticePack = z.object({
    kind: z.literal("practice-pack"),
    items: z.array(PackItem).min(1),
});
export const InspirationPack = z.object({
    kind: z.literal("inspiration-pack"),
    topic: z.object({
        title: z.string().min(1),
        emoji,
        description: z.string().min(1),
        stage: Stage,
    }),
    items: z.array(PackItem).min(1),
});
export function validateItemData(type, data) {
    return dataSchemaByType[type].safeParse(data);
}
