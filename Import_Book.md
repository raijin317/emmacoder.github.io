# Import_Book.md — turning a textbook PDF into Emma English Studio lessons

> **Cho phụ huynh:** đặt file PDF vào `resources/book/` (thư mục này không bao giờ được đưa lên GitHub), rồi nói với Claude:
> *"Đọc Import_Book.md và import sách `resources/book/<tên file>.pdf`"*.
> Muốn giữ riêng tư (không đưa nội dung sách lên web public), nói thêm: *"giữ riêng tư"*.
> Xong việc, Claude báo kết quả. Bạn push repo lên GitHub (hoặc vào **Parent → Books → 📦 Import a book package**), rồi vào **Children → Edit** tích chọn sách cho bé.

**This file is for Claude.** Follow it whenever the parent asks you to import a book. It is the static site's version of the desktop app's **Import Book** feature (`D:\Project_Workspace\01_Dashbord_ENG`): there, the app called Claude to read the PDF, find the units, extract what each unit teaches, assess the level and write the lessons. Here **you** do those steps and write one **book package** (JSON). The site imports the package, checks your lessons against the family's lesson rules and adds the lessons it always builds itself.

---

## 1. What you produce

| | Path | Notes |
|---|---|---|
| Input | the PDF the parent names, usually `resources/book/<file>.pdf` | gitignored, never published |
| Work files | `resources/.work/<bookId>/` | gitignored; one file per step and per unit, so the job can be resumed |
| **Output (default)** | `content/books/<bookId>.json` + `content/books/index.json` | published with the site; every browser that opens the site imports it |
| Output (private) | `resources/packages/<bookId>.json` | the parent imports it with **Parent → Books → 📦 Import a book package** |

Use the private output when the parent says so ("private", "riêng tư", "don't publish", "không đưa lên"). Otherwise use the default.

The site does the rest when it imports the package (`src/server/books/package.js`):
- the units are **approved** at once (like the desktop import), and the level/age assessment is computed from them (`assessBook`);
- your lessons are checked: a lesson that uses a word outside the book, or a reading that is not the book's own text, is **dropped** and rebuilt offline;
- the app **always builds** `vocabulary`, two mini `game`s (chosen by topic, different from the units just before) and a `worksheet`, and builds offline any of your lesson types that is missing;
- a newer package `version` is imported again, but a unit whose words the parent edited, or whose lessons the parent edited, keeps the parent's version.

## 2. Tools

```
node tools/book-package.mjs id <book.pdf>                       # book id + page count (same id as the app makes)
node tools/book-package.mjs assemble resources/.work/<bookId> -v # work files → package + check + index
node tools/book-package.mjs assemble resources/.work/<bookId> --out resources/packages/<bookId>.json -v   # private
node tools/book-package.mjs check <package.json> -v              # check a package again
node tools/book-package.mjs index                                # rebuild content/books/index.json
```

`check` uses the site's own schemas and rules. It prints the book's **level** (the numbers you must write to), per unit what is there, what the rules would drop (❌ errors) and what looks off (⚠️ warnings: wrong emoji, sentences too long for the level, missing lesson types).

Read the PDF with the **Read** tool and its `pages` parameter (`"1-10"`; at most 20 pages per call). Textbooks are usually scanned pictures, so read the pages as images. **Page numbers in everything you write are PDF page indexes** (1 = the first page of the file), never the numbers printed on the pages.

Source of truth for every format: `src/lib/schemas/package.js`, `src/lib/schemas/book.js`, `src/lib/schemas/content.js`. If this file and the schemas disagree, the schemas win.

---

## 3. Workflow

Work step by step and **write each result to its work file as soon as it is ready**. If a work file already exists, reuse it (the job may have been interrupted) unless the parent asks to redo it.

### Step 1 — Prepare

1. `node tools/book-package.mjs id <pdf>` → `id`, `fileName`, `pageCount`.
2. Create `resources/.work/<id>/` with `units/` and `lessons/` inside.

### Step 2 — Overview: the book and its units → `book.json`

Read the cover and the contents / scope-and-sequence pages (usually within the first 10 pages).

