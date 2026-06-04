# Design Specification: Vietnamese Translation & A4 Landscape PDF

**Date**: 2026-06-04
**Topic**: Translate all UI, logs, status labels, and generated reports into Vietnamese. Ensure PDF export layout correctly uses A4 horizontal page size.

---

## 1. Requirements

### 1.1 Translation Scope
All user-visible interface elements, messages, modal dialogs, status badges, automation activity logs, and generated export summaries (PDF and Excel) must be translated into Vietnamese. The product brand name "VAT-validator" will be kept in English.

### 1.2 PDF Export Page Size
The PDF results export must use the A4 page size horizontally (landscape orientation). The font must support Vietnamese character sets (Unicode).

---

## 2. Detailed Technical Design

### 2.1 React Frontend Translations
All React components in `src/` and `src/components/` will have their text strings directly updated to Vietnamese.

#### App.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/App.jsx)
- Update WebSocket status indicators (Connected ✅, Connecting..., Disconnected).
- Update error banner headings and descriptions (e.g. "Processing Error" -> "Lỗi xử lý", "Failed to start processing..." -> "Lỗi bắt đầu xử lý: WebSocket mất kết nối.").
- Translate action buttons:
  - "Start Processing" -> "🚀 Bắt đầu xử lý"
  - "Reset Skipped to Pending" -> "🔄 Khôi phục trạng thái Chờ"
  - "Add Invoice Manually" -> "＋ Thêm hóa đơn thủ công"
  - "Clear & New Session" -> "🧹 Xóa & Phiên mới"
  - "Stop" -> "🛑 Dừng"
  - "Activity Log" / "Close Log" -> "📋 Nhật ký hoạt động" / "✕ Đóng nhật ký"

#### CaptchaModal.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/CaptchaModal.jsx)
- "CAPTCHA Solve Required" -> "🔑 Yêu cầu giải mã CAPTCHA"
- Help text: "Enter the CAPTCHA below, or click directly on the opened browser window to solve it on the site." -> "Nhập mã CAPTCHA bên dưới hoặc giải trực tiếp trên trình duyệt đang mở."
- Warning text: "Incorrect CAPTCHA entered. Please try GDT's refreshed code (Attempt {attempt})" -> "❌ Mã CAPTCHA không chính xác. Vui lòng nhập mã mới từ GDT (Lần thử {attempt})"
- Placeholder: "Enter CAPTCHA..." -> "Nhập mã CAPTCHA..."
- Submit button: "Verify" -> "Xác nhận"
- Live info: "Or solve directly in the GDT browser window..." -> "Hoặc giải trực tiếp trên trình duyệt GDT..."
- Skip button: "Skip Invoice" -> "Bỏ qua hóa đơn"

#### DownloadButtons.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/DownloadButtons.jsx)
- Header: "Batch Complete — Download Results" -> "Hoàn thành loạt xử lý — Tải kết quả"
- PDF link: "Download PDF" -> "📄 Tải tệp PDF"
- Excel link: "Download Excel Summary" -> "📊 Tải tệp Excel tổng hợp"

#### DropZone.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/DropZone.jsx)
- "Uploading..." -> "Đang tải lên..."
- "Processing active..." -> "🔒 Đang trong quá trình xử lý..."
- "Drop XML files here or click to browse" -> "📂 Kéo thả các tệp XML vào đây hoặc click để duyệt tệp"

#### DuplicateWarning.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/DuplicateWarning.jsx)
- Header: "Duplicate Invoices Detected" -> "⚠️ Phát hiện hóa đơn trùng lặp"
- Help text: "The following invoice IDs already exist..." -> "Các mã hóa đơn sau đã tồn tại trong hàng đợi. Vui lòng loại bỏ hoặc tiếp tục."
- Buttons: "Remove Duplicates" -> "Loại bỏ trùng lặp", "Proceed Anyway" -> "Vẫn tiếp tục"

#### ErrorBanner.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/ErrorBanner.jsx)
- "Processing Paused" -> "Đang tạm dừng xử lý"
- "Skip Invoice" -> "Bỏ qua hóa đơn"
- "Retry" -> "Thử lại"

#### InvoiceQueue.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/InvoiceQueue.jsx)
- "Invoice Queue ({count})" -> "Hàng đợi hóa đơn ({count})"
- Statuses:
  - `pending` -> "Đang chờ"
  - `processing` -> "Đang xử lý..."
  - `pass` -> "✅ Hợp lệ"
  - `invalid-invoice` -> "❌ Hóa đơn không hợp lệ"
  - `invalid-business` -> "❌ DN không hoạt động"
  - `skipped` -> "⚠️ Đã bỏ qua"

