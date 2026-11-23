#!/usr/bin/env node
// Book packages (see Import_Book.md): helpers for making and checking them with the site's own schemas and rules.
//
//   node tools/book-package.mjs id <book.pdf>              book id (as the app makes it) + page count
//   node tools/book-package.mjs pictures <workDir>         sheet: book picture | Claude's drawing for every word (rule 2 self-check)
//   node tools/book-package.mjs pictures <workDir> --big   the drawings alone, big — to judge how cute and clear they are
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

/* ---------------- rule 1: every sentence the child hears or reads comes from the book ---------------- */

const GAP = "gapslot";
const norm = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/_{2,}/g, ` ${GAP} `).replace(/[^a-z0-9'\s]/g, " ").replace(/\s+/g, " ").trim();
/** A text cut into sentences / lines, normalized. */
const pieces = (s) => s.split(/\n+|(?<=[.!?])\s+/).map(norm).filter(Boolean);
/** Short standard instructions of the app (allowed everywhere, rule 4). */
const INSTRUCTIONS = new Set(["what is it", "what is this", "which picture", "which one", "listen and tap the right picture", "listen and choose", "put the words in order", "match the pictures and the words", "find the picture"]);

/** The book's language up to a unit (this unit + earlier units). */
class BookLanguage {
  lines = [];
  patterns = [];
  words = new Set();
  vocab = new Set();
  add(u) {
    const texts = [...u.sentences, ...u.readings.map((r) => r.text), ...u.patterns.map((p) => p.text), ...u.vocabulary.map((v) => v.word)];
    for (const t of texts) for (const p of pieces(t)) {
      if (p.includes(GAP)) this.patterns.push(new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(new RegExp(GAP, "g"), "([a-z0-9' ]+?)")}$`));
      else this.lines.push(p);
      p.split(" ").forEach((w) => w !== GAP && this.words.add(w));
    }
    for (const v of u.vocabulary) for (const w of norm(v.word).split(" ")) this.vocab.add(w).add(w + "s").add(w + "es");
    this.corpus = ` ${this.lines.join(" | ")} `;
  }
  /** True when this sentence (or line) is printed in the book, a book pattern filled with book words, or a book sentence with one unit word swapped. */
  has(sentence) {
    const s = norm(sentence);
    if (!s || INSTRUCTIONS.has(s)) return true;
    if (this.corpus.includes(` ${s} `)) return true;
    for (const re of this.patterns) {
      const m = re.exec(s);
      if (m && m.slice(1).every((g) => g.trim().split(" ").every((w) => this.words.has(w)))) return true;
    }
    const t = s.split(" ");
    return this.lines.some((line) => {
      for (const part of line.split(" | ")) {
        const o = part.split(" ");
        if (o.length !== t.length) continue;
        const diff = o.map((w, i) => [w, t[i]]).filter(([a, b]) => a !== b);
        if (diff.length === 1 && this.vocab.has(diff[0][0]) && this.vocab.has(diff[0][1])) return true;
      }
      return false;
    });
  }
}

/** Everything a lesson lets the child hear or read, with where it is (for the rule 1 check). */
function childLines(item) {
  const d = item.data;
  const out = [];
  const add = (text, where) => text && out.push({ text, where });
  const q = (x, where) => {
    if (x.kind === "tf") add(x.statement, where);
    if (x.kind === "fill") add(x.sentence.replace(/_{2,}/, x.answer), where);
    if (x.kind === "order") add(x.words.join(" "), where);
    if (x.kind === "mc") add(/_{2,}/.test(x.prompt) ? x.prompt.replace(/_{2,}/, x.answer) : x.prompt, where);
    if (x.kind === "picture" && !/^find (the )?[a-z' -]+\.?$/i.test(x.prompt.trim())) add(x.prompt, where);
  };
  switch (item.type) {
    case "grammar":
      d.examples.forEach((e) => add(e.text, "example"));
      d.practice.forEach((x) => q(x, "practice"));
      break;
    case "reading":
      d.questions.forEach((x) => q(x, "question"));
      break;
    case "listening":
      d.tasks.forEach((t) => add(t.say, "listening"));
      break;
    case "speaking":
      d.prompts.forEach((p) => (add(p.text, "speaking"), add(p.question, "speaking question")));
      break;
    case "quiz":
      d.questions.forEach((x) => q(x, "quiz"));
      break;
    case "test":
      d.sections.forEach((s) => s.questions.forEach((x) => q(x, "test")));
      break;
  }
  return out;
}

/** Choices and instructions (rule 4). */
function questionsOf(item) {
  const d = item.data;
  if (item.type === "quiz") return d.questions;
  if (item.type === "test") return d.sections.flatMap((s) => s.questions);
  if (item.type === "grammar") return d.practice;
  if (item.type === "reading") return d.questions;
  return [];
}

/* ------------------------------ rule 2: the pictures Claude drew ------------------------------ */

/** File name of a word's drawing in the work folder: pictures/<picKey with dashes>.svg */
const pictureFile = (word) => `${picKey(word).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "word"}.svg`;

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
  const book = new BookLanguage();
  const drawn = new Set(Object.keys(pkg.pictures));
  const allKeys = new Set(units.flatMap((u) => u.vocabulary.map((v) => picKey(v.word))));
  const boxed = new Set(units.flatMap((u) => u.vocabulary.filter((v) => v.pic).map((v) => picKey(v.word))));
  console.log(`   Pictures (rule 2) — each word offers 3: drawn by Claude ${[...allKeys].filter((k) => drawn.has(k)).length}/${allKeys.size}, book picture box ${[...allKeys].filter((k) => boxed.has(k)).length}/${allKeys.size}, emoji ${new Set(units.flatMap((u) => u.vocabulary.filter((v) => v.emoji?.trim()).map((v) => picKey(v.word)))).size}/${allKeys.size}`);
  for (const k of drawn) if (!allKeys.has(k)) warn(`a drawing for “${k}”, which is not a word of any unit (it is never shown)`);
  const noBox = [...allKeys].filter((k) => !boxed.has(k));
  if (noBox.length && pkg.book.pageCount) warn(`rule 2: no book picture box for ${noBox.map((k) => `“${k}”`).join(", ")} in any unit — the parent can't choose the book's picture for ${noBox.length > 1 ? "them" : "it"}`);
  for (const u of units) {
    const words = u.vocabulary.filter((v) => v.word.trim());
    const slot = u.patterns.filter((x) => (x.text.match(/_{2,}/g) ?? []).length === 1);
    const texts = bookTexts(u);
    book.add(u);
    console.log(`\n▶ Unit ${u.order}: ${u.title}  (pages ${u.pages[0]}–${u.pages[1]})`);
    console.log(`   ${words.length} words (${words.filter((v) => drawn.has(picKey(v.word))).length} drawn, ${words.filter((v) => v.pic).length} with a book picture box), ${u.patterns.length} patterns (${slot.length} with one ___), ${u.sentences.length} sentences, ${u.readings.length} reading texts, confidence ${u.confidence}`);
    if (words.length < 3) err("fewer than 3 words — the app can't make lessons for this unit");
    for (const v of words) if (!v.emoji?.trim()) warn(`“${v.word}” has no emoji`);
    for (const v of words) {
      if (v.show === "drawing" && !drawn.has(picKey(v.word))) warn(`“${v.word}” is set to show the drawing, but there is no drawing of it`);
      if (v.show === "book" && !boxed.has(picKey(v.word))) warn(`“${v.word}” is set to show the book's picture, but no unit has a box for it`);
      if (v.show === "own") warn(`“${v.word}”: "show": "own" is the parent's own picture, added in the app — leave it out of a package`);
    }
    const undrawn = words.filter((v) => !drawn.has(picKey(v.word))).map((v) => v.word);
    if (undrawn.length) warn(`rule 2: no drawing for ${undrawn.map((w) => `“${w}”`).join(", ")} — draw pictures/${pictureFile(undrawn[0])}${undrawn.length > 1 ? " …" : ""}`);
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
      // Rule 1: nothing the child hears or reads is invented.
      for (const line of childLines(it))
        for (const piece of line.text.split(/\n+|(?<=[.!?])\s+/))
          if (!book.has(piece)) err(`rule 1: “${piece}” (${it.title}, ${line.where}) is not in the book — use a book sentence, or a book pattern filled with a book word`);
      // Rule 4: few choices, very short instructions, short explanations.
      const maxChoices = p.allowReadingInstructions ? 4 : 3;
      for (const x of questionsOf(it)) {
        const n = x.options?.length ?? x.pairs?.length ?? 0;
        if ((x.kind === "picture" || x.kind === "mc" || x.kind === "fill") && n > maxChoices) warn(`rule 4: “${it.title}” has a question with ${n} choices (at this level: ${maxChoices} at most)`);
        if (x.kind === "picture" && wordsIn(x.prompt) > 6) warn(`rule 4: “${it.title}”: the instruction “${x.prompt}” is long (6 words at most)`);
      }
      if (it.type === "listening") for (const t of it.data.tasks) if (t.options.length > maxChoices) warn(`rule 4: “${it.title}”: ${t.options.length} pictures to choose from (at this level: ${maxChoices} at most)`);
      if (it.type === "grammar" && (pieces(it.data.explanation).length > 2 || wordsIn(it.data.explanation) > 25)) warn(`rule 4: “${it.title}”: the explanation is long (2 short sentences at most)`);
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
  // Rule 2: the drawings in pictures/<word>.svg, one per word of the book.
  const pictures = {};
  for (const u of units)
    for (const v of u.vocabulary) {
      const f = path.join(dir, "pictures", pictureFile(v.word));
      if (fs.existsSync(f)) pictures[picKey(v.word)] ??= fs.readFileSync(f, "utf8").trim();
    }
  const target = out ?? path.join(BOOKS, `${head.book.id}.json`);
  const body = { format: PACKAGE_FORMAT, version: 1, book: head.book, units, pictures, ...(head.notes ? { notes: head.notes } : {}) };
  if (fs.existsSync(target)) {
    const prev = read(target);
    const same = JSON.stringify({ ...prev, version: 1, generatedAt: undefined, generatedBy: undefined }) === JSON.stringify({ ...body, generatedAt: undefined, generatedBy: undefined });
    body.version = same ? prev.version : (prev.version ?? 0) + 1;
  }
  const pkg = { ...body, generatedBy: "Claude (Import_Book.md)", generatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(pkg, null, 1) + "\n");
  console.log(`wrote ${path.relative(ROOT, target)} (version ${pkg.version}, ${units.length} units, ${Object.keys(pictures).length} drawings)\n`);
  return target;
}

/**
 * Rule 2 self-check: one sheet with, for every word of the book, the book's own picture (cut from the page
 * images, when the unit has a box) next to Claude's drawing — to look at and redraw the weak ones.
 * Writes <workDir>/pictures-sheet.png (and -2, -3 … when there are many words).
 */
async function pictureSheet(dir) {
  const { createRequire } = await import("node:module");
  const require = createRequire(path.join(ROOT, "package.json"));
  let canvasMod;
  try {
    canvasMod = require("@napi-rs/canvas");
  } catch {
    console.log("❌ run `npm install` first (@napi-rs/canvas)");
    process.exit(1);
  }
  const { createCanvas, loadImage } = canvasMod;
  const { svgProblems, normalizeSvg } = await import("../src/lib/safeSvg.js");
  const words = new Map();
  for (const f of fs.readdirSync(path.join(dir, "units")).filter((f) => f.endsWith(".json")).sort()) {
    const u = JSON.parse(fs.readFileSync(path.join(dir, "units", f), "utf8"));
    for (const v of u.vocabulary) if (!words.has(picKey(v.word)) || (!words.get(picKey(v.word)).pic && v.pic)) words.set(picKey(v.word), { ...v, unit: u.order });
  }
  const list = [...words.values()];
  const C = 160, L = 22, perRow = 4, perSheet = 32;
  const pageCache = new Map();
  const missing = [];
  const unsafe = [];
  for (let s = 0; s * perSheet < list.length; s++) {
    const chunk = list.slice(s * perSheet, (s + 1) * perSheet);
    const rows = Math.ceil(chunk.length / perRow);
    const sheet = createCanvas(perRow * (2 * C + 12), rows * (C + L + 8));
    const g = sheet.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, sheet.width, sheet.height);
    for (const [i, v] of chunk.entries()) {
      const x0 = (i % perRow) * (2 * C + 12);
      const y0 = Math.floor(i / perRow) * (C + L + 8);
      const fit = (img, sx, sy, sw, sh, x) => {
        const k = Math.min((C - 8) / sw, (C - 8) / sh);
        g.drawImage(img, sx, sy, sw, sh, x + (C - sw * k) / 2, y0 + (C - sh * k) / 2, sw * k, sh * k);
      };
      g.strokeStyle = "#ddd";
      g.strokeRect(x0 + 1, y0 + 1, C - 2, C - 2);
      g.strokeRect(x0 + C + 1, y0 + 1, C - 2, C - 2);
      if (v.pic) {
        const file = path.join(dir, "pages", `p-${String(v.pic.page).padStart(3, "0")}.png`);
        if (fs.existsSync(file)) {
          if (!pageCache.has(file)) pageCache.set(file, await loadImage(fs.readFileSync(file)));
          const img = pageCache.get(file);
          const [bx, by, bw, bh] = v.pic.box;
          fit(img, bx * img.width, by * img.height, bw * img.width, bh * img.height, x0);
        }
      } else {
        g.fillStyle = "#999";
        g.font = "14px sans-serif";
        g.fillText("(no book box)", x0 + 30, y0 + C / 2);
      }
      const svgFile = path.join(dir, "pictures", pictureFile(v.word));
      if (fs.existsSync(svgFile)) {
        const svg = fs.readFileSync(svgFile, "utf8");
        const problems = svgProblems(svg);
        if (problems.length) unsafe.push(`${v.word}: ${problems.join("; ")}`);
        try {
          const img = await loadImage(Buffer.from(normalizeSvg(svg)));
          fit(img, 0, 0, img.width, img.height, x0 + C);
        } catch (e) {
          unsafe.push(`${v.word}: cannot be drawn (${e.message})`);
        }
      } else missing.push(v.word);
      g.fillStyle = "#222";
      g.font = "15px sans-serif";
      g.fillText(`${v.unit}: ${v.word}   book | drawing${v.show ? `  (shows: ${v.show})` : ""}`, x0 + 4, y0 + C + 16);
    }
    const out = path.join(dir, `pictures-sheet${s ? `-${s + 1}` : ""}.png`);
    fs.writeFileSync(out, await sheet.encode("png"));
    console.log(`wrote ${path.relative(ROOT, out)}`);
  }
  console.log(`${list.length} words, ${list.length - missing.length} drawn.`);
  if (missing.length) console.log(`⚠️  not drawn yet: ${missing.join(", ")}`);
  for (const u of unsafe) console.log(`❌ ${u}`);
  return !unsafe.length;
}

/**
 * Quality look: only the drawings, big (240 px), 20 per sheet → <workDir>/pictures-big-1.png, -2 …
 * To judge them as the child sees them: cute, clear, finished (see Import_Book.md step 4).
 */
async function bigSheet(dir) {
  const { createRequire } = await import("node:module");
  const { createCanvas, loadImage } = createRequire(path.join(ROOT, "package.json"))("@napi-rs/canvas");
  const { normalizeSvg } = await import("../src/lib/safeSvg.js");
  const files = fs.readdirSync(path.join(dir, "pictures")).filter((f) => f.endsWith(".svg")).sort();
  const T = 240, cols = 5, per = 20;
  for (let s = 0; s * per < files.length; s++) {
    const chunk = files.slice(s * per, (s + 1) * per);
    const c = createCanvas(cols * T, Math.ceil(chunk.length / cols) * (T + 22));
    const g = c.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, c.width, c.height);
    for (const [i, f] of chunk.entries()) {
      const x = (i % cols) * T, y = Math.floor(i / cols) * (T + 22);
      const src = fs.readFileSync(path.join(dir, "pictures", f), "utf8");
      try {
        g.drawImage(await loadImage(Buffer.from(normalizeSvg(src))), x + 5, y + 5, T - 10, T - 10);
      } catch (e) {
        console.log(`❌ ${f}: cannot be drawn (${e.message})`);
      }
      g.strokeStyle = "#eee";
      g.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      g.fillStyle = "#222";
      g.font = "16px sans-serif";
      g.fillText(`${f.replace(/\.svg$/, "")} (${(src.length / 1024).toFixed(1)} KB)`, x + 6, y + T + 16);
    }
    const out = path.join(dir, `pictures-big-${s + 1}.png`);
    fs.writeFileSync(out, await c.encode("png"));
    console.log(`wrote ${path.relative(ROOT, out)}`);
  }
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
} else if (cmd === "pictures" && args[0]) {
  const dir = path.resolve(args.find((a) => a !== "--big"));
  if (args.includes("--big")) await bigSheet(dir);
  else process.exit((await pictureSheet(dir)) ? 0 : 1);
} else if (cmd === "assemble" && args[0]) {
  const o = args.indexOf("--out");
  const target = assemble(path.resolve(args[0]), o >= 0 && args[o + 1] ? path.resolve(args[o + 1]) : undefined);
  const ok = check(target, args.includes("-v"));
  if (path.resolve(path.dirname(target)) === path.resolve(BOOKS)) rebuildIndex();
  process.exit(ok ? 0 : 1);
} else {
  console.log(`Usage:
  node tools/book-package.mjs id <book.pdf>
  node tools/book-package.mjs pictures <workDir> [--big]
  node tools/book-package.mjs assemble <workDir> [--out <file>] [-v]
  node tools/book-package.mjs check <package.json> [-v]
  node tools/book-package.mjs index`);
  process.exit(cmd ? 1 : 0);
}