- `title` as printed on the cover, `series` (e.g. "Global Success") or null.
- `bookType`: `student-book` | `workbook` | `teacher-book` | `other`.
- `grade`: 0 for preschool / kindergarten, 1–5 for primary grades, null if you can't tell. The file name can hint it (`G3_…`, `Grade 3`, `lop-3`, `Tiếng Anh 3`).
- The list of every **teaching unit** (and review sections only if they have their own pages) with first and last page:
  - If the contents page uses printed page numbers, open one or two unit start pages to find the offset between printed numbers and PDF page indexes, then convert.
  - A unit ends on the page before the next unit starts; the last unit ends at the last teaching page.

Write:

```json
{ "book": { "id": "<id>", "title": "…", "series": "…", "bookType": "student-book", "grade": 2, "pageCount": 77, "fileName": "<fileName>" },
  "notes": "optional: anything the parent should know about the whole book" }
```

Keep the unit list (order, title, first page, last page) for step 3 — you can note it in `book.json` under `"units"` while you work; `assemble` ignores it.

### Step 3 — Each unit: what it teaches → `units/uNN.json`

For each unit, read its pages (**at most 8 pages per pass**; for a longer unit, do several passes and merge them: keep the first copy of a repeated word/pattern/sentence/reading, take a picture box from a later pass when the first had none, combine skills and activity types, take the lowest confidence). Extract **only what is really printed**:

- `order` (1, 2, 3 …), `title` (as printed, without "Unit 3:"), `pages` `[first, last]`.
- `topic`: a plain English topic for the unit ("toys", "farm animals", "food", "my family"). It helps the app pick fitting games.
- `vocabulary`: the new words/phrases the unit teaches (pictured and labelled, or in a word box) — not every word on the page. Each:
  - `word` exactly as printed (lower case unless a name);
  - `emoji`: the one emoji that best shows it (**always give one**; the child sees it when there is no book picture);
  - `vi`: a short Vietnamese meaning for the parent;
  - `page`: where it is taught;
  - `pic`: where the book's **own picture** of this word is: `{ "page": 7, "box": [left, top, width, height] }` as fractions 0–1 of the **whole page image** measured from its top-left corner. Draw the box snugly around the one drawing/photo of this word: the whole object, without the printed label or neighbouring pictures. Leave `pic` out when the word has no clear picture of its own. (Picture: imagine a 10 × 10 grid over the page; `[0.10, 0.12, 0.30, 0.21]` starts 1 column in and a bit more than 1 row down, and is 3 columns wide and 2 rows high.)
- `patterns`: the target sentence patterns with the changing part written as `___` — e.g. `"What's this? It's a ___."` — plus a short `function` ("asking about things"). A pattern with exactly one `___` lets the app make grammar practice from it.
- `sentences`: the model sentences printed in the unit — speech bubbles, dialogue lines, pattern boxes, example sentences — **copied exactly** (spelling, punctuation, names). One sentence or short line per entry, up to 25.
- `readings`: the texts the child reads or chants (dialogues, chants, songs, short stories, "read and …" texts), **copied exactly**. Keep line breaks as `\n`; put the speaker's name before a dialogue line as printed (`"Bill: Hello!"`). A short `title` ("Let's talk", "Chant") and the `page`. Leave out instructions like "Listen and repeat."
- `phonics`: `[{ "focus": "b", "examples": ["ball", "book"] }]` if the unit has a letter/sound focus.
- `songsChants`: `[{ "title": "…", "page": 9 }]`.
- `skills`: which of `listening`, `speaking`, `reading`, `writing` the unit's activities practise.
- `activityTypes`: the instruction types you see ("listen and point", "read and match", …).
- `longestReadingWords`: word count of the longest reading text (0 if none).
- `confidence`: 0–1, how sure you are (lower it for blurry or unclear pages).
- `notes`: anything the parent should check (US spelling in notes).

`skills` and `longestReadingWords` feed the level assessment — fill them carefully.

### Step 4 — Know the level

When all units are written, build a draft (lessons still empty) — kept in the work folder, so nothing half-done is published:

