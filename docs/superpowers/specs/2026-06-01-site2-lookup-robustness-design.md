# Design Specification: Site 2 Precise Tax ID & State-Race Verification

This specification outlines the updates made to Site 2 (`tracuunnt.gdt.gov.vn`) automation in Playwright to input full branch Tax IDs and robustly parse search outcomes using a locator race condition.

## Goals
- Support full 13-digit branch Tax IDs (e.g. `0102721191-068`) directly in Site 2's search input instead of stripping the branch suffix.
- Implement a Playwright `Promise.race` sequence to wait exactly for GDT's three distinct result states (incorrect captcha, taxpayer found, taxpayer not found) with 100% precision.
- Optimize processing speed and capture accurate result screenshots.

## Detailed Changes

### `backend/automation/site2.js`
1. **Remove Tax ID Suffix Stripping:**
   - Remove `stripBranchSuffix` logic.
   - Use the full `invoice.taxId` (e.g., `0102721191-068`) directly:
     ```javascript
     onLog(`Entering Seller Tax ID (${invoice.taxId}) into the first field...`)
     await page.fill('input[name="mst"], input[id*="mst"], input[placeholder*="mã số thuế"]', invoice.taxId)
     ```
2. **Implement State Race Interception:**
   - Immediately after submitting the CAPTCHA, set up `Promise.race`:
     ```javascript
     const result = await Promise.race([
       page.waitForSelector('text=Vui lòng nhập đúng mã xác nhận', { timeout: 15000 }).then(() => 'wrong-captcha'),
       page.waitForSelector('text=BẢNG THÔNG TIN TRA CỨU', { timeout: 15000 }).then(() => 'success-found'),
       page.waitForSelector('text=Không tìm thấy người nộp thuế', { timeout: 15000 }).then(() => 'success-not-found')
     ]).catch(() => 'timeout')
     ```
   - Evaluate the result:
     - `'wrong-captcha'`: Log CAPTCHA incorrect, and `continue` retry loop.
     - `'success-found'`: Log success, capture screenshot, and return `{ ok: true, screenshotBase64, status: 'pass' }`.
     - `'success-not-found'`: Log not found, capture screenshot, and return `{ ok: true, screenshotBase64, status: 'invalid-business' }`.
     - `'timeout'`: Fallback to standard check of whether form is visible.

---

## Verification Plan

### Manual Verification
1. Process a valid branch invoice (e.g., Seller Tax ID: `0102721191-068`).
2. Verify:
   - Playwright types the full `0102721191-068` into the first visible field.
   - Entering incorrect captcha results in instant retry logs: `[Site 2] CAPTCHA incorrect. Refreshing and retrying...`
   - Entering correct captcha results in instant pass: `[Site 2] Verification successful! Capturing business status screenshot...`
3. Process an invalid invoice and verify it identifies taxpayer not found cleanly.

### Automated Tests
Run `npm test` to verify zero regressions.