#### LiveConsole.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/LiveConsole.jsx)
- "Live Activity Log" -> "Nhật ký hoạt động thời gian thực"
- Placeholder text: "Waiting for automation to start. Real-time steps will appear here..." -> "Đang chờ tiến trình tự động bắt đầu. Các bước thực hiện sẽ hiển thị ở đây..."

#### ManualEntryForm.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/ManualEntryForm.jsx)
- Title: "Add Invoice Manually" -> "Thêm hóa đơn thủ công"
- Field validation: "Required fields missing..." -> "Thiếu các thông tin bắt buộc: {missing}"
- Amount validation: "Total Amount must be a valid positive number." -> "Tổng tiền phải là số dương hợp lệ."
- Input labels:
  - "Invoice Code (Ký hiệu)" -> "Ký hiệu hóa đơn"
  - "Invoice Number (Số HĐ)" -> "Số hóa đơn"
  - "Seller Name" -> "Tên người bán"
  - "Tax ID (MST)" -> "Mã số thuế (MST)"
  - "Seller Address" -> "Địa chỉ người bán"
  - "Total Amount (VND)" -> "Tổng tiền (VND)"
- Action buttons: "Cancel" -> "Hủy", "Add Invoice" -> "Thêm hóa đơn"

#### ModeToggle.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/ModeToggle.jsx)
- Label: "Processing Mode:" -> "Chế độ xử lý:"
- Options: "Auto" -> "▶ Tự động", "Step" -> "👣 Từng bước"

#### ProgressBar.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/ProgressBar.jsx)
- "invoices processed" -> "hóa đơn đã xử lý"
- "Pass" -> "Hợp lệ", "Failed" -> "Lỗi/Không hợp lệ", "Skipped" -> "Đã bỏ qua"

#### ResumePanel.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/ResumePanel.jsx)
- "Resume Previous Sessions" -> "📁 Khôi phục phiên làm việc trước"
- "{done}/{total} invoices completed" -> "Đã hoàn thành {done}/{total} hóa đơn"
- Confirmation warning: "Are you sure you want to permanently delete the session..." -> "Bạn có chắc chắn muốn xóa vĩnh viễn phiên làm việc này không? Thao tác này không thể hoàn tác."
- Buttons: "Delete" -> "Xóa", "Resume" -> "Tiếp tục"

#### StepButton.jsx (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/StepButton.jsx)
- Text: "Review done — Step → Next Invoice" -> "Xác nhận xem xong — Tiếp tục → Hóa đơn kế tiếp"

---

### 2.2 Backend Automation Log Translations
All logged messages sent to the UI via `logStep` will be translated to Vietnamese.

#### automationEngine.js (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/backend/automation/automationEngine.js)
- "Phase 1 complete..." -> "Hoàn thành Pha 1. Bắt đầu tra cứu Mã số thuế trên Cổng thông tin NNT..."

#### gdtInvoicePortal.js (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/backend/automation/gdtInvoicePortal.js)
- Navigations and statuses:
  - "Site load check failed. Reloading GDT Portal..." -> "Kiểm tra tải trang thất bại. Đang tải lại Cổng thông tin HĐĐT..."
  - "Verifying GDT Portal loaded..." -> "Đang xác minh Cổng thông tin HĐĐT tải thành công..."
  - "GDT Portal loaded successfully!" -> "Cổng thông tin HĐĐT đã tải thành công!"
  - "Navigating to GDT Portal..." -> "Đang truy cập Cổng thông tin HĐĐT..."
  - "Bypassing announcement popup..." -> "Đang đóng thông báo popup..."
  - "Already on GDT Portal. Resetting form..." -> "Đã ở trên Cổng thông tin HĐĐT. Đang đặt lại các trường dữ liệu..."
  - "Filling invoice details: Seller Tax ID..." -> "Đang điền thông tin hóa đơn: MST bán ({taxId}), Ký hiệu, Số HĐ, Tổng tiền..."
  - "Capturing CAPTCHA image..." -> "Đang chụp ảnh mã CAPTCHA..."
  - "Please solve the CAPTCHA..." -> "Vui lòng giải CAPTCHA trực tiếp trên trình duyệt GDT đang mở..."
  - "Typing CAPTCHA answer..." -> "Đang nhập mã CAPTCHA vào ô xác thực..."
  - "GDT returned HTTP 401 (Incorrect CAPTCHA)..." -> "Cổng thông tin báo lỗi CAPTCHA (401). Đang làm mới và thử lại..."
  - "GDT returned HTTP 200 (Invoice not found)..." -> "Cổng thông tin phản hồi: Không tìm thấy hóa đơn. Đang chụp ảnh màn hình lỗi..."
  - "GDT returned HTTP 200 (Invoice verified!)..." -> "Cổng thông tin phản hồi: Hóa đơn hợp lệ! Đang chụp ảnh màn hình kết quả..."
  - "API response timed out or failed..." -> "Hết thời gian phản hồi API hoặc lỗi. Đang chuyển sang xác minh trên giao diện DOM..."