```
node tools/book-package.mjs assemble resources/.work/<id> --out resources/.work/<id>/draft.json -v
```

Read the **Level** line: stage, ages, max words per sentence, questions per quiz, session minutes, writing yes/no, reads instructions yes/no. Write every lesson in step 5 to those numbers (table in §5). Fix any unit problem it reports (fewer than 3 words, missing emoji) now.

### Step 5 — Each unit's lessons → `lessons/uNN.json`

Write `{ "items": [ … ] }` with these lesson types, **in this order of importance**: `grammar`, `reading`, `listening`, `speaking`, `quiz`, `lessonPlan`, `test`. One item per type is the normal set. Do **not** write `vocabulary`, `game` or `worksheet` (the app makes them; `check` reports them as errors).

Skip `reading` when the unit has no reading text and fewer than 2 sentences. Skip `grammar` when the unit has no pattern.

Language rules (the family's built-in lesson rules — they are on unless the parent turned them off):
1. **Stay inside the unit.** Use only the words, sentences and patterns of this unit plus the earlier units' words and patterns (for review and wrong options). Don't add other content words, names or new sentences. Small words needed to ask a question (a, the, is, what, this, yes, no, can, you, I) are fine.
   - The app checks the **word labels**: every `label` of a picture option, every `word` of a match pair and every listening option label must be a unit word or an earlier unit's word (case, punctuation, a/an/the and a plural -s/-es don't matter). One outside word drops the whole lesson.
2. **The book's own pictures.** For a unit word, use **exactly the emoji listed for it in the unit's vocabulary**: the app swaps that emoji for the book's picture (in `mc`/`tf` questions it finds the picture by the emoji).
3. **Reading is the book's text.** The reading `passage` must be one of the unit's `readings` (or its `sentences` put together, one per line) **copied exactly** — the whole text or one part of it, keeping its line breaks. The app drops a reading whose passage is not in the book.
4. **Clear and easy for a young child**: one idea at a time, very short instructions, familiar pictures, few choices, cheerful tone.

Also:
- Prefer the book's own `sentences` (and the unit's patterns filled with unit words) for examples, listening scripts, speaking prompts and questions.
- American English spelling and words (color, favorite, mom) — unless the book itself prints something else; then copy the book.
- Child-safe, kind, inclusive, everyday home/school/play situations. No brand names, no real people.
- Every picture is an emoji (`emoji` fields). Quiz answers must exactly match one option. Fill-in sentences use `___` for the blank.
- Titles are short and fun ("Find the toy!", "Mia's toy box").
- When the child can't read instructions yet (`reads instructions no`), questions are spoken by the app: use `picture` and `tf` questions, keep prompts to a few words.

What each type should be:

| Type | Make |
|---|---|
| `grammar` | One pattern of the unit. `explanation`: one or two short, friendly sentences, no grammar terms for young children. 3–5 `examples` (book sentences first). `practice`: 2–4 questions (`fill` with the pattern, `order` with a book sentence, `mc`). |
| `reading` | `passage` = a book text (rule 3). `questions`: up to min(4, questions per quiz) easy questions about it; `picture` or `tf` questions when the child can't read instructions. |
| `listening` | `intro` (short), 4–6 `tasks`: `say` = a book sentence or a unit word, `question` ("Which picture?"), 3 picture `options` (unit words), `answer`. |
| `speaking` | `prompts`: the unit words to repeat, then 2–4 book sentences (`mode: "repeat"`); for readers, a few `mode: "answer"` prompts whose `question` is a book question and `text` the expected answer. |
| `quiz` | About "questions per quiz" questions, mixing kinds that fit the level (`picture`, `tf` for pre-readers; plus `mc`, `fill`, `match`, `order` for readers). |
| `lessonPlan` | A home session of exactly "session minutes": steps `warm-up` → `learn` → `practice` → `play` → `review`, each with `minutes`, `activity` and a `parentScript` that says exactly what the parent says/does. Refer to the app's parts: Words, Listen, Speak, Sentences, Read, a game, Quiz, the printed Worksheet. |
| `test` | `minutes` 10–20; sections by skill (`listening`, `vocabulary`, `grammar` if the unit has a pattern, `reading` if it has a text), 2–4 questions each. |

