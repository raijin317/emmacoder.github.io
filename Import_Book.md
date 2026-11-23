# Import_Book.md — turning a textbook PDF into Emma English Studio lessons

> **Cho phụ huynh:** đặt file PDF vào `resources/book/` (thư mục này không bao giờ được đưa lên GitHub), rồi nói với Claude:
> *"Đọc Import_Book.md và import sách `resources/book/<tên file>.pdf`"*.
> Muốn giữ riêng tư (không đưa nội dung sách lên web public), nói thêm: *"giữ riêng tư"*.
> Claude đọc sách, **vẽ hình cho từng từ** (giống hình trong sách, kiểu hoạt hình dễ thương) và viết bài học theo 4 quy tắc ở mục 2. Xong việc, Claude báo kết quả.
> Bạn push repo lên GitHub (hoặc vào **Parent → Books → 📦 Import a book package**), rồi vào **Children → Edit** tích chọn sách cho bé.
> Mỗi từ có **3 lựa chọn hình**: ✏️ hình Claude vẽ, 📖 hình trong sách (cần thêm PDF của sách vào trình duyệt), 😀 emoji. Bạn chọn hình bé sẽ thấy ở trang unit → tab **📖 From the book** → cột **Picture your child sees** (hoặc nút **All words** cho cả unit), rồi **💾 Save**.

**This file is for Claude.** Follow it whenever the parent asks you to import a book. It is the static site's version of the desktop app's **Import Book** feature (`D:\Project_Workspace\01_Dashbord_ENG`): there, the app called Claude to read the PDF, find the units, extract what each unit teaches, assess the level and write the lessons. Here **you** do those steps — and draw a picture for every unit word — and write one **book package** (JSON). The site imports the package, checks your lessons against the family's lesson rules and adds the lessons it always builds itself.

---

## 1. What you produce

| | Path | Notes |
|---|---|---|
| Input | the PDF the parent names, usually `resources/book/<file>.pdf` | gitignored, never published |
| Work files | `resources/.work/<bookId>/` | gitignored; one file per step, per unit and per picture, so the job can be resumed |
| **Output (default)** | `content/books/<bookId>.json` + `content/books/index.json` | published with the site; every browser that opens the site imports it |
| Output (private) | `resources/packages/<bookId>.json` | the parent imports it with **Parent → Books → 📦 Import a book package** |

Use the private output when the parent says so ("private", "riêng tư", "don't publish", "không đưa lên"). Otherwise use the default.

The site does the rest when it imports the package (`src/server/books/package.js`):
- the units are **approved** at once (like the desktop import), and the level/age assessment is computed from them (`assessBook`);
- every unit word offers the parent **three pictures**: your **drawing** (stored with the book, shown in every browser without the PDF), the **book's own picture** (cut from the page at the word's `pic` box — only in a browser where the parent added the PDF) and its **emoji**. The parent picks one per word in the unit page (📖 From the book → *Picture your child sees*); not picked = your drawing, else the book's picture, else the emoji. The chosen picture replaces the emoji in every activity, game and printout;
- your lessons are checked: a lesson that uses a word outside the book, or a reading that is not the book's own text, is **dropped** and rebuilt offline;
- the app **always builds** `vocabulary`, two mini `game`s (chosen by topic, different from the units just before) and a `worksheet`, and builds offline any of your lesson types that is missing;
- a newer package `version` is imported again, but a unit whose words the parent edited, or whose lessons the parent edited, keeps the parent's version.

---

## 2. The family's lesson rules

These four rules are the built-in lesson rules of the app (Parent → 📏 Lesson rules). Every word you extract, every picture you draw and every lesson you write follows them. If the parent switched a rule off or added rules of their own in the app, the parent will tell you; otherwise all four apply.

### Rule 1 — Stay inside the unit

> *Stay inside the unit: use only the words, sentences and patterns this unit of the book teaches (words from earlier units are fine for review). Never invent new words or sentences that are not in the book.*

