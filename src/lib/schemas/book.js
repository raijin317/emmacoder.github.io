import { z } from "zod";
import { Stage } from "./content.js";
/** Output of the overview pass (cover + contents pages). */
export const BookMeta = z.object({
    title: z.string().min(1),
    series: z.string().nullable().default(null),
    bookType: z.enum(["student-book", "workbook", "teacher-book", "other"]).default("student-book"),
    /** 0 = preschool / kindergarten, 1–5 = primary grade, null = unknown */
    grade: z.number().int().min(0).max(5).nullable().default(null),
    units: z
        .array(z.object({
        order: z.number().int().min(1),
        title: z.string().min(1),
        startPage: z.number().int().min(1),
        endPage: z.number().int().min(1),
    }))
        .min(1),
    notes: z.string().optional(),
});
const clamp01 = (n) => Math.min(1, Math.max(0, n));
/**
 * Where a picture sits on a rendered book page: [left, top, width, height] as fractions (0–1) of the page image.
 * Out-of-range values are clamped instead of failing the whole extraction.
 */
export const PictureBox = z
    .array(z.number())
    .length(4)
    .transform(([x, y, w, h]) => {
    const left = clamp01(x);
    const top = clamp01(y);
    return [left, top, Math.max(0.01, Math.min(1 - left, w)), Math.max(0.01, Math.min(1 - top, h))];
});
/** A word's own picture in the book (cropped from the rendered page when shown). */
export const BookPicture = z.object({ page: z.number().int().min(1), box: PictureBox });
/** A text the child reads in the book (dialogue, chant, short story, sentences), copied exactly. */
export const BookReading = z.object({
    title: z.string().default(""),
    text: z.string().min(1),
    page: z.number().int().optional(),
});
/** Output of the per-unit pass. */
export const UnitExtractCore = z.object({
    title: z.string().min(1),
    topic: z.string().min(1),
    vocabulary: z
        .array(z.object({
        word: z.string().min(1),
        partOfSpeech: z.string().optional(),
        emoji: z.string().optional(),
        vi: z.string().optional(),
        page: z.number().int().optional(),
        /** The book's picture of this word (optional; a bad box is dropped, not fatal). */
        pic: BookPicture.optional().catch(undefined),
        /**
         * Which picture the child sees (chosen by the parent in the unit's word list): the parent's own picture,
         * Claude's drawing, the book's own picture, or the emoji. Not set = the parent's picture, else the drawing,
         * else the book picture, else the emoji.
         */
        show: z.enum(["own", "drawing", "book", "emoji"]).optional().catch(undefined),
    }))
        .default([]),
    patterns: z
        .array(z.object({ text: z.string().min(1), function: z.string().default(""), page: z.number().int().optional() }))
        .default([]),
    /** Model sentences printed in the unit (speech bubbles, dialogues, pattern boxes), exactly as written. */
    sentences: z.array(z.string().min(1)).default([]),
    /** Texts the child reads in this unit, exactly as printed. */
    readings: z.array(BookReading).default([]),
    phonics: z.array(z.object({ focus: z.string(), examples: z.array(z.string()).default([]) })).default([]),
    songsChants: z.array(z.object({ title: z.string(), page: z.number().int().optional() })).default([]),
    skills: z.array(z.enum(["listening", "speaking", "reading", "writing"])).default([]),
    activityTypes: z.array(z.string()).default([]),
    /** Longest reading text in this unit, in words (0 if none). */
    longestReadingWords: z.number().int().min(0).default(0),
    notes: z.string().optional(),
    confidence: z.number().min(0).max(1).default(0.7),
});
export const UnitExtract = UnitExtractCore.extend({
    id: z.string(),
    bookId: z.string(),
    order: z.number().int(),
    pages: z.tuple([z.number().int(), z.number().int()]),
});
export const GenerationProfile = z.object({
    maxSentenceWords: z.number().int(),
    readingPassageWords: z.tuple([z.number().int(), z.number().int()]),
    allowWriting: z.boolean(),
    allowReadingInstructions: z.boolean(),
    questionsPerQuiz: z.number().int(),
    sessionMinutes: z.number().int(),
});
export const BookAssessment = z.object({
    stage: Stage,
    cefr: z.enum(["Pre-A1", "A1", "A2"]),
    estimatedAge: z.object({ min: z.number().int(), max: z.number().int() }),
    estimatedGrade: z.number().int().min(0).max(5).nullable(),
    rationale: z.array(z.string()),
    metrics: z.object({
        units: z.number().int(),
        distinctWords: z.number().int(),
        avgNewWordsPerUnit: z.number(),
        avgPatternWords: z.number(),
        longestReadingWords: z.number().int(),
        hasReading: z.boolean(),
        hasWriting: z.boolean(),
    }),
    generationProfile: GenerationProfile,
});
