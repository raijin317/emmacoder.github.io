import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
export class ApiError extends Error {
    details;
    constructor(message, details) {
        super(message);
        this.details = details;
    }
}
export async function api(url, opts = {}) {
    const res = await fetch(url, {
        method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
        headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
        throw new ApiError(data.error ?? `Request failed (${res.status})`, data.details);
    return data;
}
/** Last answer per URL (this tab only), so screens open instantly with it while fresh data loads. */
const lastData = new Map();
export function useApi(url) {
    const [tick, setTick] = useState(0);
    const key = url ? `${url}#${tick}` : null;
    const [state, setState] = useState(() => ({ key: null, data: url ? (lastData.get(url) ?? null) : null, error: null }));
    const reload = useCallback(() => setTick((t) => t + 1), []);
    const setData = useCallback((data) => {
        if (url)
            lastData.set(url, data);
        setState((s) => ({ ...s, data }));
    }, [url]);
    useEffect(() => {
        if (!url || !key)
            return;
        let alive = true;
        api(url)
            .then((data) => {
            lastData.set(url, data);
            if (alive)
                setState({ key, data, error: null });
        })
            .catch((e) => alive && setState((s) => ({ key, data: s.data, error: e.message })));
        return () => {
            alive = false;
        };
    }, [url, key]);
    // Keeps showing the previous data while reloading.
    return { data: state.data, error: state.error, loading: key !== null && state.key !== key, reload, setData };
}
/** POST and read a text/event-stream response. */
export async function streamSSE(url, body, onEvent, signal) {
    const form = typeof FormData !== "undefined" && body instanceof FormData;
    const res = await fetch(url, { method: "POST", headers: form ? undefined : { "Content-Type": "application/json" }, body: form ? body : JSON.stringify(body), signal });
    if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        throw new ApiError(d.error ?? `Request failed (${res.status})`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
        const { value, done } = await reader.read();
        if (done)
            break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            let event = "message";
            let data = "";
            for (const line of chunk.split("\n")) {
                if (line.startsWith("event:"))
                    event = line.slice(6).trim();
                else if (line.startsWith("data:"))
                    data += line.slice(5).trim();
            }
            try {
                onEvent(event, data ? JSON.parse(data) : null);
            }
            catch {
                onEvent(event, data);
            }
        }
    }
}
/* -------------------- per-device conveniences (localStorage) -------------------- */
const safeGet = (k) => {
    try {
        return window.localStorage.getItem(k);
    }
    catch {
        return null;
    }
};
const safeSet = (k, v) => {
    try {
        if (v === null)
            window.localStorage.removeItem(k);
        else
            window.localStorage.setItem(k, v);
    }
    catch {
        /* ignore */
    }
};
const SESSION_EVENT = "sunny-session";
const notify = () => window.dispatchEvent(new Event(SESSION_EVENT));
function subscribeSession(cb) {
    window.addEventListener("storage", cb);
    window.addEventListener(SESSION_EVENT, cb);
    return () => {
        window.removeEventListener("storage", cb);
        window.removeEventListener(SESSION_EVENT, cb);
    };
}
export const childSession = {
    get: () => safeGet("sunny.childId"),
    set: (id) => {
        safeSet("sunny.childId", id);
        notify();
    },
};
/** Current child id; `undefined` while rendering on the server. */
export function useChildId() {
    return useSyncExternalStore(subscribeSession, childSession.get, () => undefined);
}
export const parentSession = {
    isUnlocked: () => {
        try {
            return window.sessionStorage.getItem("sunny.parent") === "1";
        }
        catch {
            return false;
        }
    },
    unlock: () => {
        try {
            window.sessionStorage.setItem("sunny.parent", "1");
        }
        catch { }
        notify();
    },
    lock: () => {
        try {
            window.sessionStorage.removeItem("sunny.parent");
        }
        catch { }
        notify();
    },
};
/** Parent unlock state; `null` while rendering on the server. */
export function useParentUnlocked() {
    return useSyncExternalStore(subscribeSession, parentSession.isUnlocked, () => null);
}