What it means for you:
- **Extraction** (step 3): copy only what is really printed — words, sentences, patterns and texts exactly as on the page. Never add, fix or complete them.
- **Every sentence the child hears or reads** in a lesson must be one of these — nothing else:
  1. a sentence or line **printed in this unit or an earlier unit** (exactly, or a part of a printed line), or
  2. a **book pattern** (a `patterns` entry with `___`) with the gap filled by a word of the book, or
  3. for a yes/no question whose answer is **No**: a book sentence with **one unit word swapped** for another unit word.

  "Sentences the child hears or reads" are: grammar `examples` and `practice`, the listening `say`, speaking `text` and `question`, every `tf` statement, a `fill` sentence with its answer, an `mc` prompt (with its answer in the gap), the words of an `order` question.
- Not allowed: paraphrases ("Kate is in the yard." when the book prints "She's in the yard."), writing out contractions ("He is" for "He's"), new names, new places, new adjectives, new questions about a text.
- The only other lines are the app's short standard instructions: "Find the ⟨word⟩.", "Which picture?", "What is it?", "Put the words in order.", "Match the pictures and the words.", "Listen and tap the right picture."
- Word labels — every `label` of a picture option, every `word` of a match pair, every listening option — are words of this unit or an earlier unit.
- Review sections ("Review", "Fun time") may use everything of the units before them.

How it is checked: `check` reports ❌ **rule 1** for every sentence that is not in the book; the app drops a lesson with a label word outside the book.

### Rule 2 — Pictures drawn by Claude

> *Use Claude AI generate pictures for the unit words, so the child sees the similar pictures as in class.*

What it means for you — **every word gets three pictures**, so the parent can choose:
1. ✏️ **Your drawing** — draw one picture for every word in the units' `vocabulary` (once per word for the whole book — a word met again in a review unit uses the same drawing). It shows **the same thing as the book's picture of that word** — same object, same main colours, same view or pose — so the child recognizes it from class, drawn in the **cute sticker style** of `tools/draw-kit.mjs` so that a young child *wants* to look at it (step 4 says exactly how). It is **your own drawing**: don't trace the page, and don't copy characters' faces, logos or printed text.
2. 📖 **The book's own picture** — a `pic` box for every word (where its picture is on the page). If the unit has no picture of the word, box the clearest picture of it anywhere in the book (e.g. "sixteen" → the cake with the 16 candle on another page). A review unit may leave out the box of a word an earlier unit has — the app uses that one.
3. 😀 **The emoji** — one `emoji` per word, and exactly that emoji for the word in the lessons: the app swaps the emoji for the chosen picture (in `mc` and `tf` questions it finds the picture by the emoji).

The parent picks one per word (or for the whole unit) in the app. You may preset the choice with `"show": "drawing" | "book" | "emoji"` on a word — normally leave it out (= your drawing first); use `"book"` only for a word whose book picture is much clearer than anything you can draw, and say so in the report.

How it is checked: `check` prints how many words have each of the three pictures, reports ⚠️ **rule 2** for a word without a drawing, a word without a book picture box, or a `show` pointing to a picture that is not there, and ❌ for a drawing that is not a safe, plain picture (see §6 "Drawings"). `pictures` puts the book's picture and your drawing side by side; `pictures --big` shows your drawings large, to judge their quality.

### Rule 3 — Reading is the book's text

> *Reading uses the book's own reading texts and sentences, word for word (dialogues, chants, short texts) — not new stories.*

What it means for you:
- The reading `passage` is one of the unit's `readings` **copied exactly** — the whole text or one part of it, keeping its line breaks — or, when the unit has no reading text, its `sentences` put together one per line (from the first 10). Never edit it: no new lines, no fixed punctuation, no shortened sentences.
- The questions about it use the text's own sentences (true) or a text sentence with one unit word swapped (false) — rule 1 — and a "Find the ⟨word⟩." question only asks for a word that is in the passage.
- Skip `reading` when the unit has no reading text and fewer than 2 sentences.

How it is checked: the app drops a reading whose passage is not in the book; `check` reports it as ❌.

### Rule 4 — Clear and easy for a young child

> *Keep everything clear and easy for a young child: one idea at a time, very short instructions, familiar pictures, a few choices, cheerful feedback.*

