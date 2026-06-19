# Site 2 Successful Match Full-Page Screenshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure the GDT Taxpayer Portal lookup to capture a full-page screenshot (`{ fullPage: true }`) when a lookup is successful, ensuring that all matched businesses are visible in the output image.

**Architecture:** We will modify the screenshot call inside the success table detection branch in `gdtTaxpayerPortal.js`. Other outcomes (error/fallback) will continue to capture viewport-only screenshots to keep output file sizes minimal.

**Tech Stack:** JavaScript, Playwright.

---

### Task 1: Update Screenshot Configuration

**Files:**
- Modify: `backend/automation/gdtTaxpayerPortal.js:178-184`

- [ ] **Step 1: Modify success screenshot call**
Open `backend/automation/gdtTaxpayerPortal.js`. Locate lines 178-184:
```javascript
    const hasSuccessTable = await page.$('text=BẢNG THÔNG TIN TRA CỨU')
    if (hasSuccessTable && await hasSuccessTable.isVisible()) {
      onLog('Verification successful! Capturing business status screenshot...')
      const screenshotBuffer = await page.screenshot({ fullPage: false })
      const screenshotBase64 = screenshotBuffer.toString('base64')
      return { ok: true, screenshotBase64, status: 'pass' }
    }
```
Replace the screenshot call option `{ fullPage: false }` with `{ fullPage: true }`:
```javascript
    const hasSuccessTable = await page.$('text=BẢNG THÔNG TIN TRA CỨU')
    if (hasSuccessTable && await hasSuccessTable.isVisible()) {
      onLog('Verification successful! Capturing business status screenshot...')
      // Capture the full scrollable page to include all businesses if multiple are returned
      const screenshotBuffer = await page.screenshot({ fullPage: true })
      const screenshotBase64 = screenshotBuffer.toString('base64')
      return { ok: true, screenshotBase64, status: 'pass' }
    }
```

- [ ] **Step 2: Run the full Jest unit test suite**
Run: `npm test`
Expected output: All 11 test suites and 49 unit tests PASS.

- [ ] **Step 3: Commit the changes**
```bash
git add backend/automation/gdtTaxpayerPortal.js
git commit -m "feat(automation): capture full-page screenshot on successful taxpayer lookup"
```

---

### Task 2: Build and Verification

**Files:**
- None (Build verification)

- [ ] **Step 1: Run production frontend compile check**
Run: `npm run build`
Expected: Compilation completes without errors.

- [ ] **Step 2: Package the application into production executable**
Run: `npm run pack`
Expected: Compiles cleanly and outputs executable at `release\win-unpacked\VAT-validator.exe`.
