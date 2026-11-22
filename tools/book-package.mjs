#!/usr/bin/env node
// Book packages (see Import_Book.md): helpers for making and checking them with the site's own schemas and rules.
//
//   node tools/book-package.mjs id <book.pdf>              book id (as the app makes it) + page count
//   node tools/book-package.mjs assemble <workDir> [--out <file>] [-v]
//                                                          work folder → package (content/books/<id>.json by default) + check + index
//   node tools/book-package.mjs check <package.json> [-v]  validate; level; lessons per unit; what the rules would drop
//   node tools/book-package.mjs index                      rebuild content/books/index.json from content/books/*.json
//
// Exit code 1 when a package has errors (fix them before publishing).
import * as nodeModule from "node:module";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

// The site's modules import "zod" and "@/…" (the import map in index.html); map them for Node too.
const mapped = (s) => (s === "zod" ? new URL("../vendor/zod.js", import.meta.url).href : s.startsWith("@/") ? new URL("../src/" + s.slice(2), import.meta.url).href : null);
if (nodeModule.registerHooks) nodeModule.registerHooks({ resolve: (s, c, next) => (mapped(s) ? { url: mapped(s), shortCircuit: true } : next(s, c)) });
else nodeModule.register("./node-hooks.mjs", import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS = path.join(ROOT, "content", "books");
const [cmd, ...args] = process.argv.slice(2);

const { BookPackage, CLAUDE_TYPES, LOCAL_TYPES, PACKAGE_FORMAT } = await import("../src/lib/schemas/package.js");
const { assessBook, STAGE_INFO } = await import("../src/lib/assessment.js");
const { enforceRules } = await import("../src/lib/enforceRules.js");
const { DEFAULT_RULES } = await import("../src/lib/rules.js");
const { bookTexts } = await import("../src/lib/bookText.js");
const { picKey } = await import("../src/lib/pictures.js");
const { z } = await import("zod");

function slugify(name) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      .replace(/\.pdf$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "book"
  );
}

async function pdfPages(file) {
  const { log, warn } = console;
  console.log = console.warn = () => {}; // pdf.js prints a note about its Node build
  try {
    const pdfjs = await import(pathToFileURL(path.join(ROOT, "vendor", "pdf.min.js")).href);
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(path.join(ROOT, "vendor", "pdf.worker.min.js")).href;
    const task = pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), verbosity: 0 });
    const doc = await task.promise;
    const n = doc.numPages;
    await task.destroy();
    return n;
  } catch {
    const raw = fs.readFileSync(file, "latin1");
    const m = [...raw.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g)].map((x) => Number(x[1]));
    return m.length ? Math.max(...m) : null;
  } finally {
    Object.assign(console, { log, warn });
  }
}

/** Words with an emoji anywhere in an item (picture options, pairs, cards…). */
function wordEmojis(data, out = []) {
  if (Array.isArray(data)) data.forEach((d) => wordEmojis(d, out));
  else if (data && typeof data === "object") {
    const w = typeof data.word === "string" ? data.word : typeof data.label === "string" ? data.label : null;
    if (w && typeof data.emoji === "string") out.push({ word: w, emoji: data.emoji });
    Object.values(data).forEach((v) => wordEmojis(v, out));
  }
  return out;
}

/** Sentences a lesson says or shows (for the level check). */
function sentencesOf(item) {
  const d = item.data;
  switch (item.type) {
    case "grammar":
      return d.examples.map((e) => e.text);
    case "listening":
      return d.tasks.map((t) => t.say);
    case "speaking":
      return d.prompts.map((p) => p.text);
    default:
      return [];
  }
}
const wordsIn = (s) => s.replace(/_+/g, " x ").split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;

