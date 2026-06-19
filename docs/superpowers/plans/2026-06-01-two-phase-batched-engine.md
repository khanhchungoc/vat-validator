# Two-Phase Batched Automation Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `startProcessing` so all invoices are checked against the GDT Invoice Portal (Site 1) first, then a deduplicated set of Tax IDs is checked against the GDT Taxpayer Portal (Site 2), with Site 2 screenshots copied to every invoice that shares a Tax ID.

**Architecture:** Single-file change to `backend/automation/automationEngine.js`. The two portal modules (`gdtInvoicePortal.js`, `gdtTaxpayerPortal.js`) and all output/PDF/XLSX generators are left untouched. Only the orchestration loop inside `startProcessing` changes.

**Tech Stack:** Node.js, Playwright (via existing mocks in Jest), Jest (existing test suite at `backend/__tests__/`).

---

## Task 1: Update `automationEngine_sessions.test.js` for two-phase flow

The existing test asserts `saveSession` is called exactly 3 times (once for `processing`, once for final status, once in `finally`). The new two-phase engine will call `saveSession` differently, so update the test first so it fails, then fix the engine.

**Files:**
- Modify: `backend/__tests__/automationEngine_sessions.test.js`

- [ ] **Step 1: Add `setViewportSize` mock to the existing `mockPage`**

The engine now calls `page.setViewportSize(...)` immediately after `newPage()`. Without a mock, the test will throw. Open `backend/__tests__/automationEngine_sessions.test.js` and update `mockPage`:

```javascript
mockPage = {
  goto: jest.fn(),
  close: jest.fn(),
  setViewportSize: jest.fn().mockResolvedValue(undefined)
}
```

- [ ] **Step 2: Update the `saveSession` call-count assertion for two-phase flow**

With the new engine, for one invoice that passes both phases, `saveSession` is called:
1. After Phase 1 sets `processing`
2. After Phase 1 sets the invoice to `site1-done` (intermediate save)
3. After Phase 2 applies the final status  
4. In the `finally` block

Update the assertion on line 57:

```javascript
// saveSession is called for each phase transition plus the finally block.
// For one invoice passing both phases: processing → site1-done → final → finally = 4 times
expect(saveSession).toHaveBeenCalledTimes(4)
expect(saveSession).toHaveBeenCalledWith('test-session-dir', expect.any(Array))
```

- [ ] **Step 3: Add an assertion that `updateInvoiceStatus` is called with `'site1-done'` intermediate status**

After the existing `processing` assertion, add:

```javascript
// Phase 1 intermediate status broadcast
expect(updateInvoiceStatus).toHaveBeenCalledWith('inv1', 'site1-done', expect.any(Object))

// Final pass status (from Phase 2)
expect(updateInvoiceStatus).toHaveBeenCalledWith('inv1', 'pass', expect.any(Object))
```

And remove the old final-pass-only assertion (line 51):
```javascript
// DELETE this line:
// expect(updateInvoiceStatus).toHaveBeenCalledWith('inv1', 'pass', expect.any(Object))
```

So the full assertions block becomes:
```javascript
expect(updateInvoiceStatus).toHaveBeenCalledWith('inv1', 'processing')
expect(updateInvoiceStatus).toHaveBeenCalledWith('inv1', 'site1-done', expect.any(Object))
expect(updateInvoiceStatus).toHaveBeenCalledWith('inv1', 'pass', expect.any(Object))
expect(saveSession).toHaveBeenCalledTimes(4)
expect(saveSession).toHaveBeenCalledWith('test-session-dir', expect.any(Array))
```

- [ ] **Step 4: Add a new test for Tax ID deduplication**

Append a second `test` block inside the same `describe`:

