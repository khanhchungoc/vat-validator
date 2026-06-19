# VATOCR — VAT Invoice Validation App: Design Spec
**Date:** 2026-05-29  
**Status:** Approved

---

## 1. Problem Statement

Accountants need to validate batches of Vietnamese VAT e-invoices (hóa đơn điện tử đầu vào) by cross-checking them against two government websites. This is currently done manually — one invoice at a time — which is slow and error-prone for batches of 50–100 invoices.

**Goal:** Build a desktop app that automates the browser interactions, pauses only for human CAPTCHA solving, and produces printable evidence files (PDF + Excel) for each batch.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Electron Shell                     │
│  ┌─────────────────────┐   ┌───────────────────────┐│
│  │   React Frontend    │◄──┤   Node.js Backend     ││
│  │   (Vite + CSS)      │WS │   (Express + WS)      ││
│  │                     │──►│                       ││
│  │  - Invoice queue    │   │  - XML parser         ││
│  │  - CAPTCHA modal    │   │  - Playwright engine  ││
│  │  - Status cards     │   │  - PDF generator      ││
│  │  - Step/Auto toggle │   │  - XLSX generator     ││
│  │  - Download buttons │   │  - Session manager    ││
│  └─────────────────────┘   └──────────┬────────────┘│
└─────────────────────────────────────── │ ────────────┘
                                         │ Playwright
                              ┌──────────▼────────────┐
                              │   Headless Chromium    │
                              │  hoadondientu.gdt.gov.vn│
                              │  tracuunnt.gdt.gov.vn  │
                              └───────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Desktop wrapper | **Electron** | Native OS window frame (Windows title bar) |
| Packaging | `electron-builder` | Produces `.exe` installer; bundles everything |
| Backend | Node.js + Express | Runs as child process inside Electron |
| Automation | Playwright (Chromium) | Bundled inside installer (~150MB) |
| XML parsing | `fast-xml-parser` | Parses Vietnamese e-invoice XML format |
| PDF generation | Playwright `page.pdf()` | No extra library needed |
| Excel generation | `xlsx` npm package | Bundled in installer |
| Frontend | Vite + React + CSS | Glassmorphism design, rendered in Electron window |
| Real-time comms | WebSocket | Internal localhost connection |

> All npm dependencies are bundled into the `.exe` — no installation required on target machines.

---

## 4. Input

Users build the invoice queue via one or both methods, mixable in the same batch:

### 4a. XML Upload (Primary)
- Drag and drop one or more `.xml` e-invoice files onto the dashboard
- Backend parses each file instantly and adds it to the queue

**Required XML fields:**

| XML Path | Field | Sample Value |
|---|---|---|
| `DLHDon.KHHDon` | Invoice Code | `C26MGG` |
| `DLHDon.SHDon` | Invoice Number | `1159855` |
| `DLHDon.NDHDon.NBan.Ten` | Seller Name | `CÔNG TY CỔ PHẦN TẬP ĐOÀN GOLDEN GATE...` |
| `DLHDon.NDHDon.NBan.MST` | Seller Tax ID | `0102721191-068` |
| `DLHDon.NDHDon.NBan.DChi` | Seller Address | `Tầng 6, Tòa nhà Toyota...` |
| `DLHDon.NDHDon.TToan.TgTTTBSo` | Total Amount (VND) | `1355980` |

### 4b. Manual Entry (Fallback)
- Click **"Add Invoice Manually"** to open an inline form
- Same 6 fields as above
- Used when XML file is unavailable

---

## 5. Form Field Mapping (Website → XML)

### Website 1: `hoadondientu.gdt.gov.vn` (Invoice Lookup)

| Form Field | XML Field |
|---|---|
| Ký hiệu hóa đơn (Invoice Code) | `KHHDon` |
| Số hóa đơn (Invoice Number) | `SHDon` |
| Tổng tiền thanh toán (Total Amount) | `TgTTTBSo` |
| Mã captcha | Manual user input |

### Website 2: `tracuunnt.gdt.gov.vn` (Tax Code Lookup)

| Form Field | XML Field | Note |
|---|---|---|
| Mã số thuế (Tax ID) | `NBan.MST` | Strip branch suffix (e.g. `-068`) before submitting |

---

## 6. Processing Workflow

### Step 1 — Build Queue
User uploads XMLs and/or adds manual entries. Duplicate invoice numbers trigger a warning before processing starts.

