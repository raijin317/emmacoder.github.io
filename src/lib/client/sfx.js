/** Tiny synthesized sound effects (no audio files). */
let ctx = null;
let enabled = true;
let noiseBuf = null;
export function setSoundOn(on) {
    enabled = on;
}
function tone(freq, start, dur, type = "sine", gain = 0.18) {
    if (!ctx)
        return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + dur + 0.02);
}
/** A tone that slides from f0 to f1 (boing, vroom, whoosh). */
function sweep(f0, f1, start, dur, type = "sine", gain = 0.15) {
    if (!ctx)
        return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime + start;
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
}
/** Filtered noise (splash, chomp, rocket). */
function noise(start, dur, gain, freq, type = "lowpass") {
    if (!ctx)
        return;
    if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const ch = noiseBuf.getChannelData(0);
        for (let i = 0; i < ch.length; i++)
            ch[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const t = ctx.currentTime + start;
    src.buffer = noiseBuf;
    src.loop = true;
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
}
export function sfx(kind) {
    if (!enabled || typeof window === "undefined")
        return;
    try {
        ctx ??= new AudioContext();
        if (kind === "correct")
            [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.18, "triangle"));
        if (kind === "wrong")
            tone(220, 0, 0.25, "sine", 0.12);
        if (kind === "tap")
            tone(880, 0, 0.06, "square", 0.05);
        if (kind === "pop") {
            tone(1200, 0, 0.08, "triangle", 0.15);
            noise(0, 0.09, 0.18, 3000, "highpass");
        }
        if (kind === "win")
            [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.2, "triangle"));
        if (kind === "splash") {
            noise(0, 0.45, 0.22, 1400);
            sweep(700, 180, 0, 0.25, "sine", 0.08);
        }
        if (kind === "chomp")
            [0, 0.17, 0.34].forEach((t) => noise(t, 0.09, 0.3, 700, "bandpass"));
        if (kind === "boing")
            sweep(200, 720, 0, 0.28, "sine", 0.18);
        if (kind === "vroom") {
            sweep(60, 150, 0, 0.55, "sawtooth", 0.06);
            sweep(90, 220, 0.05, 0.5, "square", 0.025);
        }
        if (kind === "honk") {
            tone(392, 0, 0.16, "square", 0.06);
            tone(330, 0.2, 0.22, "square", 0.06);
        }
        if (kind === "whoosh")
            noise(0, 0.5, 0.18, 1600, "bandpass");
        if (kind === "blast") {
            noise(0, 1.6, 0.32, 420);
            sweep(140, 40, 0, 1.4, "sawtooth", 0.07);
        }
        if (kind === "sparkle")
            [1568, 2093, 2637].forEach((f, i) => tone(f, i * 0.06, 0.14, "sine", 0.07));
        if (kind === "flip")
            sweep(500, 900, 0, 0.08, "triangle", 0.07);
    }
    catch {
        /* audio not available */
    }
}
