import { z } from "zod";
import { UnitExtractCore } from "./book.js";
import { PackItem } from "./content.js";

/**
 * A "book package": everything read from one textbook PDF, plus the lessons Claude wrote for it
 * (made by following Import_Book.md). The app imports it like the desktop app's "Import Book":
 * units are approved, Claude's lessons are checked against the lesson rules, and the offline builder
 * adds the word-based lessons (vocabulary, games, worksheet) and any lesson type that is missing.
 *
 * Built-in packages live in content/books/<bookId>.json and are listed in content/books/index.json
 * (the site imports them when it opens); a private package can be imported in Parent → Books.
 */
export const PACKAGE_FORMAT = "emma-book-package";

/** Lesson types Claude writes for each unit (same split as the desktop app). */
export const CLAUDE_TYPES = ["grammar", "reading", "listening", "speaking", "quiz", "lessonPlan", "test"];
/** Lesson types the app always builds itself from the unit's words. */
export const LOCAL_TYPES = ["vocabulary", "game", "worksheet"];

export const PackageUnit = UnitExtractCore.extend({
    order: z.number().int().min(1),
    /** PDF page indexes (1 = first page of the file), first and last page of the unit. */
    pages: z.tuple([z.number().int().min(1), z.number().int().min(1)]).refine(([a, b]) => b >= a, { message: "the last page must not be before the first page" }),
    /** Lessons written for this unit (types from CLAUDE_TYPES). */
    items: z.array(PackItem).default([]),
});

export const PackageBook = z.object({
    /** Lower-case id: slug of the PDF file name + "-" + the first 8 hex digits of the file's SHA-256 (as the app does). */
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use lower-case letters, digits and dashes").min(3).max(60),
    title: z.string().min(1).max(120),
    series: z.string().max(80).nullable().default(null),
    bookType: z.enum(["student-book", "workbook", "teacher-book", "other"]).default("student-book"),
    /** 0 = preschool / kindergarten, 1–5 = primary grade, null = unknown. */
    grade: z.number().int().min(0).max(5).nullable().default(null),
    /** Number of pages of the PDF (so the app knows the page numbers are real). */
    pageCount: z.number().int().min(0).default(0),
    /** The PDF's file name (shown in the book details). */
    fileName: z.string().max(200).default("(book package)"),
});

export const BookPackage = z
    .object({
        format: z.literal(PACKAGE_FORMAT),
        /** Bump it whenever the package changes — the site then imports it again (the parent's edits are kept). */
        version: z.number().int().min(1),
        book: PackageBook,
        units: z.array(PackageUnit).min(1),
        notes: z.string().optional(),
        generatedBy: z.string().optional(),
        generatedAt: z.string().optional(),
    })
    .superRefine((p, ctx) => {
        const orders = p.units.map((u) => u.order);
        if (new Set(orders).size !== orders.length) ctx.addIssue({ code: "custom", path: ["units"], message: "two units have the same order number" });
        p.units.forEach((u, i) => {
            if (p.book.pageCount && u.pages[1] > p.book.pageCount) ctx.addIssue({ code: "custom", path: ["units", i, "pages"], message: `unit ${u.order} ends after the last page (${p.book.pageCount})` });
            u.vocabulary.forEach((v, k) => {
                if (v.pic && p.book.pageCount && v.pic.page > p.book.pageCount) ctx.addIssue({ code: "custom", path: ["units", i, "vocabulary", k, "pic", "page"], message: `picture page ${v.pic.page} is after the last page` });
            });
            u.items.forEach((it, k) => {
                if (!CLAUDE_TYPES.includes(it.type)) ctx.addIssue({ code: "custom", path: ["units", i, "items", k, "type"], message: `“${it.type}” is made by the app itself — only ${CLAUDE_TYPES.join(", ")} belong in a package` });
            });
        });
    });

/** The id of a package unit in the app ("<bookId>-u03"). */
export const packageUnitId = (bookId, order) => `${bookId}-u${String(order).padStart(2, "0")}`;
