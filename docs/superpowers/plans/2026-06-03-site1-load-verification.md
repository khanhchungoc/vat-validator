# Site 1 Load Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the GDT Invoice Portal site loads successfully (elements are visible and page is not blank) before proceeding, using an automatic retry reload mechanism.

**Architecture:** Implement a robust page load verification helper function that checks for the visibility of the primary input selector `input#nbmst` with a 10s timeout, retrying up to 3 times by reloading the page. Integrate this check into the GDT Invoice Portal navigation code path.

**Tech Stack:** Node.js, Playwright, Jest (for unit testing)

---

### Task 1: Create Unit Tests and Implement `verifySiteLoaded`

**Files:**
- Create: `backend/__tests__/gdtInvoicePortal.test.js`
- Modify: `backend/automation/gdtInvoicePortal.js`

- [ ] **Step 1: Create the test file with failing unit tests**
  Create `backend/__tests__/gdtInvoicePortal.test.js` with tests that mock Playwright's `page.waitForSelector` and `page.goto` to verify the three scenarios for `verifySiteLoaded`:
  1. Successful load on the first attempt.
  2. Load fails on the first attempt, but succeeds on the second attempt after a reload.
  3. Load fails on all 3 attempts.

  ```javascript
  const { verifySiteLoaded } = require('../automation/gdtInvoicePortal')

  describe('verifySiteLoaded', () => {
    let mockPage
    let logs

    beforeEach(() => {
      logs = []
      mockPage = {
        goto: jest.fn().mockResolvedValue(null),
        waitForSelector: jest.fn().mockResolvedValue(null),
      }
    })

    const logFn = (msg) => logs.push(msg)

    test('resolves true on immediate success', async () => {
      const result = await verifySiteLoaded(mockPage, 'https://test.url', '#target', 3, logFn)
      expect(result).toBe(true)
      expect(mockPage.waitForSelector).toHaveBeenCalledTimes(1)
      expect(mockPage.goto).not.toHaveBeenCalled()
      expect(logs).toContain('Verifying GDT Portal loaded successfully...')
      expect(logs).toContain('GDT Portal loaded successfully!')
    })

    test('retries on failure and resolves true on subsequent success', async () => {
      // Fail once, then succeed
      mockPage.waitForSelector
        .mockRejectedValueOnce(new Error('Timeout waiting for selector'))
        .mockResolvedValueOnce(null)

      const result = await verifySiteLoaded(mockPage, 'https://test.url', '#target', 3, logFn)
      expect(result).toBe(true)
      expect(mockPage.waitForSelector).toHaveBeenCalledTimes(2)
      expect(mockPage.goto).toHaveBeenCalledTimes(1)
      expect(mockPage.goto).toHaveBeenCalledWith('https://test.url', { waitUntil: 'networkidle', timeout: 30000 })
      expect(logs.some(l => l.includes('Site load check failed on attempt 1'))).toBe(true)
      expect(logs.some(l => l.includes('Reloading GDT Portal page (attempt 2/3)'))).toBe(true)
      expect(logs).toContain('GDT Portal loaded successfully!')
    })

    test('resolves false after max attempts fail', async () => {
      mockPage.waitForSelector.mockRejectedValue(new Error('Timeout waiting for selector'))

      const result = await verifySiteLoaded(mockPage, 'https://test.url', '#target', 3, logFn)
      expect(result).toBe(false)
      expect(mockPage.waitForSelector).toHaveBeenCalledTimes(3)
      expect(mockPage.goto).toHaveBeenCalledTimes(2) // attempt 2 and 3 reloads
      expect(logs.some(l => l.includes('Site load check failed on attempt 3'))).toBe(true)
    })
  })
  ```

- [ ] **Step 2: Run test suite to verify tests compile but fail**
  Run: `npm test backend/__tests__/gdtInvoicePortal.test.js`
  Expected: Failure (module.exports from `gdtInvoicePortal.js` does not have `verifySiteLoaded` exported yet).

- [ ] **Step 3: Define stub for `verifySiteLoaded` and export it**
  Modify `backend/automation/gdtInvoicePortal.js` to define and export `verifySiteLoaded`.
  
  Add definition (around line 17 before `runGdtInvoicePortal`):
  ```javascript
  async function verifySiteLoaded(page, url, selector, maxAttempts = 3, onLog = () => {}) {
    return false
  }
  ```
  
  And update `module.exports` at the end of the file:
  ```javascript
  module.exports = { runGdtInvoicePortal, verifySiteLoaded }
  ```

- [ ] **Step 4: Run test to make sure it fails cleanly on assertions**
  Run: `npm test backend/__tests__/gdtInvoicePortal.test.js`
  Expected: FAIL on the success assertions (since `verifySiteLoaded` returns `false`).

- [ ] **Step 5: Write the full implementation of `verifySiteLoaded`**
  Modify `backend/automation/gdtInvoicePortal.js`:
  Replace the stub with the full implementation:
  ```javascript
  async function verifySiteLoaded(page, url, selector, maxAttempts = 3, onLog = () => {}) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          onLog(`Site load check failed. Reloading GDT Portal page (attempt ${attempt}/${maxAttempts})...`)
          await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
        } else {
          onLog(`Verifying GDT Portal loaded successfully...`)
        }
        
        // Wait for the key input element to be visible
        await page.waitForSelector(selector, { state: 'visible', timeout: 10000 })
        onLog('GDT Portal loaded successfully!')
        return true
      } catch (err) {
        onLog(`Site load check failed on attempt ${attempt}: ${err.message}`)
      }
    }
    return false
  }
  ```

- [ ] **Step 6: Run tests to verify all pass**
  Run: `npm test backend/__tests__/gdtInvoicePortal.test.js`
  Expected: PASS

- [ ] **Step 7: Commit the unit tests and the helper function**
  Run: `git add backend/__tests__/gdtInvoicePortal.test.js backend/automation/gdtInvoicePortal.js; git commit -m "feat(automation): add verifySiteLoaded helper and tests"`

---

### Task 2: Integrate `verifySiteLoaded` Check in navigation flow

**Files:**
- Modify: `backend/automation/gdtInvoicePortal.js`

- [ ] **Step 1: Call `verifySiteLoaded` after navigating to SITE1_URL**
  Modify `backend/automation/gdtInvoicePortal.js` inside `runGdtInvoicePortal` right after `await page.goto(...)`:

  Find target content (lines 28-30):
  ```javascript
      onLog('Navigating to GDT Portal (https://hoadondientu.gdt.gov.vn/)...')
      await page.goto(SITE1_URL, { waitUntil: 'networkidle', timeout: 30000 })
  ```

  Replace with:
  ```javascript
      onLog('Navigating to GDT Portal (https://hoadondientu.gdt.gov.vn/)...')
      await page.goto(SITE1_URL, { waitUntil: 'networkidle', timeout: 30000 })

      const loaded = await verifySiteLoaded(page, SITE1_URL, 'input#nbmst', 3, onLog)
      if (!loaded) {
        throw new Error('GDT Invoice Portal failed to load successfully after 3 attempts.')
      }
  ```

- [ ] **Step 2: Run all backend tests to ensure regression-free codebase**
  Run: `npm test`
  Expected: PASS for all tests (including any routing, engine sessions, and download tests).

- [ ] **Step 3: Commit integration changes**
  Run: `git add backend/automation/gdtInvoicePortal.js; git commit -m "feat(automation): integrate GDT Portal load verification check"`
