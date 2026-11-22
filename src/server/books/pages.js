/**
 * Book pages, rendered in the browser from the family's PDF (pdf.js) and kept in IndexedDB on this device:
 *   books/<bookId>/pages/p-001.jpg   (≈1600 px on the long side — the page viewer and picture picker)
 *   books/<bookId>/thumbs/p-001.jpg  (small — page strips and covers)
 *   books/<bookId>/crops/<key>.webp  (a word's picture cut from a page)
 * Nothing is uploaded anywhere.
 */
import { hasFile, listFiles, readFile, removeFiles, writeFile } from "../vfs.js";
import { sha256Hex } from "../sha256.js";

const ready = new Set();

/** Remembers which books have their pages in this browser (called once at start). */
export async function loadPageIndex() {
  try {
    for (const k of await listFiles("books/")) {
      const m = /^books\/([^/]+)\/pages\/p-001\.jpg$/.exec(String(k));
      if (m) ready.add(m[1]);
    }
  } catch {
    /* no storage */
  }
}

export const hasPages = (bookId) => ready.has(bookId);

const num = (n) => String(n).padStart(3, "0");
export const pagePath = (bookId, n, thumb = false) => `books/${bookId}/${thumb ? "thumbs" : "pages"}/p-${num(n)}.jpg`;

export function slugify(name) {
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

/** Grade hint from names like "G3_...", "Grade 3", "lop 3", "PreK". */
export function gradeHintFromName(fileName) {
  const n = slugify(fileName);
  if (/(^|-)(pre-?k|preschool|kindergarten|mau-giao|kg)(-|$)/.test(n)) return 0;
  const m = n.match(/(?:^|-)(?:g|grade|lop|class|tieng-anh|english)-?([1-5])(?:-|$)/);
  return m ? Number(m[1]) : null;
}

/** SHA-256 of the file (same book id as the desktop app: slug of the name + first 8 hex of the hash). */
export async function fileHash(file) {
  const buf = await file.arrayBuffer();
  if (globalThis.crypto?.subtle) {
    const d = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Without WebCrypto (http on a LAN): hash a sample — only used as an id.
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += Math.max(1, Math.floor(bytes.length / 200000))) s += String.fromCharCode(bytes[i]);
  return sha256Hex(s + bytes.length);
}

export const bookIdFor = (fileName, hash) => `${slugify(fileName)}-${hash.slice(0, 8)}`;

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not save the picture."))), type, quality));
}

let pdfjsLoading = null;
async function pdfjs() {
  pdfjsLoading ??= import("pdfjs").then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL("vendor/pdf.worker.min.js", document.baseURI).href;
    return m;
  });
  return pdfjsLoading;
}

/** How many pages a PDF has (quick check before rendering). */
export async function pdfPageCount(file) {
  const lib = await pdfjs();
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 0 });
  const doc = await task.promise;
  const n = doc.numPages;
  await task.destroy();
  return n;
}

/** Renders every page of the PDF into this browser's storage (pages already there are skipped). */
export async function renderPdfPages(file, bookId, opts = {}) {
  const lib = await pdfjs();
  const task = lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 0 });
  const doc = await task.promise;
  const total = doc.numPages;
  try {
    for (let i = 1; i <= total; i++) {
      if (opts.signal?.aborted) throw new Error("Stopped.");
      if ((await hasFile(pagePath(bookId, i))) && (await hasFile(pagePath(bookId, i, true)))) {
        opts.onPage?.(i, total);
        continue;
      }
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const fit = Math.min(1.6, 1600 / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale: fit });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      await writeFile(pagePath(bookId, i), await toBlob(canvas, "image/jpeg", 0.86));
      const t = document.createElement("canvas");
      t.width = Math.max(1, Math.round(canvas.width * (0.32 / fit)));
      t.height = Math.max(1, Math.round(canvas.height * (0.32 / fit)));
      t.getContext("2d").drawImage(canvas, 0, 0, t.width, t.height);
      await writeFile(pagePath(bookId, i, true), await toBlob(t, "image/jpeg", 0.8));
      page.cleanup();
      if (i === 1) ready.add(bookId);
      opts.onPage?.(i, total);
    }
  } finally {
    await task.destroy();
  }
  ready.add(bookId);
  return total;
}

export async function pageBlob(bookId, n, thumb = false) {
  return readFile(pagePath(bookId, n, thumb));
}

/** A picture cut out of a page: box = [left, top, width, height] as 0–1; cached as WebP. */
export async function cropBlob(bookId, page, box, size = 400) {
  const key = sha256Hex(`${page}|${box.map((n) => n.toFixed(4)).join(",")}|${size}`).slice(0, 16);
  const out = `books/${bookId}/crops/${key}.webp`;
  const cached = await readFile(out);
  if (cached) return cached;
  const src = await pageBlob(bookId, page);
  if (!src) return null;
  const img = await createImageBitmap(src);
  const [x, y, w, h] = box;
  const sx = Math.round(x * img.width);
  const sy = Math.round(y * img.height);
  const sw = Math.max(1, Math.min(img.width - sx, Math.round(w * img.width)));
  const sh = Math.max(1, Math.min(img.height - sy, Math.round(h * img.height)));
  // Never upscale: the browser does that better than a stored bigger file.
  const scale = Math.min(1, size / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const c2d = canvas.getContext("2d");
  c2d.fillStyle = "#ffffff";
  c2d.fillRect(0, 0, canvas.width, canvas.height);
  c2d.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  img.close?.();
  let blob = await toBlob(canvas, "image/webp", 0.88);
  if (blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.88);
  await writeFile(out, blob);
  return blob;
}

export async function removePages(bookId) {
  ready.delete(bookId);
  await removeFiles(`books/${bookId}/`);
}
