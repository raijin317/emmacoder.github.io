# Emma English Studio — bản web tĩnh (GitHub Pages)

Góc học tiếng Anh cho gia đình: phụ huynh soạn bài từ sách giáo khoa của con, bé học bằng thẻ từ, nghe, nói, đọc, quiz và 11 trò chơi, nhận sao, sticker và cúp.

**Mở ứng dụng:** https://emmacoder.github.io/

Đây là bản chuyển từ ứng dụng desktop `01_Dashbord_ENG` (Next.js + SQLite + Claude Code) sang website tĩnh chỉ gồm HTML, CSS và JavaScript — không cần server, không cần build để chạy.

## Khác gì so với bản desktop

| | Bản desktop | Bản web tĩnh |
|---|---|---|
| Dữ liệu | SQLite trên máy (`data/app.db`) | SQLite (sql.js) **trong trình duyệt**, lưu ở IndexedDB của máy đang dùng |
| Thêm sách | Claude đọc PDF, tự tìm unit và từ vựng | Nhờ Claude (Claude Code) tạo **gói sách** theo `Import_Book.md`; hoặc tự thêm: PDF được dựng trang ngay trong trình duyệt, phụ huynh tự thêm unit và gõ từ / mẫu câu / câu / bài đọc, chọn hình từ trang sách |
| Tạo bài học | Claude + bộ dựng offline | **Bộ dựng offline** (đủ 10 loại: từ vựng, nghe, nói, ngữ pháp từ mẫu câu, đọc, 2 trò chơi, quiz, phiếu bài tập, giáo án, bài kiểm tra) |
| Inspiration topic | Tạo bằng AI Studio (chat với Claude) | Form **➕ New topic** (tiêu đề, danh sách từ + emoji, mẫu câu, câu, bài đọc); mở / lưu topic dạng file JSON |
| Giọng đọc | Kokoro chạy trên máy (Node) | Mặc định giọng trình duyệt; bật **giọng tự nhiên Kokoro** trong Settings → tải 1 lần (~90 MB), chạy ngay trong trình duyệt |
| AI Studio, Claude vẽ hình topic | Có | Không (bản tĩnh không dùng AI) |

Giữ nguyên: giao diện, màn hình bé (My World, Bonus islands, sticker album 14 trang, cúp, level), trả lời sai → thử lại, 11 mini game, PIN phụ huynh, Lesson rules, trình sửa bài dạng form, Present (TV), Print (A4 + đáp án), thống kê tuần, từ hay sai, mục tiêu mỗi ngày, nhắc nghỉ, backup/restore (đọc được cả file backup của bản desktop).

## Cách dùng (cho phụ huynh)

1. Mở https://emmacoder.github.io/ bằng Chrome hoặc Edge. Lần đầu có sẵn **sách demo** và bé **Little Star** để thử.
2. Bấm **Parent** → tạo PIN 4 số.
3. **Books → 📤 Add a PDF book** (hoặc tạo sách không có PDF). Vào sách → **➕ Add unit** cho từng unit (tên, trang).
4. Mở từng unit → tab **📖 From the book**: thêm từ (kèm emoji), bấm 📷 để khoanh hình của từ trên trang sách, thêm mẫu câu (`I have a ___.`), câu và bài đọc → **✅ approve unit** → **✨ Make this unit's lessons** (hoặc ở trang sách: **✨ Make lessons for all units**).
5. **Children → Edit**: chọn sách (và topic) cho bé.
6. Bé bấm vào avatar của mình và học.

**Quan trọng:** dữ liệu chỉ nằm trong trình duyệt của máy đang dùng. Xoá dữ liệu trình duyệt hoặc dùng cửa sổ ẩn danh là mất. Thỉnh thoảng vào **Settings → 💾 Export backup** để giữ một bản; muốn chuyển sang máy khác thì **Restore from file** ở máy đó (file PDF không nằm trong backup — thêm lại PDF ở máy mới để thấy trang sách và hình).

Chuyển dữ liệu từ bản desktop: ở app cũ vào Settings → Export backup → ở web này vào Settings → Restore from file.

## Nhập sách bằng Claude (Import_Book.md)