function check(file, verbose) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.log(`❌ ${file}: not JSON (${e.message})`);
    return false;
  }
  const parsed = BookPackage.safeParse(raw);
  if (!parsed.success) {
    console.log(`❌ ${file}: does not match the book package format\n${z.prettifyError(parsed.error)}`);
    return false;
  }
  const pkg = parsed.data;
  const units = [...pkg.units].sort((a, b) => a.order - b.order);
  const a = assessBook(pkg.book.grade, units);
  const p = a.generationProfile;
  let errors = 0;
  let warnings = 0;
  const warn = (msg) => (warnings++, console.log(`   ⚠️  ${msg}`));
  const err = (msg) => (errors++, console.log(`   ❌ ${msg}`));
  console.log(`📘 ${pkg.book.title}  (id ${pkg.book.id}, version ${pkg.version}, ${pkg.book.pageCount || "?"} pages, grade ${pkg.book.grade ?? "unknown"})`);
  console.log(`   Level: ${STAGE_INFO[a.stage].label}, ages ${a.estimatedAge.min}–${a.estimatedAge.max}, ${a.cefr} — max ${p.maxSentenceWords} words per sentence, ${p.questionsPerQuiz} questions per quiz, ${p.sessionMinutes}-minute sessions, writing ${p.allowWriting ? "yes" : "no"}, reads instructions ${p.allowReadingInstructions ? "yes" : "no"}.`);
  if (!fs.existsSync(path.join(BOOKS, "index.json")) || !JSON.parse(fs.readFileSync(path.join(BOOKS, "index.json"), "utf8")).books?.some((b) => b.id === pkg.book.id && b.version === pkg.version)) {
    if (path.resolve(path.dirname(file)) === path.resolve(BOOKS)) warn("content/books/index.json does not list this version yet — run: node tools/book-package.mjs index");
  }
  const seenWords = [];
  for (const u of units) {
    const words = u.vocabulary.filter((v) => v.word.trim());
    const slot = u.patterns.filter((x) => (x.text.match(/_{2,}/g) ?? []).length === 1);
    const texts = bookTexts(u);
    console.log(`\n▶ Unit ${u.order}: ${u.title}  (pages ${u.pages[0]}–${u.pages[1]})`);
    console.log(`   ${words.length} words (${words.filter((v) => v.pic).length} with a book picture), ${u.patterns.length} patterns (${slot.length} with one ___), ${u.sentences.length} sentences, ${u.readings.length} reading texts, confidence ${u.confidence}`);
    if (words.length < 3) err("fewer than 3 words — the app can't make lessons for this unit");
    for (const v of words) if (!v.emoji?.trim()) warn(`“${v.word}” has no emoji`);
    if (u.confidence < 0.6) warn(`low confidence${u.notes ? `: ${u.notes}` : ""}`);
    const byType = Object.fromEntries(CLAUDE_TYPES.map((t) => [t, u.items.filter((i) => i.type === t).length]));
    console.log(`   written lessons: ${CLAUDE_TYPES.map((t) => `${t} ${byType[t]}`).join(", ")}`);
    for (const t of CLAUDE_TYPES) {
      if (byType[t]) continue;
      if (t === "reading" && !texts.length) continue; // nothing to read in this unit
      warn(`no ${t} lesson — the app will make a simpler one offline${t === "grammar" && !slot.length ? " (or none: the unit has no pattern with ___)" : ""}`);
    }
    if (u.items.some((i) => i.type === "reading") && !texts.length) warn("a reading lesson, but the unit has no reading text (or 2+ sentences) — it will be dropped");
    const unit = { order: u.order, extract: u };
    const allowedWords = [...words.map((v) => v.word), ...seenWords];
    const dropped = [];
    const kept = enforceRules(u.items, { unit, allowedWords, rules: DEFAULT_RULES, log: (m) => dropped.push(m) });
    for (const m of dropped) err(`${m.replace(/^Unit \d+: /, "")} (rule check)`);
    const emojiOf = new Map(words.map((v) => [picKey(v.word), v.emoji]));
    for (const it of u.items) {
      for (const we of wordEmojis(it.data)) {
        const want = emojiOf.get(picKey(we.word));
        if (want && we.emoji !== want) warn(`“${it.title}”: “${we.word}” uses ${we.emoji} — the unit word has ${want} (use the same emoji so the book picture shows)`);
      }
      for (const s of sentencesOf(it)) if (wordsIn(s) > p.maxSentenceWords + 2) warn(`“${it.title}”: “${s}” has ${wordsIn(s)} words (level max ${p.maxSentenceWords})`);
      if (verbose) console.log(`     · ${it.type}: ${it.title}`);
    }
    if (verbose) console.log(`     + made by the app: ${LOCAL_TYPES.join(", ")}${CLAUDE_TYPES.filter((t) => !kept.some((i) => i.type === t)).length ? `, ${CLAUDE_TYPES.filter((t) => !kept.some((i) => i.type === t)).join(", ")} (offline)` : ""}`);
    seenWords.push(...words.map((v) => v.word));
  }
  console.log(`\n${errors ? "❌" : "✅"} ${errors} error(s), ${warnings} warning(s) — ${units.length} units, ${units.reduce((s, u) => s + u.items.length, 0)} written lessons.`);
  return errors === 0;
}

