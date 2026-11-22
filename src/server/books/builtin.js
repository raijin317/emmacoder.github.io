/**
 * Built-in books: book packages published with the site (content/books/index.json lists them).
 * When the site opens, every package that is new — or has a newer version than the one in this
 * browser — is imported. A built-in book the parent removed is not brought back by itself.
 */
import { importBookPackage, importedVersion, packageRemoved } from "./package.js";

const INDEX = "content/books/index.json";

export async function loadBuiltInBooks() {
  let index;
  try {
    const res = await fetch(new URL(INDEX, document.baseURI), { cache: "no-cache" });
    if (!res.ok) return [];
    index = await res.json();
  } catch {
    return [];
  }
  const done = [];
  for (const entry of Array.isArray(index?.books) ? index.books : []) {
    if (!entry?.id || !entry.file || !(Number(entry.version) > importedVersion(entry.id)) || packageRemoved(entry.id)) continue;
    try {
      const res = await fetch(new URL(entry.file, document.baseURI), { cache: "no-cache" });
      if (!res.ok) throw new Error(`${entry.file}: ${res.status}`);
      done.push(importBookPackage(await res.json()));
    } catch (e) {
      console.error(`[books] could not add the built-in book ${entry.id}:`, e?.message, e?.details ?? "");
    }
  }
  return done;
}
