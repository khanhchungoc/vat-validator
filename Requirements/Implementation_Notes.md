# Implementation Notes: VAT Invoice Validation App

## 1. Explored Approaches

### Approach A: 3rd-Party APIs (Fully Automated)
Using services like Bizzi or MISA meInvoice that provide a REST API for incoming invoices. 
- *Pros:* Fast, no CAPTCHA solving needed.
- *Cons:* Requires a paid subscription or per-call fee. (Discarded due to budget constraints).

### Approach B: RPA with CAPTCHA Solver (Fully Automated)
Using Playwright/Selenium combined with a paid service like 2Captcha or Anti-Captcha.
- *Pros:* Fully hands-off.
- *Cons:* Slight cost for the CAPTCHA service, higher maintenance if the CAPTCHA type changes.

### Approach C: Semi-Automated Local App (The Chosen Solution)
A local application that does all the heavy lifting (parsing, clicking, screenshots, Word doc generation) but pauses to let the human manually solve the CAPTCHA.
- *Pros:* 100% Free, highly reliable, avoids IP blocking.
- *Cons:* Requires a few seconds of human input per invoice.

## 2. The Finalized Architecture

To provide the best user experience, we decided to build a **Local Web Application**.

### Tech Stack
- **Desktop Wrapper:** Electron — bundles the entire app into a portable `.exe` installer. No Node.js installation required on target machines. Uses **native OS window frame** (standard Windows title bar).
- **Backend Engine:** Node.js (runs as a child process inside Electron).
- **Browser Automation:** Playwright (bundled inside the Electron app).
- **Data Parsing:** Node.js XML parser (to read the Vietnamese e-invoice XML format).
- **Document Generation:** Playwright's built-in `page.pdf()` API for the PDF; `xlsx` npm package for the Excel summary.
- **Frontend UI:** Vite + React + CSS (glassmorphism dashboard, rendered inside the Electron window).
- **Real-time comms:** WebSocket between Electron backend and React frontend (internal localhost).
- **Packaging:** `electron-builder` — produces a Windows `.exe` installer that bundles everything.

### The Workflow (How the App Works)
1. **Upload / Enter:** User builds the invoice queue via one or both methods:
   - **XML drag & drop:** Drop XML files onto the dashboard — parsed instantly.
   - **Manual entry:** Click "Add Invoice Manually" to open an inline form with fields: Invoice Code, Invoice Number, Total Amount, Seller Name, Tax ID, Seller Address. Both methods can be mixed in the same batch.
2. **Parse:** Backend extracts data from XMLs instantly; manually entered invoices go straight into the queue.
3. **Choose Processing Mode:** Before starting, the user selects a mode via a toggle on the dashboard:
   - **▶ Auto Mode** *(default)* — Processes all invoices continuously. Only pauses for CAPTCHA input. After each CAPTCHA is solved, the next invoice starts automatically.
   - **👣 Step Mode** — Processes one invoice at a time. After each invoice completes (both websites done), the automation **pauses and waits**. The user reviews the screenshots in the UI, then clicks **"Step →"** to proceed to the next invoice. CAPTCHA is still required per invoice as usual.
   - The mode can be switched between invoices at any time during processing.
4. **Execute:** 
   - Backend launches a hidden Playwright browser.
   - It navigates to `hoadondientu.gdt.gov.vn` and fills the form.
   - Playwright captures the CAPTCHA image and sends it via WebSocket/API to the frontend dashboard.
5. **Manual Intervention:** A modal pops up on the dashboard showing the CAPTCHA image. The user types the answer and hits Enter.
   - **If CAPTCHA is wrong:** Playwright detects the failure, captures the new CAPTCHA image, and the modal refreshes for re-entry automatically.
   - **Skip option:** The modal always shows a **"Skip Invoice"** button — if the user can't solve the CAPTCHA, they can skip; the invoice is marked ⚠️ Skipped.
6. **Continue:** Backend injects the text, clicks search, takes the result screenshot.
7. **Repeat:** It does the same for the Business Registration website.
   - In **Step Mode**: after both screenshots are taken, the UI highlights the completed invoice and waits for the user to click **"Step →"** before continuing.

7. **Generate:** Once all invoices are processed, it produces two output files inside an auto-created session folder:
   - **Folder:** `output/YYYY-MM-DD_HH-MM-SS/` — created automatically when the user uploads the batch.
   - **`session.json`** — written continuously throughout processing; tracks every invoice's status, extracted data, and which screenshots have been saved. This is the resume checkpoint.
   - **`results.pdf`** — one page per invoice: metadata header + Website 1 screenshot + Website 2 screenshot.
   - **`summary.xlsx`** — Excel file with color-coded rows (🟢 Pass / 🔴 Invalid Invoice / 🔴 Invalid Business / ⚠️ Skipped).
   - The UI shows download buttons for both files, linking directly to the session folder.

> **Status definitions:**
> - ✅ **Pass** — Invoice valid on Website 1 AND business valid on Website 2.
> - ❌ **Invalid Invoice** — Failed Website 1 (invoice not found or invalid).
> - ❌ **Invalid Business** — Failed Website 2 (business/tax code not found or invalid).
> - ⚠️ **Skipped** — User chose to skip (CAPTCHA unsolvable or website unreachable).

## 3. Edge Cases & Handling

| Scenario | Behaviour |
|---|---|
| CAPTCHA wrong answer | Playwright detects failure, auto-fetches new CAPTCHA, modal refreshes |
| User can't solve CAPTCHA | "Skip Invoice" button in modal — marks invoice as ⚠️ Skipped |
| Government website down / timeout | Batch pauses, error shown — user can retry or skip that invoice |
| WebSocket disconnects / tab closed | Progress auto-saved to `session.json`; dashboard shows "Resume" on next open |
| User abandons mid-session (e.g. 20/50 done) | Session saved; on next visit dashboard lists incomplete sessions — user clicks Resume to continue from invoice 21 |
| Tax ID has branch suffix (e.g. `0102721191-068`) | Strip suffix before querying Website 2 (use root MST only); needs testing |
| Malformed or invalid XML | Skip file, show error on that card, continue with rest of batch |
| Missing required XML fields | Treat as invalid XML — show error, prompt user to add manually |
| Duplicate invoice in batch | Warn user before processing starts; allow them to remove duplicates |
| Screenshot loads blank | Use `waitForLoadState('networkidle')` before capturing; retry once if blank |

## 3. Next Steps for the New Session
When you start a new session to build this, you can hand this document to the AI and say:
*"Let's start executing this plan. First, set up the Node.js + Vite project structure, and then let's write the XML parsing logic."*
