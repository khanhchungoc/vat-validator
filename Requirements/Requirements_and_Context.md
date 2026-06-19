# Requirements and Context: VAT Invoice Validation App

## 1. The Problem Statement
The goal is to automate the validation of VAT e-invoices (hóa đơn điện tử đầu vào). 
- **Input:** A batch of up to 50-100 invoices, supplied via either:
  - **XML upload** — drag and drop one or more XML e-invoice files (auto-parsed)
  - **Manual entry** — user fills in a form with the required fields (fallback when XML is unavailable)
  - Both methods can be **mixed** in the same batch (e.g. 30 XML files + 5 manual entries)
- **Task 1:** Look up the invoice details on the General Department of Taxation website (`hoadondientu.gdt.gov.vn`) to see if it is valid. Take a screenshot of the result.
- **Task 2:** Look up the business details (Tax Code) on the National Business Registration portal to verify the business name and address. Take a screenshot of the result.
- **Output:** Two files saved to an **auto-created session folder** for each upload batch:
  - Folder path: `output/YYYY-MM-DD_HH-MM-SS/` (created automatically on upload)
  1. **`results.pdf`** — one page per invoice containing:
     - Header: Invoice Code, Invoice Number, Total Amount, Seller name, Tax ID
     - Screenshot from Website 1 (invoice validity result)
     - Screenshot from Website 2 (business registration result)
  2. **`summary.xlsx`** — Excel file with bold headers and color-coded status rows:
     - Columns: Invoice No. | Invoice Code | Seller Name | Tax ID | Amount | Status
     - 🟢 Green row = Pass | 🔴 Red row = Invalid Invoice or Invalid Business
     - Generated via the `xlsx` npm package.
- **Challenge:** Both government websites use CAPTCHAs to prevent automated bots. There is no official public API.

## 2. Context & Information Needed Before Coding
1. A sample XML invoice file to test the parser: [1159855_1_C26MGG.xml](file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/Requirements/Sample%20invoices/1159855_1_C26MGG/1159855_1_C26MGG/1159855_1_C26MGG.xml)

**Context Websites:**
1. 1st website to look up (Invoice details): https://hoadondientu.gdt.gov.vn/
2. 2nd website to look up (Tax code/Business Registration): https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp

**Required XML Fields to Parse:**
- `DLHDon.KHHDon`: Invoice Code
- `DLHDon.SHDon`: Invoice Number
- `DLHDon.NDHDon.NBan.Ten`: Seller business name
- `DLHDon.NDHDon.NBan.MST`: Seller Tax ID number
- `DLHDon.NDHDon.NBan.DChi`: Seller Address
- `DLHDon.NDHDon.TToan.TgTTTBSo`: Total invoice amount (in VND, numeric)

**Sample values from [1159855_1_C26MGG.xml](file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/Requirements/Sample%20invoices/1159855_1_C26MGG/1159855_1_C26MGG/1159855_1_C26MGG.xml):**
- `KHHDon` = `C26MGG`
- `SHDon` = `1159855`
- `NBan.Ten` = `CÔNG TY CỔ PHẦN TẬP ĐOÀN GOLDEN GATE - CHI NHÁNH MIỀN BẮC`
- `NBan.MST` = `0102721191-068`
- `NBan.DChi` = `Tầng 6, Tòa nhà Toyota, 315 Trường Chinh, Phường Phương Liệt, Thành phố Hà Nội, Việt Nam`
- `TgTTTBSo` = `1355980`

## 3. Form Field Mapping

### Website 1: `hoadondientu.gdt.gov.vn` (Invoice Lookup)

| Website Form Field | XML Field | Sample Value |
|---|---|---|
| Ký hiệu hóa đơn (Invoice Symbol/Code) | `DLHDon.KHHDon` | `C26MGG` |
| Số hóa đơn (Invoice Number) | `DLHDon.SHDon` | `1159855` |
| Tổng tiền thanh toán (Total Amount) | `DLHDon.NDHDon.TToan.TgTTTBSo` | `1355980` |
| Mã captcha | *(manually entered by user)* | — |

### Website 2: `tracuunnt.gdt.gov.vn` (Business/Tax Code Lookup)

| Website Form Field | XML Field | Sample Value |
|---|---|---|
| Mã số thuế (Tax ID) | `DLHDon.NDHDon.NBan.MST` | `0102721191-068` |