What it means for you:
- **One idea at a time**: one question per item; one pattern per grammar lesson; one sentence per listening task.
- **Very short instructions**: only the standard instructions of rule 1 (6 words at most). When the child can't read instructions yet (`reads instructions no`), the app speaks every question: use `picture` and `tf` questions first.
- **Familiar pictures**: only the unit's words with their drawings / emoji — no other pictures.
- **A few choices**: at most **3** pictures or words per question when the child can't read instructions (pre-reader, early reader), at most 4 for readers.
- **Sentences** no longer than the level's maximum (§7). Grammar `explanation`: one or two short, friendly sentences, no grammar terms.
- **Cheerful feedback**: the app gives it (praise, "Oops! Try again.", stars, stickers). Keep titles short and fun ("Find the toy!", "Mia's toy box"), never negative wording; lesson-plan scripts praise every try.

How it is checked: `check` reports ⚠️ **rule 4** for too many choices, long instructions and long explanations, and ⚠️ for sentences longer than the level allows.

---

## 3. Tools

```
npm install                                                      # once: the tools below need pdfjs-dist and @napi-rs/canvas
npm run book:pages -- <book.pdf>                                 # every page → resources/.work/<bookId>/pages/p-001.png …
node tools/book-package.mjs id <book.pdf>                       # book id + page count (same id as the app makes)
node tools/book-package.mjs pictures resources/.work/<bookId>    # sheet: book picture | your drawing, for every word (rule 2)
node tools/book-package.mjs pictures resources/.work/<bookId> --big   # your drawings alone, large (quality look)
node tools/book-package.mjs assemble resources/.work/<bookId> -v # work files → package + check + index
node tools/book-package.mjs assemble resources/.work/<bookId> --out resources/packages/<bookId>.json -v   # private
node tools/book-package.mjs check <package.json> -v              # check a package again
node tools/book-package.mjs index                                # rebuild content/books/index.json
```

`check` uses the site's own schemas and rules. It prints the book's **level** (the numbers you must write to), per unit what is there, ❌ errors (rule 1 sentences, rule 3 readings, unsafe drawings, lessons the app would drop) and ⚠️ warnings (missing drawings or book picture boxes, too many choices, long sentences or instructions, wrong emoji, missing lesson types).

`tools/draw-kit.mjs` is the drawing kit for step 4: outline, gradients, gloss, shadows, big shiny eyes, cheeks, mouths, clouds, sun, trees, bubble numbers. Use it for every drawing (read its header first).

Look at the pages with the **Read** tool on the PNG files from `npm run book:pages` (`resources/.work/<bookId>/pages/p-007.png` = PDF page 7). They are drawn at the same size as the site draws pages, so a picture box measured on them matches the app. (Reading the PDF itself with `pages` needs poppler, which is not installed on the family PC.) Textbooks are usually scanned pictures, so read the pages as images. **Page numbers in everything you write are PDF page indexes** (1 = the first page of the file), never the numbers printed on the pages.

Source of truth for every format: `src/lib/schemas/package.js`, `src/lib/schemas/book.js`, `src/lib/schemas/content.js`, `src/lib/safeSvg.js` (drawings). If this file and the code disagree, the code wins.

---

## 4. Workflow

Work step by step and **write each result to its work file as soon as it is ready**. If a work file already exists, reuse it (the job may have been interrupted) unless the parent asks to redo it.

### Step 1 — Prepare

1. `npm install` (first time), then `npm run book:pages -- <pdf>` → the page images (about 15 s for 80 pages).
2. `node tools/book-package.mjs id <pdf>` → `id`, `fileName`, `pageCount`.
3. Create `resources/.work/<id>/` with `units/`, `pictures/` and `lessons/` inside.

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

For each unit, read its pages (**at most 8 pages per pass**; for a longer unit, do several passes and merge them: keep the first copy of a repeated word/pattern/sentence/reading, take a picture box from a later pass when the first had none, combine skills and activity types, take the lowest confidence). Extract **only what is really printed** (rule 1):

