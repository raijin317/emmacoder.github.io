import { useEffect, useState } from "react";
import { html } from "@/lib/html.js";

/**
 * <img> for pictures the in-browser API serves (book pages, pictures cut from the book):
 * the browser can't load "/api/…" by itself on a static site, so the picture is fetched through
 * the app's API and shown from a blob: URL (kept for the rest of the visit).
 * `fallback` is shown when the picture is not on this device (e.g. the PDF is not added here).
 */
const ready = new Map();
const loading = new Map();
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export function loadApiImage(src) {
  if (ready.has(src)) return Promise.resolve(ready.get(src));
  if (!loading.has(src)) {
    loading.set(
      src,
      fetch(src)
        .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null))
        .catch(() => null)
        .then((url) => {
          ready.set(src, url);
          loading.delete(src);
          return url;
        }),
    );
  }
  return loading.get(src);
}

const isApi = (src) => typeof src === "string" && src.startsWith("/api/");

export function ApiImg({ src, fallback, ...rest }) {
  const [state, setState] = useState(() => ({ src, url: isApi(src) ? ready.get(src) : src }));
  const current = state.src === src ? state : { src, url: isApi(src) ? ready.get(src) : src };
  useEffect(() => {
    if (!isApi(src) || ready.has(src)) return;
    let alive = true;
    loadApiImage(src).then((url) => {
      if (alive) setState({ src, url });
    });
    return () => {
      alive = false;
    };
  }, [src]);
  if (current.url === null) return fallback !== undefined ? fallback : html`<img src=${BLANK} ...${rest} />`;
  return html`<img src=${current.url ?? BLANK} ...${rest} />`;
}
