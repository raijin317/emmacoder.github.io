/**
 * Helpers for the in-browser "server": the screens still call fetch("/api/…") exactly like before,
 * and these handlers answer with normal Response objects (JSON, pictures or Server-Sent Events).
 */
export class JobError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

const json = (data, init = {}) => new Response(JSON.stringify(data), { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
export const ok = (data, init) => json(data, init);
export const fail = (error, status = 400, details) => json({ error, details }, { status });

export function route(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      // A JobError is a clear message for the parent (bad file, missing words…), not a bug.
      if (e instanceof JobError) console.warn("[api]", e.message);
      else console.error("[api]", e);
      return fail(e?.message || "Something went wrong.", 500, e instanceof JobError ? e.details : undefined);
    }
  };
}

export async function body(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

/** Server-Sent Events response (progress of long jobs). */
export function sse(run, req) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await run(send, req.signal);
      } catch (e) {
        send("error", { message: e?.message, details: e instanceof JobError ? e.details : undefined });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
}

/** A picture (Blob) as a response. */
export const blobResponse = (blob) => new Response(blob, { headers: { "Content-Type": blob.type || "application/octet-stream" } });
