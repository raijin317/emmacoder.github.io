/** Natural (Kokoro) American English voices offered to families. */
export const NATURAL_VOICES = [
    { id: "af_heart", label: "Heart", note: "warm & lively — best for kids", gender: "female" },
    { id: "af_bella", label: "Bella", note: "bright & friendly", gender: "female" },
    { id: "af_nova", label: "Nova", note: "clear teacher voice", gender: "female" },
    { id: "af_sky", label: "Sky", note: "soft & gentle", gender: "female" },
    { id: "am_puck", label: "Puck", note: "playful & fun", gender: "male" },
    { id: "am_michael", label: "Michael", note: "calm & kind", gender: "male" },
];
export const DEFAULT_VOICE = "af_heart";
export const isNaturalVoice = (v) => NATURAL_VOICES.some((x) => x.id === v);
/** Normal and slow speaking speed for a given child speed setting. */
export function speechSpeed(childRate, slow) {
    const base = Math.min(1.2, Math.max(0.6, childRate));
    return Math.round((slow ? Math.max(0.55, base * 0.75) : base) * 100) / 100;
}
/** Tidies spaces but keeps line breaks (one blank line at most) — they tell the voice where to pause. */
export function normalizeSpeech(text) {
    return text
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((l) => l.replace(/\s+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
/** Longest text the natural voice reads in one go (a long book passage). */
export const MAX_SPEECH_CHARS = 1000;
/** Short cheerful lines used by the mascot and celebrations. */
export const PRAISE = {
    great: "Amazing! Great job!",
    good: "Well done!",
    try: "Good try! Let's practice again.",
};
/** What the voice says when an answer is not right yet — the child picks again until it is. */
export const TRY_AGAIN = "Oops! Try again.";
/** Said when a sticker page is complete and the child wins its trophy. */
export const TROPHY_WON = "Wow! You won a trophy!";
