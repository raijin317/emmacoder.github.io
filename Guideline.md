Viết cho: Claude (một phiên Claude Code sau này làm việc trong repo này).

Tôi đã tạo Import_Book.md ở gốc repo. Sau này bạn chỉ cần đặt PDF vào resources/book/ rồi nói với Claude: "Đọc Import_Book.md và import sách resources/book/<tên file>.pdf". Nếu không muốn nội dung sách lên web public, nói thêm "giữ riêng tư".

Nội dung file hướng dẫn — chép lại đúng các bước và luật của tính năng "Import Book" bản cũ:
1.Đọc tổng quan sách: bìa, mục lục → tên sách, lớp, danh sách unit với số trang PDF (không phải số in trên trang).

2.Đọc từng unit (tối đa 8 trang mỗi lượt): từ vựng kèm emoji, nghĩa tiếng Việt, vị trí hình của từ trên trang sách; mẫu câu có ___; câu và bài đọc chép nguyên văn.

3.Xem cấp độ web tính từ sách: số từ tối đa mỗi câu, số câu hỏi mỗi quiz…

4.Viết 7 loại bài cho mỗi unit: grammar, reading, listening, speaking, quiz, lessonPlan, test. Web tự làm thêm từ vựng, 2 trò chơi và phiếu bài tập, giống bản cũ.

5.Tuân 4 luật bài học:
chỉ dùng từ có trong sách;
dùng đúng emoji của từ để web thay bằng hình trong sách;
bài đọc phải là chữ trong sách;
viết dễ hiểu cho bé.
File cũng mô tả đầy đủ định dạng dữ liệu và có checklist cuối.

Thứ tôi phải thêm vào web để Claude có chỗ giao kết quả (bản tĩnh trước đó chưa nhận được gói sách):

Gói sách content/books/<bookId>.json: web tự nạp khi mở trang. Khi có phiên bản mới thì nạp lại, nhưng unit hay bài học phụ huynh đã sửa thì giữ nguyên. Sách phụ huynh đã xoá thì không tự quay lại.
Nút "📦 Import a book package" ở trang Books, dùng cho gói giữ riêng tư.
Công cụ tools/book-package.mjs: lấy mã sách từ PDF, gom file làm việc của từng unit thành một gói, kiểm tra gói bằng chính schema và luật của web (báo bài nào sẽ bị loại, emoji nào lệch, câu nào dài quá cấp độ).
.gitignore thêm resources/: file PDF và file làm việc của Claude không bao giờ lên GitHub.
Lưu dữ liệu ngay: mọi thay đổi giờ được lưu vào trình duyệt trước khi giao diện báo xong. Trước đây nếu tải lại trang quá nhanh sau khi sửa thì có thể mất thay đổi.
Kiểm tra: tôi thử với một gói mẫu 2 unit, có cố ý một quiz dùng từ không có trong sách. Kết quả:

Web tự nạp gói, bài quiz vi phạm bị loại và được làm lại bằng bộ offline.
Lên phiên bản 2 thì chỉnh sửa của phụ huynh vẫn còn.
Nút nhập file hoạt động; file sai báo lỗi rõ ràng.
Toàn bộ test cũ vẫn qua, không có lỗi console. Gói mẫu đã được gỡ, content/books/index.json đang rỗng.

Cần lưu ý:

Nội dung chép lên web: gói trong content/books/ chứa từ, câu và bài đọc chép nguyên văn từ sách giáo khoa và sẽ public trên github.io. Trang sách và hình thì không: muốn thấy hình trong sách, mở sách trong Books → "📎 Add the book's PDF" với đúng file PDF đó, trên từng trình duyệt.
Hiệu quả thật chưa được thử: độ chính xác khi Claude đọc sách scan thật và khoanh hình từ chưa được kiểm chứng trên một cuốn sách thật — lần import đầu nên xem lại vài unit.