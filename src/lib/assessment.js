export const STAGES = ["pre-reader", "early-reader", "developing-reader", "independent-reader"];
export const STAGE_INFO = {
    "pre-reader": { label: "Pre-reader", ages: [3, 5], emoji: "🐣" },
    "early-reader": { label: "Early reader", ages: [6, 7], emoji: "🌱" },
    "developing-reader": { label: "Developing reader", ages: [8, 9], emoji: "🌻" },
    "independent-reader": { label: "Independent reader", ages: [9, 10], emoji: "🌳" },
};
export const PROFILES = {
    "pre-reader": { maxSentenceWords: 4, readingPassageWords: [0, 0], allowWriting: false, allowReadingInstructions: false, questionsPerQuiz: 5, sessionMinutes: 10 },
    "early-reader": { maxSentenceWords: 6, readingPassageWords: [20, 40], allowWriting: true, allowReadingInstructions: false, questionsPerQuiz: 6, sessionMinutes: 15 },
    "developing-reader": { maxSentenceWords: 9, readingPassageWords: [40, 80], allowWriting: true, allowReadingInstructions: true, questionsPerQuiz: 8, sessionMinutes: 20 },
    "independent-reader": { maxSentenceWords: 12, readingPassageWords: [80, 150], allowWriting: true, allowReadingInstructions: true, questionsPerQuiz: 10, sessionMinutes: 25 },
};
function stageFromGrade(grade) {
    if (grade <= 0)
        return "pre-reader";
    if (grade <= 2)
        return "early-reader";
    if (grade <= 4)
        return "developing-reader";
    return "independent-reader";
}
function wordCount(text) {
    return text
        .replace(/_+/g, " x ")
        .split(/\s+/)
        .filter((w) => /[a-z]/i.test(w)).length;
}
export function computeMetrics(units) {
    const words = new Set();
    let newWords = 0;
    let patternWords = 0;
    let patternCount = 0;
    let longest = 0;
    let readingUnits = 0;
    let writingUnits = 0;
    for (const u of units) {
        newWords += u.vocabulary.length;
        u.vocabulary.forEach((v) => words.add(v.word.toLowerCase().trim()));
        u.patterns.forEach((p) => {
            patternWords += wordCount(p.text);
            patternCount++;
        });
        longest = Math.max(longest, u.longestReadingWords);
        if (u.skills.includes("reading") || u.longestReadingWords >= 20)
            readingUnits++;
        if (u.skills.includes("writing"))
            writingUnits++;
    }
    const n = Math.max(units.length, 1);
    return {
        units: units.length,
        distinctWords: words.size,
        avgNewWordsPerUnit: Math.round((newWords / n) * 10) / 10,
        avgPatternWords: patternCount ? Math.round((patternWords / patternCount) * 10) / 10 : 0,
        longestReadingWords: longest,
        hasReading: readingUnits / n >= 0.3,
        hasWriting: writingUnits / n >= 0.3,
    };
}
function stageFromMetrics(m) {
    if (!m.hasReading && !m.hasWriting && m.avgPatternWords <= 4.5)
        return "pre-reader";
    if (m.longestReadingWords < 40 && m.avgPatternWords <= 6.5)
        return "early-reader";
    if (m.longestReadingWords < 90)
        return "developing-reader";
    return "independent-reader";
}
/** Rule-based level & age assessment from the extracted book content (PROJECT_SPEC §3). */
export function assessBook(grade, units) {
    const metrics = computeMetrics(units);
    const metricStage = stageFromMetrics(metrics);
    const rationale = [];
    let stage;
    if (grade !== null) {
        stage = stageFromGrade(grade);
        rationale.push(grade === 0 ? "The book is labelled for preschool / kindergarten." : `The book is labelled Grade ${grade}.`);
        const diff = STAGES.indexOf(metricStage) - STAGES.indexOf(stage);
        if (diff > 0)
            rationale.push(`Its content looks a bit harder than usual for this grade (${STAGE_INFO[metricStage].label.toLowerCase()} level).`);
        if (diff < 0)
            rationale.push(`Its content looks a bit easier than usual for this grade (${STAGE_INFO[metricStage].label.toLowerCase()} level).`);
    }
    else {
        stage = metricStage;
        rationale.push("No grade label was found, so the level is estimated from the content only.");
    }
    rationale.push(`${metrics.units} units, ${metrics.distinctWords} different words (about ${metrics.avgNewWordsPerUnit} new words per unit).`, `Sentence patterns average ${metrics.avgPatternWords} words.`);
    rationale.push(metrics.hasReading
        ? `Includes reading texts (longest about ${metrics.longestReadingWords} words).`
        : "Mostly listening and speaking; little or no reading.");
    rationale.push(metrics.hasWriting ? "Includes writing tasks." : "Little or no writing.");
    let ages = STAGE_INFO[stage].ages;
    if (grade !== null)
        ages = grade === 0 ? [3, 5] : [5 + grade, 6 + grade];
    const cefr = stage === "pre-reader" || stage === "early-reader"
        ? "Pre-A1"
        : stage === "independent-reader" && metrics.longestReadingWords >= 120
            ? "A2"
            : "A1";
    return {
        stage,
        cefr,
        estimatedAge: { min: ages[0], max: ages[1] },
        estimatedGrade: grade,
        rationale,
        metrics,
        generationProfile: PROFILES[stage],
    };
}
export function childFit(age, a) {
    const { min, max } = a.estimatedAge;
    if (age < min)
        return { level: "challenging", reason: `This book suits ages ${min}–${max}; your child is ${age}. Go slowly and use pictures and audio.` };
    if (age > max + 1)
        return { level: "easy", reason: `This book suits ages ${min}–${max}; your child is ${age}. Good for review — consider a higher book.` };
    return { level: "suitable", reason: `This book suits ages ${min}–${max}. A good match.` };
}