### Step 2 — Choose Mode
Toggle visible on dashboard before pressing Start:
- **▶ Auto Mode** *(default)* — Continuous. Only pauses for CAPTCHA. Next invoice starts automatically after each solve.
- **👣 Step Mode** — Pauses after each invoice completes. User reviews screenshots, then clicks **"Step →"** to continue. Mode can be switched between invoices at any time.

### Step 3 — Execute (per invoice)
1. Playwright navigates to Website 1, fills the form
2. Captures CAPTCHA image → sends to frontend via WebSocket
3. **CAPTCHA modal** appears on dashboard:
   - User types answer → submits
   - If wrong: Playwright detects failure, captures new CAPTCHA, modal auto-refreshes
   - **"Skip Invoice"** button always visible → marks invoice ⚠️ Skipped
4. Playwright submits form → waits for `networkidle` → screenshots result
5. Playwright navigates to Website 2, fills Tax ID (branch suffix stripped), submits
6. Screenshots result
7. Invoice card on dashboard updates with status badge
8. In Step Mode: UI highlights completed invoice, waits for **"Step →"** click
9. `session.json` updated with latest progress

### Step 4 — Generate Output
When all invoices are processed (or user clicks "Generate now"):
- `results.pdf` assembled from all invoice pages
- `summary.xlsx` generated with color-coded rows
- Download buttons appear in the dashboard

---

## 7. Output

Both files saved to an auto-created session folder:

```
output/
└── 2026-05-29_23-09-00/        ← timestamped per batch
    ├── session.json             ← live checkpoint (written throughout)
    ├── screenshots/             ← raw screenshots per invoice
    │   ├── invoice_001_site1.png
    │   ├── invoice_001_site2.png
    │   └── ...
    ├── results.pdf              ← generated at end
    └── summary.xlsx             ← generated at end
```

### `results.pdf`
- One A4 page per invoice
- Layout: metadata header (Invoice Code, Number, Amount, Seller, Tax ID) + Website 1 screenshot + Website 2 screenshot side by side
- Generated via Playwright `page.pdf()`

### `summary.xlsx`
- Columns: Invoice No. | Invoice Code | Seller Name | Tax ID | Amount | Status
- Color-coded rows: 🟢 Pass | 🔴 Invalid Invoice | 🔴 Invalid Business | ⚠️ Skipped
- Bold headers, generated via `xlsx` package

---

## 8. Invoice Statuses

| Status | Condition |
|---|---|
| ✅ **Pass** | Valid on Website 1 AND business found on Website 2 |
| ❌ **Invalid Invoice** | Failed Website 1 (not found or marked invalid) |
| ❌ **Invalid Business** | Failed Website 2 (tax code not found or invalid) |
| ⚠️ **Skipped** | User chose to skip (CAPTCHA unsolvable or website error) |

---

## 9. Session Persistence & Resume

- `session.json` is written after every invoice completes
- Tracks: invoice list, per-invoice status, which screenshots are saved, overall progress
- On app launch, dashboard scans `output/` for folders with `status: "incomplete"` in `session.json`
- **"Resume Sessions"** panel lists abandoned sessions by date
- Clicking Resume loads the queue, skips completed invoices, resumes from the next pending one

---

## 10. Edge Cases & Handling

| Scenario | Behaviour |
|---|---|
| CAPTCHA wrong answer | Auto-fetches new CAPTCHA, modal refreshes in place |
| User skips CAPTCHA | "Skip Invoice" button → ⚠️ Skipped, continues batch |
| Website down / timeout | Batch pauses, error shown — user retries or skips |
| Tab closed / app minimised | Progress saved in `session.json`; resume on reopen |
| User abandons mid-batch | Session saved; resumable from next pending invoice |
| Tax ID has branch suffix (`-068`) | Strip suffix before Website 2 query |
| Malformed / invalid XML | Skip file, show error card, continue rest of batch |
| Missing required XML fields | Show error, prompt user to add entry manually |
| Duplicate invoice in batch | Warn before processing; user removes duplicates |
| Blank screenshot | `waitForLoadState('networkidle')` before capture; retry once |

---

## 11. Deployment

- Built with `electron-builder` into a Windows `.exe` installer
- Installer bundles: Electron, Node.js runtime, all npm packages, Playwright + Chromium browser
- Expected installer size: ~200–300MB
- No external dependencies required on target machines
- Output files saved to `output/` folder alongside the app (or in user's Documents)
