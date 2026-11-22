/**
 * Hash router — the static site lives on GitHub Pages, so every app path sits after "#":
 *   https://emmacoder.github.io/#/learn/unit/abc?back=/learn
 * Same API as the Next.js hooks the screens use (useRouter, usePathname, useSearchParams).
 */
import { useSyncExternalStore } from "react";

/** "#/learn/x?y=1" → { path: "/learn/x", query: "y=1" } */
export function parseHash(hash = window.location.hash) {
  let h = hash.replace(/^#/, "");
  // A second "#" (an anchor inside the page) is not part of the route.
  const anchor = h.indexOf("#");
  if (anchor >= 0) h = h.slice(0, anchor);
  if (!h.startsWith("/")) h = "/" + h;
  const q = h.indexOf("?");
  const path = (q >= 0 ? h.slice(0, q) : h).replace(/\/+$/, "") || "/";
  return { path, query: q >= 0 ? h.slice(q + 1) : "" };
}

/** App path → link that works on the static site ("/learn" → "#/learn"). */
export function hrefFor(path) {
  if (typeof path !== "string") return path;
  if (/^(https?:|mailto:|blob:|data:|#)/.test(path)) return path;
  return "#" + (path.startsWith("/") ? path : "/" + path);
}

export function navigate(path, { replace = false } = {}) {
  const url = hrefFor(path);
  if (replace) window.location.replace(url);
  else window.location.hash = url.slice(1);
  window.scrollTo(0, 0);
}

function subscribe(cb) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const getHash = () => window.location.hash;

/** The current route; re-renders on every hash change. */
export function useRoute() {
  const hash = useSyncExternalStore(subscribe, getHash, getHash);
  return parseHash(hash);
}

export function usePathname() {
  return useRoute().path;
}

export function useSearchParams() {
  return new URLSearchParams(useRoute().query);
}

const router = {
  push: (p) => navigate(p),
  replace: (p) => navigate(p, { replace: true }),
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  refresh: () => window.dispatchEvent(new HashChangeEvent("hashchange")),
  prefetch: () => {},
};

export function useRouter() {
  return router;
}