### Step 6 — Assemble, check, fix, report

1. `node tools/book-package.mjs assemble resources/.work/<id> -v` (add `--out resources/packages/<id>.json` for a private book). It writes the package (raising `version` when the content changed), runs `check`, and — for the default output — rebuilds `content/books/index.json`.
2. Fix every ❌ in the work files and assemble again until there are no errors. Look at each ⚠️ and fix what is really wrong (a wrong emoji, a sentence too long for the level, a lesson type you forgot).
3. Report to the parent (in Vietnamese if the parent writes Vietnamese): book title, level and ages, a short table per unit (words, pictures found, patterns, sentences, readings, lessons written), what you were unsure about (low confidence, missing pictures), and the next steps:
   - default output: push the repo to GitHub; the book appears in **Books** in every browser that opens the site;
   - private output: **Parent → Books → 📦 Import a book package** → choose `resources/packages/<id>.json`;
   - then **Children → Edit** → tick the book for the child;
   - to see the **book's pictures**, open the book in **Books** and press **📎 Add the book's PDF** with the same PDF (pages are prepared in that browser only). Wrong picture boxes can be fixed on the unit page (📖 From the book → click the picture).

Don't publish the PDF or page images anywhere, and don't commit anything in `resources/`.

---

## 4. Package format

The finished package (`assemble` builds it from the work files):

```json
{
  "format": "emma-book-package",
  "version": 1,
  "generatedBy": "Claude (Import_Book.md)",
  "generatedAt": "2026-11-23T10:00:00.000Z",
  "book": {
    "id": "tieng-anh-2-global-success-a76e065e",
    "title": "Tiếng Anh 2 Global Success",
    "series": "Global Success",
    "bookType": "student-book",
    "grade": 2,
    "pageCount": 77,
    "fileName": "Tieng Anh 2 Global Success.pdf"
  },
  "notes": "optional",
  "units": [ { "…unit fields…": "", "items": [ { "type": "grammar", "title": "…", "data": { } } ] } ]
}
```