- `order` (1, 2, 3 …), `title` (as printed), `pages` `[first, last]`.
- `topic`: a plain English topic for the unit ("toys", "farm animals", "food", "my family"). It helps the app pick fitting games.
- `vocabulary`: the new words/phrases the unit teaches (pictured and labelled, or in a word box) — not every word on the page. Each:
  - `word` exactly as printed (lower case unless a name);
  - `emoji`: the one emoji that best shows it (**always give one**; it is shown when there is no picture);
  - `vi`: a short Vietnamese meaning for the parent;
  - `page`: where it is taught;
  - `pic`: where the book's **own picture** of this word is: `{ "page": 7, "box": [left, top, width, height] }` as fractions 0–1 of the **whole page image** measured from its top-left corner. Draw the box snugly around the one drawing/photo of this word: the whole object, without the printed label or neighbouring pictures. **Every word needs one** (it is the parent's 📖 choice, rule 2): when the unit has no picture of the word, box the clearest picture of it on another page of the book (the box's `page` may be outside the unit); only a review unit may leave it out for a word that an earlier unit already boxed. (Picture: imagine a 10 × 10 grid over the page; `[0.10, 0.12, 0.30, 0.21]` starts 1 column in and a bit more than 1 row down, and is 3 columns wide and 2 rows high.) Open the page again and check that the box really holds the picture — `pictures` (step 4) shows every box cut out.
  - `show` (optional, normally left out): which of the three pictures the child sees at first — see rule 2.
- `patterns`: the target sentence patterns with the changing part written as `___` — e.g. `"What's this? It's a ___."` — plus a short `function` ("asking about things"). Write a pattern only when the book shows it as a pattern (a box with a gap, or the same sentence with different words). A pattern with exactly one `___` lets the app make grammar practice from it.
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

### Step 4 — Draw the pictures → `pictures/<word>.svg` (rule 2)

The drawings are what the child looks at most, so they must be **attractive to a young child** — not just correct. Plain flat shapes with dot eyes and stiff legs look dull and are rejected. Write one script, `resources/.work/<id>/draw-pictures.mjs`, that builds every picture with `tools/draw-kit.mjs` and writes `pictures/<file>.svg` (`node resources/.work/<id>/draw-pictures.mjs`); fixing a picture is then a small edit and a re-run.

For every word of the book (each once), in unit order:

1. **Look at the book's picture**: open the page image of its `pic` box (or the page where the word is taught) with the Read tool. Note what it shows: the object (or the person/action), its main colours, the view or pose, the background if the picture is a place (sea, zoo, village).
2. **Draw it** in the kit's **cute sticker style** — your own version of that picture:
   - 256 × 256 (`svg()` of the kit); the subject centred and filling about 80 % of the square; transparent background, unless the word is a place or a scene (then `scene()` — a rounded square with a sky, ground and the book's main things).
   - **Look**: one warm dark-brown outline (`INK`, `O` = 4.5 px outside, `O3`/`O2` inside), round joins; **soft gradients** (`soft(colour)` for most parts, `ball(colour)` for round things) in the book's colours — never only flat fills; a **white gloss** on shiny things (`gloss()`, `shine()`); a **soft shadow** under things that stand (`shadow()`); parts that overlap drawn back to front, so there are no stray lines (`merged()` style: outline pass, then fill pass).
   - **Animals** (the most important): **chibi** — a big head (about half the height), a small round body, short round legs; the **face turned to the child** even when the body is seen from the side; **big shiny eyes** (`eye()`, with the two white sparkles), **rosy cheeks** (`cheek()`), a small smile (`smile()`, `catMouth()`); ears with a pink inside. Keep the features that tell the animals apart: fox = orange, pointed black-tipped ears, white cheeks, bushy tail with a white tip; zebra = black stripes on body, legs and face, dark muzzle, mane; ox = horns, muzzle; zebu = hump, droopy ears; elephant = big ears, trunk; giraffe = long neck, spots. A small animal sits facing the child; a big one stands sideways with its head turned to the child.
   - **People** (family words): big head, big shiny eyes, eyebrows, rosy cheeks, a happy open smile (`openSmile()`), hair with a shine — with the same hair, clothes and accessories as the book's person (glasses, cardigan, curls …), from the shoulders up. **Action words** (sliding, riding, driving): a happy chibi child doing that action, as in the book (helmet on the bike, arms up on the slide).
   - **Things**: the book's shape and colours, with volume (gradient + gloss + shadow). No faces on things unless the book's picture has one. **Number words**: `digits("16", …)` — bubble numbers drawn as paths, decorated like the book's (dots, sprinkles, two colours); never `<text>`.
   - A few `sparkle()`s may cheer up an empty corner; nothing else that is not in the book's picture.
   - Only drawing parts (§6 "Drawings"): no letters or words, no embedded images, no links, no scripts; at most 20 000 characters (2–10 KB is normal).
   - A word that can't be drawn (a greeting, "please"): no file — its emoji stays.
3. **Save** it as `resources/.work/<id>/pictures/<file>.svg`: the word in lower case, without a leading a/an/the, every run of other characters as "-" ("teddy bear" → `teddy-bear.svg`, "yo-yos" → `yo-yos.svg`). `check` prints the expected name of every missing drawing.
4. **Check them**, both ways, with the Read tool:
   - `node tools/book-package.mjs pictures resources/.work/<id> --big` → `pictures-big-1.png` …: your drawings alone, large. Would a 4-year-old smile at it and want to tap it? Redraw anything that looks flat, stiff, unfinished, crowded or odd (eyes too small, legs like sticks, parts not joined, a shape you can't name at first sight, a part cut off at the edge).
   - `node tools/book-package.mjs pictures resources/.work/<id>` → `pictures-sheet.png` …: the book's picture next to your drawing (and every `pic` box cut out). Redraw anything that does not look like the book's picture (wrong object, colours or pose), and fix any box that does not hold the word's picture.
   - Up to three rounds of redrawing; in the report, name the drawings that are still the least like the book's picture.

The drawings are your own artwork, so they may be published with a public package. The book's own pictures and page images are never published.

### Step 5 — Know the level

When all units are written, build a draft (lessons still empty) — kept in the work folder, so nothing half-done is published:

```
node tools/book-package.mjs assemble resources/.work/<id> --out resources/.work/<id>/draft.json -v
```

Read the **Level** line: stage, ages, max words per sentence, questions per quiz, session minutes, writing yes/no, reads instructions yes/no. Write every lesson in step 6 to those numbers (§7). Fix any unit problem it reports (fewer than 3 words, missing emoji, drawings or book picture boxes) now.

### Step 6 — Each unit's lessons → `lessons/uNN.json`

Write `{ "items": [ … ] }` with these lesson types, **in this order of importance**: `grammar`, `reading`, `listening`, `speaking`, `quiz`, `lessonPlan`, `test`. One item per type is the normal set. Do **not** write `vocabulary`, `game` or `worksheet` (the app makes them; `check` reports them as errors). Skip `grammar` when the unit has no pattern; skip `reading` as rule 3 says.

Follow the four rules of §2 in every item. Also:
- American English spelling and words (color, favorite, mom) in your own lines (titles, explanations, lesson plans) — the book's sentences stay exactly as printed.
- Child-safe, kind, inclusive, everyday home/school/play situations. No brand names, no real people.
- Every picture is an emoji (`emoji` fields) — the unit word's own emoji, which the app replaces with your drawing. Quiz answers must exactly match one option. Fill-in sentences use `___` for the blank.
- A `fill` or `mc` question has **one** right answer: if every option would fit the sentence, show the word's picture (`mc` with `emoji`) or choose a gap that grammar decides ("Is there ___ ox?" an / a).
- A `tf` statement with an `emoji` must be about that picture ("That's a zebra." + the zebra = yes; + the zebu = no).

What each type should be:

| Type | Make |
|---|---|
| `grammar` | One pattern of the unit. `explanation`: one or two short, friendly sentences, no grammar terms. 3–5 `examples` (book sentences first). `practice`: 2–4 questions (`mc` with the word's picture, `fill` decided by grammar, `order` with a book sentence). |
| `reading` | `passage` = a book text (rule 3). `questions`: up to min(4, questions per quiz) easy questions about it: `tf` with the text's sentences, `picture` "Find the ⟨word in the text⟩.". |
| `listening` | `intro` "Listen and tap the right picture.", 4–6 `tasks`: `say` = a book sentence or a unit word, `question` "Which picture?", picture `options` (unit words; 2–3 for non-readers, up to 4 for readers), `answer`. |
| `speaking` | `prompts`: the unit words to repeat, then 2–4 book sentences (`mode: "repeat"`); a few `mode: "answer"` prompts whose `question` is a book question and `text` the book's answer. |
| `quiz` | About "questions per quiz" questions: `picture` and `tf` first when the child can't read instructions; plus `mc`, `fill`, `match`, `order` for readers. |
| `lessonPlan` | A home session of exactly "session minutes": steps `warm-up` → `learn` → `practice` → `play` → `review`, each with `minutes`, `activity` and a `parentScript` that says exactly what the parent says/does (with praise). Refer to the app's parts: Words, Listen, Speak, Sentences, Read, a game, Quiz, the printed Worksheet. |
| `test` | `minutes` 10–20; sections by skill (`listening`, `vocabulary`, `grammar` if the unit has a pattern, `reading` if it has a text), 2–4 questions each. |

### Step 7 — Assemble, check, fix, report

1. `node tools/book-package.mjs assemble resources/.work/<id> -v` (add `--out resources/packages/<id>.json` for a private book). It puts the units, lessons and drawings into the package (raising `version` when the content changed), runs `check`, and — for the default output — rebuilds `content/books/index.json`.
2. Fix every ❌ in the work files and assemble again until there are no errors. Fix every ⚠️ **rule 2** and **rule 4** warning unless there is a clear reason (say it in the report); look at the other ⚠️ and fix what is really wrong.
3. Report to the parent (in Vietnamese if the parent writes Vietnamese): book title, level and ages, a short table per unit (words, drawings, patterns, sentences, readings, lessons written), how each of the four rules was met (drawings made / redrawn, how many words have all three pictures, anything left as emoji and why), what you were unsure about (low confidence), and the next steps:
   - default output: push the repo to GitHub; the book appears in **Books** in every browser that opens the site;
   - private output: **Parent → Books → 📦 Import a book package** → choose `resources/packages/<id>.json`;
   - then **Children → Edit** → tick the book for the child;
   - optional: **📎 Add the book's PDF** in the book's page to see the book pages (for the parent) and to be able to choose the book's own pictures (in that browser only);
   - review the pictures: each unit → **📖 From the book** → *Picture your child sees*: ✏️ drawing / 📖 book picture / 😀 emoji per word, or **All words** for the whole unit → **💾 Save**.

Don't publish the PDF or page images anywhere, and don't commit anything in `resources/`.

---

## 5. Package format

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
  "units": [ { "…unit fields…": "", "items": [ { "type": "grammar", "title": "…", "data": { } } ] } ],
  "pictures": { "pizza": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\">…</svg>" }
}
```

- `book.id`: lower-case letters, digits, dashes — use the one from `tools/book-package.mjs id` (slug of the file name + first 8 hex digits of the file's SHA-256). Then the package joins the same book if the parent already added that PDF in the browser.
- `version`: a whole number ≥ 1. `assemble` raises it when the content changes; the site imports a package again only when its version is higher.
- Unit ids in the app are `<bookId>-u01`, `-u02`, … from `order` (don't write ids).
- `pictures`: word (lower case, no a/an/the) → SVG. `assemble` fills it from `pictures/*.svg`.

### Unit (`units/uNN.json`)

| Field | Type | Rule |
|---|---|---|
| `order` | integer ≥ 1 | unique |
| `title`, `topic` | string | required |
| `pages` | `[first, last]` | PDF page indexes, last ≥ first, ≤ pageCount |
| `vocabulary` | `[{ word, emoji, vi?, partOfSpeech?, page?, pic, show? }]` | ≥ 3 words, or the app can't make lessons |
| `vocabulary[].pic` | `{ page, box: [left, top, width, height] }` | fractions 0–1 of the page image; every word (rule 2) |
| `vocabulary[].show` | `"drawing"` \| `"book"` \| `"emoji"` | optional: the picture the child sees at first (left out = drawing, then book picture, then emoji) |
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
| `mc` | `prompt`, `emoji?`, `options` (2–4 strings), `answer` | answer is one of the options; a prompt with `___` is a book pattern |
| `picture` | `prompt` (spoken: "Find the cat."), `options` (2–4 `{ emoji, label }`), `answer` | answer equals one option's label; labels are unit words |
| `tf` | `statement`, `emoji?`, `answer` (true/false) | statement from the book (rule 1) |
| `fill` | `sentence` (contains `___`), `options` (2–4), `answer` | answer is one of the options; one right answer only |
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

## 6. Drawings

A drawing is a plain SVG picture (checked by `src/lib/safeSvg.js` — in `check`, in `pictures` and again when the app imports the package):

- starts with `<svg` and ends with `</svg>`, has a `viewBox` (use `0 0 256 256`);
- only these elements: `svg g path circle ellipse rect polygon polyline line defs linearGradient radialGradient stop clipPath mask filter feGaussianBlur feOffset feDropShadow feFlood feComposite feMerge feMergeNode feBlend text tspan`;
- `text` holds only a number (number words); no other letters or words anywhere;
- no `href` / `xlink:href`, no `<image>`, `<use>`, `<script>`, `<style>`, `<foreignObject>`, no `on…=` attributes, no `url(…)` except to an id inside the drawing (`url(#grad1)`), no comments or `<!…>`;
- at most 20 000 characters.

`svg()` of `tools/draw-kit.mjs` writes a valid wrapper and the gradients / clip paths the parts asked for. Example — a kitten sitting and looking at the child (in `draw-pictures.mjs`):

```js
import { svg, soft, ball, O, shadow, tube, eye, cheek, catMouth } from "../../../tools/draw-kit.mjs";
const fur = "#ffd54f";
P.kitten = svg(
  shadow(128, 232, 74) +                                                                     // on the ground
  tube("M168 216 C214 220 230 182 220 154", fur, 15) +                                       // tail
  `<path d="M84 224 C70 196 82 156 128 152 C174 156 186 196 172 224 C150 234 106 234 84 224 Z" fill="${soft(fur)}" ${O}/>` + // small body
  `<path d="M60 84 C54 56 58 34 70 24 C86 32 102 46 110 58 Z" fill="${soft(fur)}" ${O}/>` +  // ear (and the other one)
  `<ellipse cx="128" cy="108" rx="76" ry="64" fill="${ball(fur)}" ${O}/>` +                 // big head
  eye(98, 106, 15) + eye(158, 106, 15) + cheek(76, 132, 12) + cheek(180, 132, 12) + catMouth(128, 140, 9),
);
```

## 7. Level rules

The site computes the level from the grade (and from the content when the grade is unknown). `check` prints it; these are the numbers:

| Stage | Ages | Max words / sentence | Reading passage | Writing | Reads instructions | Choices per question | Questions / quiz | Session |
|---|---|---|---|---|---|---|---|---|
| pre-reader (preschool) | 3–5 | 4 | — | no | no | 2–3 | 5 | 10 min |
| early-reader (grade 1–2) | 6–8 | 6 | 20–40 words | yes | no | 2–3 | 6 | 15 min |
| developing-reader (grade 3–4) | 8–10 | 9 | 40–80 words | yes | yes | 2–4 | 8 | 20 min |
| independent-reader (grade 5) | 10–11 | 12 | 80–150 words | yes | yes | 2–4 | 10 | 25 min |

(Ages with a known grade are grade + 5 to grade + 6; the book's own reading texts are used as they are, whatever their length.)

## 8. Final checklist

- [ ] Every unit from the contents is there, in order, with the right PDF page ranges.
- [ ] **Rule 1** — words, sentences and reading texts are copied exactly from the pages; every sentence in the lessons is a book sentence, a book pattern with a book word, or (for a "No" question) a book sentence with one unit word swapped; `check` shows no ❌ rule 1.
- [ ] **Rule 2** — every word has its three pictures: a drawing in the cute sticker style that looks like the book's picture (checked on the `pictures` and `pictures --big` sheets: animals and people chibi, with big shiny eyes and rosy cheeks), a `pic` box that holds the book's picture, and one emoji that the lessons use; `check` shows no ⚠️ rule 2 (or the report says why).
- [ ] **Rule 3** — every reading passage is a book text, word for word, with its line breaks.
- [ ] **Rule 4** — one idea per question, the standard short instructions, at most 3 choices for non-readers, sentences within the level's limit, short friendly explanations; `check` shows no ⚠️ rule 4.
- [ ] Each unit has the lesson types it can have (`grammar` when it has a pattern, `reading` when it has a text).
- [ ] `node tools/book-package.mjs assemble …` shows **0 errors**.
- [ ] Default output: `content/books/index.json` lists the new version. Private output: the file is in `resources/packages/`.
- [ ] Nothing from `resources/` is committed or published.