/**
 * Builds a package from a work folder (resources/.work/<bookId>/):
 *   book.json        { "book": { id, title, series, bookType, grade, pageCount, fileName }, "notes"?: "…" }
 *   units/u01.json   one unit: order, title, topic, pages, vocabulary, patterns, sentences, readings, …
 *   lessons/u01.json { "items": [ … ] } — the lessons written for that unit (optional)
 * The version goes up by one when the output file exists and its content changed.
 */
function assemble(dir, out) {
  const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
  const bookFile = path.join(dir, "book.json");
  if (!fs.existsSync(bookFile)) throw new Error(`${bookFile} is missing`);
  const head = read(bookFile);
  const unitDir = path.join(dir, "units");
  const lessonDir = path.join(dir, "lessons");
  const units = (fs.existsSync(unitDir) ? fs.readdirSync(unitDir).filter((f) => f.endsWith(".json")).sort() : []).map((f) => {
    const u = read(path.join(unitDir, f));
    const lf = path.join(lessonDir, f);
    const lessons = fs.existsSync(lf) ? read(lf) : [];
    return { ...u, items: Array.isArray(lessons) ? lessons : (lessons.items ?? []) };
  });
  units.sort((a, b) => a.order - b.order);
  const target = out ?? path.join(BOOKS, `${head.book.id}.json`);
  const body = { format: PACKAGE_FORMAT, version: 1, book: head.book, units, ...(head.notes ? { notes: head.notes } : {}) };
  if (fs.existsSync(target)) {
    const prev = read(target);
    const same = JSON.stringify({ ...prev, version: 1, generatedAt: undefined, generatedBy: undefined }) === JSON.stringify({ ...body, generatedAt: undefined, generatedBy: undefined });
    body.version = same ? prev.version : (prev.version ?? 0) + 1;
  }
  const pkg = { ...body, generatedBy: "Claude (Import_Book.md)", generatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(pkg, null, 1) + "\n");
  console.log(`wrote ${path.relative(ROOT, target)} (version ${pkg.version}, ${units.length} units)\n`);
  return target;
}

function rebuildIndex() {
  fs.mkdirSync(BOOKS, { recursive: true });
  const books = [];
  for (const f of fs.readdirSync(BOOKS).filter((f) => f.endsWith(".json") && f !== "index.json").sort()) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(BOOKS, f), "utf8"));
      if (pkg.format !== PACKAGE_FORMAT) continue;
      books.push({ id: pkg.book.id, title: pkg.book.title, file: `content/books/${f}`, version: pkg.version, units: pkg.units.length, generatedAt: pkg.generatedAt ?? null });
    } catch (e) {
      console.log(`⚠️  skipped ${f}: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(BOOKS, "index.json"), JSON.stringify({ format: "emma-book-index", books }, null, 2) + "\n");
  console.log(`content/books/index.json: ${books.length} book(s)${books.length ? " — " + books.map((b) => `${b.id} v${b.version}`).join(", ") : ""}`);
}

if (cmd === "id" && args[0]) {
  const file = args[0];
  const hash = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const name = path.basename(file);
  console.log(JSON.stringify({ id: `${slugify(name)}-${hash.slice(0, 8)}`, fileName: name, pageCount: await pdfPages(file), sha256: hash }, null, 2));
} else if (cmd === "check" && args.length) {
  const verbose = args.includes("-v");
  const ok = args.filter((x) => x !== "-v").map((f) => check(f, verbose)).every(Boolean);
  process.exit(ok ? 0 : 1);
} else if (cmd === "index") {
  rebuildIndex();
} else if (cmd === "assemble" && args[0]) {
  const o = args.indexOf("--out");
  const target = assemble(path.resolve(args[0]), o >= 0 && args[o + 1] ? path.resolve(args[o + 1]) : undefined);
  const ok = check(target, args.includes("-v"));
  if (path.resolve(path.dirname(target)) === path.resolve(BOOKS)) rebuildIndex();
  process.exit(ok ? 0 : 1);
} else {
  console.log(`Usage:
  node tools/book-package.mjs id <book.pdf>
  node tools/book-package.mjs assemble <workDir> [--out <file>] [-v]
  node tools/book-package.mjs check <package.json> [-v]
  node tools/book-package.mjs index`);
  process.exit(cmd ? 1 : 0);
}
