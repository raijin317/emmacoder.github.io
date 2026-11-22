#!/usr/bin/env node
// Renders every page of a textbook PDF to PNG, so Claude can look at the pages (Import_Book.md, step 1):
//   npm run book:pages -- resources/book/<file>.pdf [outDir]
// Default output: resources/.work/<bookId>/pages/p-001.png … — the same size as the site draws the pages
// (≈1600 px on the long side), so picture boxes measured on these images match the app.
// Needs the dev dependencies: npm install
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [pdfArg, outArg] = process.argv.slice(2);
if (!pdfArg) {
  console.log("Usage: npm run book:pages -- <book.pdf> [outDir]");
  process.exit(1);
}

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

let pdfjs, canvasMod;
try {
  pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  canvasMod = await import("@napi-rs/canvas");
} catch {
  console.log("❌ Missing tools: run `npm install` in the project folder first (pdfjs-dist and @napi-rs/canvas).");
  process.exit(1);
}

const file = path.resolve(pdfArg);
const bytes = fs.readFileSync(file);
const hash = crypto.createHash("sha256").update(bytes).digest("hex");
const bookId = `${slugify(path.basename(file))}-${hash.slice(0, 8)}`;
const outDir = path.resolve(outArg ?? path.join(ROOT, "resources", ".work", bookId, "pages"));
fs.mkdirSync(outDir, { recursive: true });

const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, verbosity: 0 });
const doc = await task.promise;
const total = doc.numPages;
const t0 = Date.now();
for (let i = 1; i <= total; i++) {
  const out = path.join(outDir, `p-${String(i).padStart(3, "0")}.png`);
  if (fs.existsSync(out)) continue;
  const page = await doc.getPage(i);
  const base = page.getViewport({ scale: 1 });
  const fit = Math.min(1.6, 1600 / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale: fit });
  const canvas = canvasMod.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  fs.writeFileSync(out, await canvas.encode("png"));
  page.cleanup();
  if (i === total || i % 10 === 0) console.log(`page ${i}/${total}`);
}
await task.destroy();
console.log(JSON.stringify({ bookId, pageCount: total, pages: path.relative(ROOT, outDir), seconds: Math.round((Date.now() - t0) / 1000) }, null, 2));