- `book.id`: lower-case letters, digits, dashes — use the one from `tools/book-package.mjs id` (slug of the file name + first 8 hex digits of the file's SHA-256). Then the package joins the same book if the parent already added that PDF in the browser.
- `version`: a whole number ≥ 1. `assemble` raises it when the content changes; the site imports a package again only when its version is higher.
- Unit ids in the app are `<bookId>-u01`, `-u02`, … from `order` (don't write ids).

### Unit (`units/uNN.json`)

| Field | Type | Rule |
|---|---|---|
| `order` | integer ≥ 1 | unique |
| `title`, `topic` | string | required |
| `pages` | `[first, last]` | PDF page indexes, last ≥ first, ≤ pageCount |
| `vocabulary` | `[{ word, emoji, vi?, partOfSpeech?, page?, pic? }]` | ≥ 3 words, or the app can't make lessons |
| `vocabulary[].pic` | `{ page, box: [left, top, width, height] }` | fractions 0–1 of the page image |
| `patterns` | `[{ text, function, page? }]` | the slot as `___` |
| `sentences` | `string[]` | exactly as printed, ≤ 25 |
| `readings` | `[{ title, text, page? }]` | exactly as printed, `\n` line breaks |
| `phonics` | `[{ focus, examples: string[] }]` | |
| `songsChants` | `[{ title, page? }]` | |
| `skills` | subset of `listening`, `speaking`, `reading`, `writing` | |
| `activityTypes` | `string[]` | |
| `longestReadingWords` | integer ≥ 0 | |
| `confidence` | 0–1 | |
| `notes` | string | optional |

### Lessons (`lessons/uNN.json` → `{ "items": [ { "type", "title", "data" } ] }`)

`emoji` fields are 1–16 characters (one emoji).

**Questions** (used by `quiz`, `test`, `grammar.practice`, `reading.questions`), by `kind`:

| kind | fields | rules |
|---|---|---|
| `mc` | `prompt`, `emoji?`, `options` (2–4 strings), `answer` | answer is one of the options |
| `picture` | `prompt` (spoken: "Find the cat."), `options` (2–4 `{ emoji, label }`), `answer` | answer equals one option's label; labels are unit words |
| `tf` | `statement`, `emoji?`, `answer` (true/false) | |
| `fill` | `sentence` (contains `___`), `options` (2–4), `answer` | answer is one of the options |
| `match` | `prompt?`, `pairs` (2–6 `{ emoji, word }`) | words are unit words |
| `order` | `prompt?`, `emoji?`, `words` (2–8, in the right order) | a book sentence split into words |

**Data per type:**

```jsonc
// grammar
{ "pattern": "I have a ___.", "explanation": "Say “I have a …” and then your toy.",
  "examples": [{ "text": "I have a ball.", "emoji": "⚽" }], "practice": [ /* questions */ ] }
// reading
{ "passage": "Mai: What's this?\nBill: It's a ball.", "emoji": "⚽", "questions": [ /* ≥ 1 question */ ] }
// listening
{ "intro": "Listen and tap the right picture.",
  "tasks": [{ "say": "It's a ball.", "question": "Which picture?", "options": [{ "emoji": "⚽", "label": "ball" }, { "emoji": "🪁", "label": "kite" }], "answer": "ball" }] }
// speaking  (mode "repeat": say `text`; mode "answer": the app asks `question`, the child answers `text`)
{ "prompts": [{ "mode": "repeat", "text": "ball", "emoji": "⚽" }, { "mode": "answer", "question": "What's this?", "text": "It's a ball.", "emoji": "⚽", "hint": "It's a …" }] }
// quiz
{ "questions": [ /* ≥ 1 question */ ] }
// lessonPlan  (minutes 5–60; ≥ 2 steps; step minutes 1–30; stage: warm-up | learn | practice | play | review)
{ "minutes": 15, "objectives": ["Say and recognize: ball, car, doll."], "materials": ["Flashcards on screen", "Printed worksheet"],
  "steps": [{ "stage": "warm-up", "minutes": 2, "activity": "Hello song", "parentScript": "Say “Hello! How are you?” and sing together." }] }
// test  (minutes 5–90; skill: listening | vocabulary | grammar | reading | writing)
{ "minutes": 15, "sections": [{ "title": "Listen and choose", "skill": "listening", "questions": [ /* ≥ 1 question */ ] }] }
```

## 5. Level rules

The site computes the level from the grade (and from the content when the grade is unknown). `check` prints it; these are the numbers:

| Stage | Ages | Max words / sentence | Reading passage | Writing | Reads instructions | Questions / quiz | Session |
|---|---|---|---|---|---|---|---|
| pre-reader (preschool) | 3–5 | 4 | — | no | no | 5 | 10 min |
| early-reader (grade 1–2) | 6–8 | 6 | 20–40 words | yes | no | 6 | 15 min |
| developing-reader (grade 3–4) | 8–10 | 9 | 40–80 words | yes | yes | 8 | 20 min |
| independent-reader (grade 5) | 10–11 | 12 | 80–150 words | yes | yes | 10 | 25 min |

(Ages with a known grade are grade + 5 to grade + 6; the book's own reading texts are used as they are, whatever their length.)

## 6. Final checklist

- [ ] Every unit from the contents is there, in order, with the right PDF page ranges.
- [ ] Words, sentences and reading texts are copied exactly from the pages; nothing invented.
- [ ] Every word has one emoji; lessons use the same emoji for the same word.
- [ ] Picture boxes are snug around the word's own picture (or left out).
- [ ] Each unit has the lesson types it can have (`grammar` when it has a pattern, `reading` when it has a text).
- [ ] Sentences fit the level's word limit; quiz sizes fit the level.
- [ ] `node tools/book-package.mjs assemble …` shows **0 errors**.
- [ ] Default output: `content/books/index.json` lists the new version. Private output: the file is in `resources/packages/`.
- [ ] Nothing from `resources/` is committed or published.
