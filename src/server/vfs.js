/**
 * Local storage for the "server" that runs inside the browser (IndexedDB, this device only):
 * - kv:    small values (the SQLite database bytes, voice cache index…)
 * - files: Blobs by path ("books/<bookId>/pages/p-001.jpg", "books/<bookId>/crops/<key>.webp")
 * Nothing here is ever uploaded — it stays in this browser on this device.
 */
const DB_NAME = "emma-english-studio";
const VERSION = 1;
let opening = null;

function open() {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
      if (!d.objectStoreNames.contains("files")) d.createObjectStore("files");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("This browser cannot store data (IndexedDB is off — private window?)."));
    req.onblocked = () => reject(new Error("Please close the other tabs of Emma English Studio and reload."));
  });
  return opening;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = "readonly") {
  const d = await open();
  return d.transaction(name, mode).objectStore(name);
}

export async function kvGet(key) {
  return wrap((await store("kv")).get(key));
}
export async function kvSet(key, value) {
  return wrap((await store("kv", "readwrite")).put(value, key));
}

export async function readFile(path) {
  return (await wrap((await store("files")).get(path))) ?? null;
}
export async function writeFile(path, blob) {
  return wrap((await store("files", "readwrite")).put(blob, path));
}
export async function hasFile(path) {
  return (await wrap((await store("files")).getKey(path))) !== undefined;
}
/** Deletes every file whose path starts with `prefix`. */
export async function removeFiles(prefix) {
  const s = await store("files", "readwrite");
  return wrap(s.delete(IDBKeyRange.bound(prefix, prefix + "￿")));
}
export async function listFiles(prefix) {
  const s = await store("files");
  return wrap(s.getAllKeys(IDBKeyRange.bound(prefix, prefix + "￿")));
}

/** Asks the browser to keep this site's data (not cleared when space runs low). */
export async function persistStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}

export async function storageEstimate() {
  try {
    return (await navigator.storage?.estimate?.()) ?? null;
  } catch {
    return null;
  }
}
