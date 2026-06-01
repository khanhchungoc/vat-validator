# Site 2 Precision & State-Race Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confine searches on Site 2 to the exact branch Tax ID from the invoice and use Playwright `Promise.race` to instantly resolve search outcomes (incorrect captcha, taxpayer found, taxpayer not found) without flakiness.

**Architecture:** We feed `invoice.taxId` directly into Playwright's fill command. We construct a `Promise.race` waiting for three distinct text indicators on the page, and act immediately based on the winning state (retrying captcha or returning the correct pass/fail status).

**Tech Stack:** JavaScript, Playwright

---

### Task 1: Playwright Site 2 Precision & State Race (`site2.js`)

**Files:**
- Modify: `backend/automation/site2.js`

- [ ] **Step 1: Modify `backend/automation/site2.js`**
Rewrite `runSite2` to input `invoice.taxId` directly and implement `Promise.race` for accurate DOM state parsing:

```javascript
const SITE2_URL = 'https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp'

/**
 * Run Website 2 lookup for a single invoice.
 * @param {import('playwright').Page} page
 * @param {object} invoice - { taxId }
 * @param {function} onCaptcha - async (base64Image) => string answer
 * @param {function} [onLog] - function to log real-time progress steps
 * @returns {{ ok: boolean, screenshotBase64?: string, status: 'pass'|'invalid-business'|'skipped' }}
 */
async function runSite2(page, invoice, onCaptcha, onLog = () => {}) {
  onLog(`Entering Seller Tax ID (${invoice.taxId}) into the first field...`)
  await page.goto(SITE2_URL, { waitUntil: 'networkidle', timeout: 30000 })

  // Fill Tax ID field directly using the exact, full tax ID (branch suffix included)
  await page.fill('input[name="mst"], input[id*="mst"], input[placeholder*="mã số thuế"]', invoice.taxId)

  let attempt = 0
  while (true) {
    attempt++
    onLog(`Capturing CAPTCHA image (attempt ${attempt})...`)
    const captchaEl = await page.$('img[src*="captcha"]')
    if (!captchaEl) throw new Error('CAPTCHA element not found on Site 2')

    await captchaEl.scrollIntoViewIfNeeded()

    // Wait for image bytes to arrive
    await page.waitForFunction(
      el => el.complete && el.naturalWidth > 0 && el.naturalHeight > 0,
      captchaEl,
      { timeout: 10000 }
    ).catch(() => {})

    await page.waitForTimeout(500)

    const captchaBuffer = await captchaEl.screenshot()
    const captchaBase64 = captchaBuffer.toString('base64')

    onLog('Prompting user for CAPTCHA input...')
    const answer = await onCaptcha(captchaBase64, attempt)
    if (answer === null) {
      return { ok: false, status: 'skipped' }
    }

    onLog(`Submitting CAPTCHA answer: "${answer}"...`)
    await page.fill('input#captcha, input[name="captcha"]', answer)
    await page.click('input.subBtn, .subBtn, button[type="submit"], input[type="submit"], a:has-text("Tìm kiếm")')

    // State Race: Wait for GDT's three distinct result states
    const raceResult = await Promise.race([
      page.waitForSelector('text=Vui lòng nhập đúng mã xác nhận', { timeout: 15000 }).then(() => 'wrong-captcha'),
      page.waitForSelector('text=BẢNG THÔNG TIN TRA CỨU', { timeout: 15000 }).then(() => 'success-found'),
      page.waitForSelector('text=Không tìm thấy người nộp thuế', { timeout: 15000 }).then(() => 'success-not-found')
    ]).catch(() => 'timeout')

    if (raceResult === 'wrong-captcha') {
      onLog('GDT returned "Vui lòng nhập đúng mã xác nhận!" (Incorrect CAPTCHA). Refreshing and retrying...')
      continue
    }

    if (raceResult === 'success-found') {
      onLog('Verification successful! Capturing business status screenshot...')
      const screenshotBuffer = await page.screenshot({ fullPage: false })
      const screenshotBase64 = screenshotBuffer.toString('base64')
      return { ok: true, screenshotBase64, status: 'pass' }
    }

    if (raceResult === 'success-not-found') {
      onLog('Taxpayer not found (Invalid business!). Capturing error screenshot...')
      const screenshotBuffer = await page.screenshot({ fullPage: false })
      const screenshotBase64 = screenshotBuffer.toString('base64')
      return { ok: true, screenshotBase64, status: 'invalid-business' }
    }

    // Fallback: If other status or timeout occurs, check if form is still visible
    const formIsStillVisible = await page.$('input#captcha')
    if (formIsStillVisible && await formIsStillVisible.isVisible()) {
      onLog('CAPTCHA incorrect or timeout occurred. Retrying...')
      continue
    }

    break
  }

  // Final Fallback Screenshot
  const screenshotBuffer = await page.screenshot({ fullPage: false })
  const screenshotBase64 = screenshotBuffer.toString('base64')

  const isNotFound = await page.$('text=Không tìm thấy, text=không có kết quả, .no-result')
  const status = isNotFound ? 'invalid-business' : 'pass'

  return { ok: true, screenshotBase64, status }
}

module.exports = { runSite2 }
```

- [ ] **Step 2: Run Jest test suite**
Run: `npm test`
Expected: 46/46 passing.

- [ ] **Step 3: Commit**
```bash
git add backend/automation/site2.js
git commit -m "feat(automation): implement precise taxId input and state race condition on Site 2"
```

---

### Task 2: Production Rebuild & Pack

- [ ] **Step 1: Re-pack the application**
Run the packaging command:
`Stop-Process -Name "VAT-validator", "VATOCR", "electron" -Force -ErrorAction SilentlyContinue; npm run pack`
Expected: Successful compilation, producing the updated unpacked executable.