Muốn có bộ bài học đầy đủ như tính năng "Import Book" của bản desktop: đặt PDF vào `resources/book/` (không bao giờ được đưa lên GitHub) và nói với Claude *"Đọc Import_Book.md và import sách `resources/book/<tên file>.pdf`"*. Claude đọc sách, **vẽ hình cho từng từ** (giống hình trong sách, kiểu hoạt hình dễ thương, hiện cho bé mà không cần PDF), viết từng unit và các bài học theo 4 quy tắc bài học, rồi tạo **gói sách** `content/books/<bookId>.json`. Mỗi từ có 4 lựa chọn hình — 🖼️ ảnh phụ huynh tự tải lên (nút ⬆️, ảnh được thu nhỏ và lưu trong trình duyệt + bản backup), ✏️ hình Claude vẽ, 📖 hình trong sách (khi đã thêm PDF), 😀 emoji — phụ huynh chọn ở trang unit → **📖 From the book** → *Picture your child sees*:

- Gói trong `content/books/` (liệt kê ở `content/books/index.json`) được web **tự nạp** khi mở — push lên GitHub là mọi trình duyệt đều có sách đó. Gói có phiên bản mới thì được nạp lại, nhưng phần phụ huynh đã sửa được giữ nguyên.
- Muốn **riêng tư** thì nói thêm "giữ riêng tư": gói nằm ở `resources/packages/` và bạn tự nhập bằng **Parent → Books → 📦 Import a book package**.
- Kiểm tra một gói: `node tools/book-package.mjs check content/books/<bookId>.json -v`.

## Chạy thử trên máy

Trình duyệt không chạy ES module từ `file://`, nên cần một server tĩnh bất kỳ:

```
node tools/serve.mjs        # http://127.0.0.1:8080
```

## Đưa lên GitHub Pages

Repo tên `emmacoder.github.io` nên GitHub Pages phục vụ ở địa chỉ gốc. Đẩy toàn bộ thư mục lên nhánh `main`, rồi trong **Settings → Pages** chọn *Deploy from a branch* → `main` / `(root)`. Không cần bước build nào. File `.nojekyll` để GitHub không xử lý thư mục bằng Jekyll; `404.html` chuyển các đường dẫn như `/learn` về `/#/learn`.

## Cấu trúc

```
index.html            trang duy nhất: import map + nạp src/main.js
404.html, .nojekyll   cho GitHub Pages
assets/app.css        CSS đã biên dịch (Tailwind 4), assets/icon.svg
vendor/               thư viện đóng gói sẵn: React 19.3, htm 3.1, zod 4.6, sql.js 1.13 (wasm), pdf.js 6.5, kokoro-js 1.2
src/main.js           khởi động: mở CSDL, gắn API nội bộ, router theo #/đường-dẫn
src/shims/            thay next/link và next/navigation (router dùng dấu #)
src/lib/              logic dùng chung (schemas, quickPack, games, speech, assessment…); tts.js + tts-worker.js = giọng Kokoro
src/components/       giao diện chung (kids, ui, Pic, ApiImg)
src/features/         các màn hình (child, parent, players, present, print)
src/server/           "server" chạy trong trình duyệt: db.js (sql.js + IndexedDB), repo.js, routes.js (các /api/…),
                      books/pages.js (dựng trang PDF, cắt hình), books/resources.js, topics.js
tools/                app.src.css (nguồn CSS), serve.mjs (server thử), book-package.mjs (tạo / kiểm tra gói sách),
                      draw-kit.mjs (bộ công cụ vẽ hình cho gói sách)
content/books/        gói sách do Claude tạo theo Import_Book.md (index.json + <bookId>.json)
Import_Book.md        chỉ dẫn cho Claude khi nhập một sách PDF
```

Mã giao diện viết bằng JavaScript thuần với [htm](https://github.com/developit/htm) — cú pháp giống JSX nhưng chạy thẳng trong trình duyệt:

```js
html`<${Button} variant="sun" onClick=${go}>Hi<//>`   // = <Button variant="sun" onClick={go}>Hi</Button>
```

Các màn hình vẫn gọi `fetch("/api/…")` như bản cũ; `src/server/routes.js` trả lời các yêu cầu đó ngay trong trang.

## Sửa giao diện

Sửa file trong `src/` rồi tải lại trang. Nếu thêm **class Tailwind mới** thì biên dịch lại CSS:

```
npm install
npm run build:css
```
