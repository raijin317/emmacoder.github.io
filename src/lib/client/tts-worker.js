/**
 * The natural voice (Kokoro-82M, American English) running in its own thread, so the page never freezes.
 * Messages in:  {type:"load"} · {type:"gen", id, parts:[{say, pause}], voice, speed}
 * Messages out: {type:"progress", loaded, total, file} · {type:"ready"} · {type:"fatal", error} · {type:"clip", id, wav | error}
 * The model (~90 MB) is downloaded once from Hugging Face and kept in the browser's cache.
 */
import { KokoroTTS } from "../../../vendor/kokoro.web.js";

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
let loading = null;
const files = new Map();

function load() {
  loading ??= KokoroTTS.from_pretrained(MODEL, {
    dtype: "q8",
    device: "wasm",
    progress_callback: (p) => {
      if (p?.file && typeof p.total === "number") {
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        postMessage({ type: "progress", loaded, total, file: p.file });
      }
    },
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

/** Cuts the quiet start and end of a clip, keeping a little air so no sound is clipped. */
function trimSilence(x, rate, threshold = 0.004) {
  let a = 0;
  while (a < x.length && Math.abs(x[a]) < threshold) a++;
  let b = x.length - 1;
  while (b > a && Math.abs(x[b]) < threshold) b--;
  if (a >= b) return x;
  return x.subarray(Math.max(0, a - Math.round(rate * 0.03)), Math.min(x.length, b + 1 + Math.round(rate * 0.08)));
}

/** clip₁ + pause₁ + clip₂ + … (pauses in ms at speed 1; a slower voice pauses longer). */
function stitch(clips, pausesMs, speed, rate) {
  const parts = clips.map((c) => trimSilence(c, rate));
  const gaps = parts.map((_, k) => (k < parts.length - 1 ? Math.round(((pausesMs[k] ?? 0) / 1000 / speed) * rate) : 0));
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0) + gaps.reduce((s, g) => s + g, 0));
  let o = 0;
  parts.forEach((p, k) => {
    out.set(p, o);
    o += p.length + gaps[k];
  });
  return out;
}

/** 16-bit PCM mono WAV. */
function wav(samples, rate) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === "load") {
    try {
      await load();
      postMessage({ type: "ready" });
    } catch (err) {
      postMessage({ type: "fatal", error: String(err?.message ?? err) });
    }
    return;
  }
  if (m.type === "gen") {
    try {
      const tts = await load();
      const clips = [];
      let rate = 24000;
      for (const p of m.parts) {
        const a = await tts.generate(p.say, { voice: m.voice, speed: m.speed });
        rate = a.sampling_rate;
        clips.push(a.audio);
      }
      const out = wav(clips.length === 1 ? clips[0] : stitch(clips, m.parts.map((p) => p.pause), m.speed, rate), rate);
      postMessage({ type: "clip", id: m.id, wav: out }, [out]);
    } catch (err) {
      postMessage({ type: "clip", id: m.id, error: String(err?.message ?? err) });
    }
  }
};