```javascript
test('should run Site 2 only once per unique Tax ID across multiple invoices', async () => {
  // Two invoices with the SAME tax ID
  getInvoices.mockReturnValue([
    { id: 'inv1', taxId: 'TAX001', status: 'pending' },
    { id: 'inv2', taxId: 'TAX001', status: 'pending' }
  ])
  runGdtInvoicePortal.mockResolvedValue({ status: 'pass', screenshotBase64: 'abc' })
  runGdtTaxpayerPortal.mockResolvedValue({ status: 'pass', screenshotBase64: 'def' })

  await engine.startProcessing('test-session-dir', 'auto')

  // Site 1 called twice (once per invoice)
  expect(runGdtInvoicePortal).toHaveBeenCalledTimes(2)

  // Site 2 called only ONCE despite two invoices sharing the same Tax ID
  expect(runGdtTaxpayerPortal).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 5: Run the test to verify it fails for the right reason**

```bash
npx jest backend/__tests__/automationEngine_sessions.test.js --no-coverage
```

Expected: Tests fail because the engine still uses the old interleaved loop. Errors like `expect(saveSession).toHaveBeenCalledTimes(4)` → received 3, and `runGdtTaxpayerPortal` called 2 times instead of 1.

---

## Task 2: Restructure `startProcessing` into two phases

**Files:**
- Modify: `backend/automation/automationEngine.js` — replace the body of `startProcessing` (lines 68–200)

- [ ] **Step 1: Replace the entire `startProcessing` function body with the two-phase implementation**

Replace everything from `async function startProcessing(sessionDir, mode = 'auto') {` through its closing `}` (lines 68–201) with:

```javascript
async function startProcessing(sessionDir, mode = 'auto') {
  if (isRunning) {
    broadcast({ type: 'error', payload: 'Automation engine is already running' })
    return { ok: false, error: 'Already running' }
  }
  isRunning = true
  stepMode = mode === 'step'
  currentSessionDir = sessionDir

  // Clear client activity logs at start
  broadcast({ type: 'processing-log-clear' })

  try {
    browser = await chromium.launch({ headless: false })
    const page = await browser.newPage()
    await page.setViewportSize({ width: 1280, height: 900 })

    const invoices = getInvoices().filter(i => i.status === 'pending')

    // ─────────────────────────────────────────────────────────
    // PHASE 1: GDT Invoice Portal — process all invoices first
    // ─────────────────────────────────────────────────────────
    // phase1Results maps invoiceId → { status, site1Screenshot }
    const phase1Results = {}

    for (const invoice of invoices) {
      if (!isRunning) break

      updateInvoiceStatus(invoice.id, 'processing')
      broadcast({ type: 'invoice-status', payload: { id: invoice.id, status: 'processing' } })
      saveSession(sessionDir, getInvoices())

      let site1Screenshot = null
      let site1Status = 'skipped'
      let processAttempt = 0
      const maxProcessAttempts = 3

      while (processAttempt < maxProcessAttempts) {
        processAttempt++
        try {
          const site1Result = await runGdtInvoicePortal(
            page,
            invoice,
            (img, att) => waitForCaptchaAnswer(invoice.id, img, att),
            (msg) => logStep(invoice.id, `[GDT Invoice Portal] ${msg}`)
          )
          site1Status = site1Result.status
          if (site1Result.status !== 'skipped') {
            broadcast({ type: 'captcha-success', payload: { id: invoice.id } })
            site1Screenshot = saveScreenshot(sessionDir, invoice.id, 1, site1Result.screenshotBase64)
          }
          break
        } catch (e) {
          console.error(`[Engine] Phase 1 error on invoice ${invoice.id} (attempt ${processAttempt}):`, e.message)
          broadcast({ type: 'processing-error', payload: { invoiceId: invoice.id, message: e.message } })
          const userChoice = await new Promise(resolve => { captchaResolve = resolve })
          if (userChoice === 'skip' || userChoice === null) {
            site1Status = 'skipped'
            break
          }
          if (processAttempt >= maxProcessAttempts) {
            site1Status = 'skipped'
            break
          }
        }
      }

      phase1Results[invoice.id] = { status: site1Status, site1Screenshot }

      // Invoices that didn't pass Site 1 are finalized now
      if (site1Status !== 'pass') {
        updateInvoiceStatus(invoice.id, site1Status, { site1Screenshot, site2Screenshot: null })
        broadcast({ type: 'invoice-status', payload: { id: invoice.id, status: site1Status, site1Screenshot, site2Screenshot: null } })
      } else {
        // Mark as intermediate so UI shows progress
        updateInvoiceStatus(invoice.id, 'site1-done', { site1Screenshot, site2Screenshot: null })
        broadcast({ type: 'invoice-status', payload: { id: invoice.id, status: 'site1-done', site1Screenshot, site2Screenshot: null } })
      }
      saveSession(sessionDir, getInvoices())

      await waitForStep()
    }

    // ─────────────────────────────────────────────────────────
    // PHASE 2: GDT Taxpayer Portal — one lookup per unique Tax ID
    // ─────────────────────────────────────────────────────────
    const passedInvoices = invoices.filter(inv => phase1Results[inv.id]?.status === 'pass')
    const uniqueTaxIds = [...new Set(passedInvoices.map(inv => inv.taxId))]

    // site2Cache maps taxId → { status, screenshotBase64 }
    const site2Cache = {}

    if (uniqueTaxIds.length > 0) {
      logStep('engine', 'Phase 1 complete. Starting Tax ID lookups on GDT Taxpayer Portal...')
    }

    for (const taxId of uniqueTaxIds) {
      if (!isRunning) break

      // Use first invoice with this Tax ID as representative for CAPTCHA prompting
      const representativeInvoice = passedInvoices.find(inv => inv.taxId === taxId)

      let site2Status = 'skipped'
      let site2ScreenshotBase64 = null
      let processAttempt = 0
      const maxProcessAttempts = 3

      while (processAttempt < maxProcessAttempts) {
        processAttempt++
        try {
          const site2Result = await runGdtTaxpayerPortal(
            page,
            representativeInvoice,
            (img, att) => waitForCaptchaAnswer(representativeInvoice.id, img, att),
            (msg) => logStep(representativeInvoice.id, `[GDT Taxpayer Portal] [TaxID: ${taxId}] ${msg}`)
          )
          site2Status = site2Result.status
          if (site2Result.status !== 'skipped') {
            broadcast({ type: 'captcha-success', payload: { id: representativeInvoice.id } })
            site2ScreenshotBase64 = site2Result.screenshotBase64
          }
          break
        } catch (e) {
          console.error(`[Engine] Phase 2 error on Tax ID ${taxId} (attempt ${processAttempt}):`, e.message)
          broadcast({ type: 'processing-error', payload: { invoiceId: representativeInvoice.id, message: e.message } })
          const userChoice = await new Promise(resolve => { captchaResolve = resolve })
          if (userChoice === 'skip' || userChoice === null) {
            site2Status = 'skipped'
            break
          }
          if (processAttempt >= maxProcessAttempts) {
            site2Status = 'skipped'
            break
          }
        }
      }

      site2Cache[taxId] = { status: site2Status, screenshotBase64: site2ScreenshotBase64 }
    }

    // Apply Phase 2 results: copy screenshot once per invoice that passed Phase 1
    for (const invoice of passedInvoices) {
      if (!isRunning) break
      const cached = site2Cache[invoice.taxId]
      const { site1Screenshot } = phase1Results[invoice.id]

      let site2Screenshot = null
      let finalStatus = cached?.status ?? 'skipped'

      if (cached && cached.screenshotBase64) {
        // Copy the screenshot buffer to this invoice's own file
        site2Screenshot = saveScreenshot(sessionDir, invoice.id, 2, cached.screenshotBase64)
      }

      updateInvoiceStatus(invoice.id, finalStatus, { site1Screenshot, site2Screenshot })
      broadcast({ type: 'invoice-status', payload: { id: invoice.id, status: finalStatus, site1Screenshot, site2Screenshot } })
      saveSession(sessionDir, getInvoices())
    }

    return { ok: true }
  } catch (e) {
    console.error('[Engine] Fatal error:', e.message)
    broadcast({ type: 'error', payload: `Fatal error: ${e.message}` })
    return { ok: false, error: e.message }
  } finally {
    if (browser) await browser.close()
    browser = null
    isRunning = false
    captchaResolve = null
    stepResolve = null

    let generated = false
    if (currentSessionDir) {
      saveSession(currentSessionDir, getInvoices())

      try {
        const allInvoices = getInvoices()
        if (allInvoices.length > 0) {
          const [pdfPath, xlsxPath] = await Promise.all([
            generatePDF(currentSessionDir, allInvoices),
            Promise.resolve(generateXLSX(currentSessionDir, allInvoices))
          ])
          const sessionId = require('path').basename(currentSessionDir)
          const port = process.env.BACKEND_PORT || '3001'
          broadcast({
            type: 'batch-complete',
            payload: {
              pdfUrl: `http://localhost:${port}/download/pdf/${sessionId}`,
              xlsxUrl: `http://localhost:${port}/download/xlsx/${sessionId}`
            }
          })
          generated = true
        }
      } catch (e) {
        console.error('[Engine] Output generation failed:', e.message)
      }
    }
    if (!generated) {
      broadcast({ type: 'batch-complete', payload: {} })
    }
  }
}
```

- [ ] **Step 2: Run all tests to check the engine tests now pass**

```bash
npx jest --no-coverage
```

Expected: All tests pass including the updated `automationEngine_sessions.test.js`. If any test fails, read the error carefully — most likely `mockPage.setViewportSize` is missing in some test file.

- [ ] **Step 3: Fix any remaining test mocks that lack `setViewportSize`**

If other test files that mock `playwright` fail, add `setViewportSize: jest.fn().mockResolvedValue(undefined)` to their `mockPage` object. Check these files if needed:
- `backend/__tests__/automationEngine_sessions.test.js` (already done in Task 1)
- `backend/__tests__/wsAutomation.test.js` (mocks the whole engine module, not playwright — no change needed)

- [ ] **Step 4: Commit**

```bash
git add backend/__tests__/automationEngine_sessions.test.js backend/automation/automationEngine.js
git commit -m "feat: restructure engine into two-phase batched processing with Tax ID deduplication"
```

---

## Task 3: Handle `site1-done` status in the UI

The frontend currently doesn't know about `'site1-done'`. Invoice cards stuck in that state would show an unknown status. Add a display mapping.

**Files:**
- Modify: `src/App.jsx` — find the status label/badge rendering logic

- [ ] **Step 1: Locate the status display mapping in `src/App.jsx`**

Search for where invoice status strings are mapped to display labels or badge colors. It will look something like a `statusLabel` object or a conditional rendering block checking `invoice.status`.

- [ ] **Step 2: Add `site1-done` to the status mapping**

Add the following entry alongside the existing status mappings (e.g., `processing`, `pass`, `invalid-invoice`, etc.):

```javascript
'site1-done': { label: 'Portal 1 ✓', color: '#a78bfa' }  // soft purple — in-progress but Site 1 passed
```

The exact syntax depends on how status labels are currently defined in `App.jsx`. Mirror the existing pattern precisely.

- [ ] **Step 3: Run the frontend build to verify no syntax errors**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add site1-done intermediate status to UI invoice card display"
```

---

## Task 4: Repack and smoke test

**Files:** No code changes — build and verify.

- [ ] **Step 1: Run the full test suite one final time**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 2: Build the frontend**

```bash
npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 3: Package the Electron app**

```bash
npx electron-builder --win --dir
```

Expected: `release\win-unpacked\VAT-validator.exe` produced without errors.

- [ ] **Step 4: Smoke test**

Launch `release\win-unpacked\VAT-validator.exe`. Load a session with at least 2 invoices sharing the same Tax ID. Start processing. Verify:
- Activity console shows all Site 1 logs before any Site 2 logs appear
- After Phase 1, invoice cards briefly show "Portal 1 ✓" 
- After Phase 2, invoice cards show their final status
- The PDF report shows two screenshots side by side for each invoice

- [ ] **Step 5: Final commit tag**

```bash
git tag v-two-phase-engine
```
