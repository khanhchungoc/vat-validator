# Site 1 API Response Interception Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Intercept and parse GDT API search calls in Playwright for Site 1 to achieve instantaneous captcha retry, highly resilient validation, and fast UI catch-up.

**Architecture:** We use Playwright's `page.waitForResponse` before clicking search to intercept the guest-invoices API response. We check the HTTP status (401 triggers an immediate retry loop) and the response body (non-null JSON triggers success, null/empty JSON triggers a failure). We wait for the DOM text to update before taking the screenshot and returning the correct status.

**Tech Stack:** JavaScript, Playwright, Node.js

---

### Task 1: API Response Interception in `site1.js`

**Files:**
- Modify: `backend/automation/site1.js`

- [ ] **Step 1: Modify `backend/automation/site1.js`**
Locate the code around lines 108-133 and replace it to set up a `page.waitForResponse` before submitting the CAPTCHA. Handle the 401 and 200 HTTP statuses with correct DOM transitions:

```javascript
    // Set up network response listener for the guest-invoices API call
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/sco-query/guest-invoices'),
      { timeout: 30000 }
    ).catch(() => null)

    // Fill and submit CAPTCHA
    await page.fill('input#cvalue, input[name="captcha"], input[id*="captcha"]', answer)
    await page.click('button[type="submit"], input[type="submit"], button:has-text("Tìm kiếm")')

    const response = await responsePromise

    if (!response) {
      // Fallback: if timeout or network issue occurs, check if form is still visible
      const formIsStillVisible = await page.$('input#cvalue')
      if (formIsStillVisible && await formIsStillVisible.isVisible()) {
        continue
      }
      break
    }

    // 1. Check for incorrect CAPTCHA (HTTP 401 Unauthorized)
    if (response.status() === 401) {
      console.log(`[Site 1] Incorrect CAPTCHA submitted (attempt ${attempt}). Retrying...`)
      continue
    }

    // 2. Check for successful response (HTTP 200 OK)
    if (response.status() === 200) {
      const text = await response.text().catch(() => '')
      let body = null
      try {
        body = text ? JSON.parse(text) : null
      } catch (e) {
        console.error('[Site 1] Failed to parse API response JSON:', e.message)
      }

      // If the body is null or represents an empty object/array, the invoice does not exist
      if (!body || Object.keys(body).length === 0) {
        console.log(`[Site 1] Invoice not found via API.`)
        // Wait for UI to render the "Không tìm thấy" error message
        await page.waitForSelector('text=Không tìm thấy, text=không hợp lệ, .result-error', { timeout: 5000 }).catch(() => {})
        
        const screenshotBuffer = await page.screenshot({ fullPage: false })
        const screenshotBase64 = screenshotBuffer.toString('base64')
        return { ok: true, screenshotBase64, status: 'invalid-invoice' }
      } else {
        console.log(`[Site 1] Invoice verified successfully via API.`)
        // Wait for UI to render the "Tồn tại hóa đơn" success message
        await page.waitForSelector('text=Tồn tại hóa đơn có thông tin trùng khớp, .result-success', { timeout: 5000 }).catch(() => {})
        
        const screenshotBuffer = await page.screenshot({ fullPage: false })
        const screenshotBase64 = screenshotBuffer.toString('base64')
        return { ok: true, screenshotBase64, status: 'pass' }
      }
    }

    // If other status code, fallback to DOM check
    const formIsStillVisible = await page.$('input#cvalue')
    if (formIsStillVisible && await formIsStillVisible.isVisible()) {
      continue
    }
    break
  }
```

- [ ] **Step 2: Run Jest test suite to check for regressions**
Run the tests: `npm test`
Expected: 46/46 passing (all backend & unit tests).

- [ ] **Step 3: Stage and commit the changes**
Commit files:
```bash
git add backend/automation/site1.js docs/superpowers/plans/2026-06-01-site1-api-interception.md
git commit -m "feat: intercept site 1 API responses for precise captcha and lookup validation"
```