#### gdtTaxpayerPortal.js (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/backend/automation/gdtTaxpayerPortal.js)
- Navigations and statuses:
  - "Navigating to Taxpayer Portal..." -> "Đang truy cập Cổng thông tin người nộp thuế..."
  - "Already on Taxpayer Portal. Resetting..." -> "Đã ở trên Cổng thông tin NNT. Đang đặt lại các trường dữ liệu..."
  - "Capturing CAPTCHA image..." -> "Đang chụp ảnh mã CAPTCHA..."
  - "Please solve the CAPTCHA..." -> "Vui lòng giải CAPTCHA trực tiếp trên trình duyệt GDT đang mở..."
  - "Typing CAPTCHA answer..." -> "Đang nhập mã CAPTCHA vào ô xác thực..."
  - "GDT returned 'Vui lòng nhập đúng mã xác nhận!'..." -> "Cổng thông tin báo sai mã xác nhận. Đang làm mới và thử lại..."
  - "Verification successful! Capturing status..." -> "Xác thực thành công! Đang chụp ảnh trạng thái hoạt động của doanh nghiệp..."
  - "Taxpayer not found..." -> "Không tìm thấy thông tin người nộp thuế (Doanh nghiệp không hợp lệ/không hoạt động). Đang chụp ảnh lỗi..."
  - "CAPTCHA incorrect or timeout..." -> "Sai mã CAPTCHA hoặc hết thời gian chờ. Đang làm mới và thử lại..."

---

### 2.3 Generated Export Files Translations & Layout

#### pdfGenerator.js (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/backend/output/pdfGenerator.js)
- Translate layout header: "Invoice: {code} / {number}" -> "Hóa đơn: {code} / {number}"
- Translate status badge labels to fit landscape layout nicely:
  - `pass` -> "HỢP LỆ"
  - `invalid-invoice` -> "HÓA ĐƠN KHÔNG HỢP LỆ"
  - `invalid-business` -> "DN KHÔNG HOẠT ĐỘNG"
  - `skipped` -> "ĐÃ BỎ QUA"
- Translate meta table headers:
  - "Seller" -> "Người bán"
  - "Tax ID" -> "Mã số thuế"
  - "Address" -> "Địa chỉ"
  - "Total Amount" -> "Tổng tiền"
- Translate screenshot headers:
  - "GDT Invoice Portal..." -> "Cổng thông tin HĐĐT TCT — hoadondientu.gdt.gov.vn"
  - "GDT Taxpayer Portal..." -> "Cổng thông tin NNT TCT — tracuunnt.gdt.gov.vn"
  - "Not captured" -> "Không chụp được"
- Ensure horizontal (A4 landscape) size settings:
  - In CSS: `@page { size: A4 landscape; margin: 12mm; }`
  - Playwright: `await page.pdf({ path: outputPath, format: 'A4', landscape: true, printBackground: true })`
  - Font styling includes fallback to standard system sans-serif fonts supporting Vietnamese Unicode accents.

#### xlsxGenerator.js (file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/backend/output/xlsxGenerator.js)
- Translate Excel status mapping:
  - `pass` -> "Hợp lệ"
  - `invalid-invoice` -> "Hóa đơn không hợp lệ"
  - `invalid-business` -> "Doanh nghiệp không hoạt động"
  - `skipped` -> "Đã bỏ qua"
  - `pending` -> "Đang chờ"
- Translate row table headers:
  - `['STT', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Tên người bán', 'Mã số thuế', 'Tổng tiền (VND)', 'Trạng thái']`
  - Adjust sheet column widths to ensure Vietnamese characters are not truncated (e.g., Seller Name to width 50, Status to width 25, Ký hiệu hóa đơn to width 18).

---

## 3. Verification Plan

1. **Unit Tests**:
   - Run the existing test suite: `npm run test` or backend tests in `backend/__tests__`.
   - Update tests to match translated strings (e.g., Excel header labels, PDF status badge strings, etc.) to ensure tests pass.
2. **End-to-End Visual Check**:
   - Verify that all translated terms render correctly in the Electron app interface.
   - Run a test session and download the generated PDF and Excel reports to check they are in Vietnamese, and that the PDF is correctly formatted as horizontal A4.
