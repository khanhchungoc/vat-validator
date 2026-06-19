# VATOCR — Plan 3: Playwright Automation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate Website 1 (invoice lookup + CAPTCHA) and Website 2 (tax code lookup) for each invoice, streaming CAPTCHA images to the frontend and receiving answers via WebSocket.

**Architecture:** `automationEngine.js` processes one invoice at a time using a persistent Playwright browser. For each invoice it fills Website 1 form, captures the CAPTCHA image (as base64), sends it to the frontend via WebSocket, waits for the `captcha-answer` message, submits, screenshots the result, then repeats for Website 2. The engine emits events back to the frontend through the shared WebSocket server.

**Tech Stack:** Playwright (Chromium), WebSocket (`ws`), Node.js

**Prereq:** Plans 1 & 2 complete.

---

## File Structure

```
backend/
├── automation/
│   ├── automationEngine.js    # Orchestrates processing queue, manages browser lifecycle
│   ├── site1.js               # Website 1 automation (hoadondientu.gdt.gov.vn)
│   └── site2.js               # Website 2 automation (tracuunnt.gdt.gov.vn)
└── wsHandler.js               # Updated: handles start-processing, captcha-answer, skip-invoice
```

---

### Task 1: Install Playwright

- [ ] **Step 1: Install Playwright**

```bash
npm install playwright
npx playwright install chromium
```

- [ ] **Step 2: Verify**

```bash
node -e "const { chromium } = require('playwright'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install playwright"
```

---

### Task 2: Website 1 automation module

**Files:**
- Create: `backend/automation/site1.js`

- [ ] **Step 1: Create `backend/automation/site1.js`**

```js
const SITE1_URL = 'https://hoadondientu.gdt.gov.vn/'

/**
 * Run Website 1 lookup for a single invoice.
 * @param {import('playwright').Page} page
 * @param {object} invoice - { invoiceCode, invoiceNumber, totalAmount }
 * @param {function} onCaptcha - async (base64Image) => string answer
 * @returns {{ ok: boolean, screenshotBase64?: string, status: 'pass'|'invalid-invoice'|'skipped' }}
 */
async function runSite1(page, invoice, onCaptcha) {
  await page.goto(SITE1_URL, { waitUntil: 'networkidle', timeout: 30000 })

  // Fill form fields
  await page.fill('input[name="khhdon"], input[placeholder*="ký hiệu"], input[id*="khhdon"]', invoice.invoiceCode)
  await page.fill('input[name="shdon"], input[placeholder*="số hóa đơn"], input[id*="shdon"]', String(invoice.invoiceNumber))
  await page.fill('input[name="tgtttbso"], input[placeholder*="tổng tiền"], input[id*="tgtttbso"]', String(invoice.totalAmount))

  let attempt = 0
  while (true) {
    attempt++
    // Capture CAPTCHA image
    const captchaEl = await page.$('img[src*="captcha"], img[alt*="captcha"], img[id*="captcha"]')
    if (!captchaEl) throw new Error('CAPTCHA element not found on Site 1')

    const captchaBuffer = await captchaEl.screenshot()
    const captchaBase64 = captchaBuffer.toString('base64')

    // Ask frontend for answer (may return null if user skipped)
    const answer = await onCaptcha(captchaBase64, attempt)
    if (answer === null) {
      return { ok: false, status: 'skipped' }
    }

    // Fill and submit CAPTCHA
    await page.fill('input[name="captcha"], input[id*="captcha"]', answer)
    await page.click('button[type="submit"], input[type="submit"], button:has-text("Tìm kiếm")')
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // Check for CAPTCHA failure (still on same page with error)
    const isCaptchaError = await page.$('text=Mã xác nhận không đúng, text=Sai mã captcha, .captcha-error')
    if (isCaptchaError) {
      // Loop: get new CAPTCHA
      continue
    }

    break
  }

  // Take result screenshot
  await page.waitForLoadState('networkidle', { timeout: 15000 })
  const screenshotBuffer = await page.screenshot({ fullPage: false })
  const screenshotBase64 = screenshotBuffer.toString('base64')

  // Determine pass/fail from page content
  const isInvalid = await page.$('text=Không tìm thấy, text=không hợp lệ, .result-error')
  const status = isInvalid ? 'invalid-invoice' : 'pass'

  return { ok: true, screenshotBase64, status }
}

module.exports = { runSite1 }
```

> **Note:** The exact CSS selectors for form fields and CAPTCHA must be verified by inspecting the live site before finalising. The selectors above are best-effort based on common Vietnamese gov site patterns — they will need adjustment during testing.

- [ ] **Step 2: Commit**

```bash
git add backend/automation/site1.js
git commit -m "feat: Website 1 Playwright automation module"
```

---

### Task 3: Website 2 automation module

**Files:**
- Create: `backend/automation/site2.js`

- [ ] **Step 1: Create `backend/automation/site2.js`**

```js
const SITE2_URL = 'https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp'

/**
 * Strip branch suffix from Tax ID (e.g. "0102721191-068" → "0102721191").
 */
function stripBranchSuffix(taxId) {
  return taxId.split('-')[0]
}

/**
 * Run Website 2 lookup for a single invoice.
 * @param {import('playwright').Page} page
 * @param {object} invoice - { taxId }
 * @returns {{ ok: boolean, screenshotBase64?: string, status: 'pass'|'invalid-business' }}
 */
async function runSite2(page, invoice) {
  const rootTaxId = stripBranchSuffix(invoice.taxId)

  await page.goto(SITE2_URL, { waitUntil: 'networkidle', timeout: 30000 })

  // Fill Tax ID field and submit
  await page.fill('input[name="mst"], input[id*="mst"], input[placeholder*="mã số thuế"]', rootTaxId)
  await page.click('button[type="submit"], input[type="submit"], a:has-text("Tìm kiếm")')
  await page.waitForLoadState('networkidle', { timeout: 15000 })

  // Screenshot result
  const screenshotBuffer = await page.screenshot({ fullPage: false })
  const screenshotBase64 = screenshotBuffer.toString('base64')

  // Check for not-found result
  const isNotFound = await page.$('text=Không tìm thấy, text=không có kết quả, .no-result')
  const status = isNotFound ? 'invalid-business' : 'pass'

  return { ok: true, screenshotBase64, status }
}

module.exports = { runSite2, stripBranchSuffix }
```

- [ ] **Step 2: Unit test the stripBranchSuffix helper**

Create `backend/__tests__/site2.test.js`:

```js
const { stripBranchSuffix } = require('../automation/site2')

test('strips branch suffix', () => {
  expect(stripBranchSuffix('0102721191-068')).toBe('0102721191')
})

test('leaves plain tax id unchanged', () => {
  expect(stripBranchSuffix('0102721191')).toBe('0102721191')
})
```

```bash
npx jest backend/__tests__/site2.test.js --verbose
```

Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/automation/site2.js backend/__tests__/site2.test.js
git commit -m "feat: Website 2 Playwright automation module with branch suffix stripping"
```

---

### Task 4: Automation engine

**Files:**
- Create: `backend/automation/automationEngine.js`

- [ ] **Step 1: Create `backend/automation/automationEngine.js`**

```js
const { chromium } = require('playwright')
const { runSite1 } = require('./site1')
const { runSite2 } = require('./site2')
const { getInvoices, updateInvoiceStatus } = require('../invoiceStore')
const fs = require('fs')
const path = require('path')

let browser = null
let isRunning = false
let stepMode = false
let stepResolve = null        // Resolved when user clicks "Step →"
let captchaResolve = null     // Resolved when user submits CAPTCHA answer or skips
let currentSessionDir = null
let broadcastFn = null        // Set by wsHandler: (msg) => void

function setBroadcast(fn) { broadcastFn = fn }

function broadcast(msg) {
  if (broadcastFn) broadcastFn(msg)
}

function saveScreenshot(sessionDir, invoiceId, site, base64Data) {
  const screenshotsDir = path.join(sessionDir, 'screenshots')
  fs.mkdirSync(screenshotsDir, { recursive: true })
  const filename = `${invoiceId.replace(/[^a-z0-9]/gi, '_')}_site${site}.png`
  fs.writeFileSync(path.join(screenshotsDir, filename), Buffer.from(base64Data, 'base64'))
  return filename
}

async function waitForCaptchaAnswer(base64Image, attempt) {
  broadcast({ type: 'captcha-required', payload: { image: base64Image, attempt } })
  return new Promise((resolve) => { captchaResolve = resolve })
}

async function waitForStep() {
  if (!stepMode) return
  broadcast({ type: 'step-waiting' })
  return new Promise((resolve) => { stepResolve = resolve })
}

function submitCaptchaAnswer(answer) {
  if (captchaResolve) { captchaResolve(answer); captchaResolve = null }
}

function skipInvoice() {
  if (captchaResolve) { captchaResolve(null); captchaResolve = null }
}

function advanceStep() {
  if (stepResolve) { stepResolve(); stepResolve = null }
}

async function startProcessing(sessionDir, mode = 'auto') {
  if (isRunning) return
  isRunning = true
  stepMode = mode === 'step'
  currentSessionDir = sessionDir

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const invoices = getInvoices().filter(i => i.status === 'pending')

  for (const invoice of invoices) {
    updateInvoiceStatus(invoice.id, 'processing')
    broadcast({ type: 'invoice-status', payload: { id: invoice.id, status: 'processing' } })

    let finalStatus = 'pass'
    let site1Screenshot = null
    let site2Screenshot = null

    try {
      // Site 1
      const site1Result = await runSite1(page, invoice, waitForCaptchaAnswer)
      if (site1Result.status === 'skipped') {
        finalStatus = 'skipped'
      } else {
        site1Screenshot = saveScreenshot(sessionDir, invoice.id, 1, site1Result.screenshotBase64)
        if (site1Result.status === 'invalid-invoice') {
          finalStatus = 'invalid-invoice'
        } else {
          // Site 2 (only if Site 1 passed)
          const site2Result = await runSite2(page, invoice)
          site2Screenshot = saveScreenshot(sessionDir, invoice.id, 2, site2Result.screenshotBase64)
          if (site2Result.status === 'invalid-business') finalStatus = 'invalid-business'
        }
      }
    } catch (e) {
      console.error(`[Engine] Error on invoice ${invoice.id}:`, e.message)
      broadcast({ type: 'error', payload: `Error processing ${invoice.id}: ${e.message}` })
      finalStatus = 'skipped'
    }

    updateInvoiceStatus(invoice.id, finalStatus, { site1Screenshot, site2Screenshot })
    broadcast({ type: 'invoice-status', payload: { id: invoice.id, status: finalStatus, site1Screenshot, site2Screenshot } })

    await waitForStep()
  }

  await browser.close()
  browser = null
  isRunning = false
  broadcast({ type: 'batch-complete' })
}

function pauseProcessing() {
  stepMode = true
  broadcast({ type: 'mode-changed', payload: 'step' })
}

function resumeProcessing() {
  stepMode = false
  if (stepResolve) advanceStep()
  broadcast({ type: 'mode-changed', payload: 'auto' })
}

module.exports = { startProcessing, submitCaptchaAnswer, skipInvoice, advanceStep, pauseProcessing, resumeProcessing, setBroadcast }
```

- [ ] **Step 2: Commit**

```bash
git add backend/automation/automationEngine.js
git commit -m "feat: automation engine orchestrates invoice processing with CAPTCHA and step mode"
```

---

### Task 5: Wire automation engine into WebSocket handler

**Files:**
- Modify: `backend/wsHandler.js`
- Modify: `backend/index.js`

- [ ] **Step 1: Update `backend/wsHandler.js`**

```js
const { addInvoice } = require('./invoiceStore')
const engine = require('./automation/automationEngine')

function handleMessage(ws, msg, wss) {
  console.log('[WS] Received:', msg.type)
  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }))
      break

    case 'add-manual-invoice': {
      const { invoiceCode, invoiceNumber, sellerName, taxId, sellerAddress, totalAmount } = msg.payload
      const required = { invoiceCode, invoiceNumber, sellerName, taxId, totalAmount }
      const missing = Object.entries(required).filter(([,v]) => !v).map(([k]) => k)
      if (missing.length > 0) {
        ws.send(JSON.stringify({ type: 'error', payload: `Missing fields: ${missing.join(', ')}` }))
        break
      }
      const invoice = {
        id: `${invoiceCode}-${invoiceNumber}`,
        source: 'manual', invoiceCode,
        invoiceNumber: String(invoiceNumber),
        sellerName, taxId,
        sellerAddress: sellerAddress || '',
        totalAmount: Number(totalAmount),
        status: 'pending'
      }
      const result = addInvoice(invoice)
      if (!result.ok) ws.send(JSON.stringify({ type: 'error', payload: result.error }))
      else ws.send(JSON.stringify({ type: 'invoice-added', payload: invoice }))
      break
    }

    case 'start-processing': {
      const { sessionDir, mode } = msg.payload
      engine.startProcessing(sessionDir, mode).catch(e => {
        broadcast(wss, { type: 'error', payload: e.message })
      })
      break
    }

    case 'captcha-answer':
      engine.submitCaptchaAnswer(msg.payload.answer)
      break

    case 'skip-invoice':
      engine.skipInvoice()
      break

    case 'advance-step':
      engine.advanceStep()
      break

    case 'set-mode':
      if (msg.payload === 'step') engine.pauseProcessing()
      else engine.resumeProcessing()
      break

    default:
      console.warn('[WS] Unknown message type:', msg.type)
  }
}

function broadcast(wss, msg) {
  const data = JSON.stringify(msg)
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(data)
  })
}

module.exports = { handleMessage, broadcast }
```

- [ ] **Step 2: Set broadcast function in `backend/index.js`**

Add after `wss` is created:

```js
const engine = require('./automation/automationEngine')
const { broadcast } = require('./wsHandler')
engine.setBroadcast((msg) => broadcast(wss, msg))
```

- [ ] **Step 3: Commit**

```bash
git add backend/wsHandler.js backend/index.js
git commit -m "feat: wire automation engine into WebSocket handler"
```

---

### Task 6: Frontend — CAPTCHA modal component

**Files:**
- Create: `src/components/CaptchaModal.jsx`

- [ ] **Step 1: Create `src/components/CaptchaModal.jsx`**

```jsx
import { useState } from 'react'

export default function CaptchaModal({ imageBase64, attempt, onSubmit, onSkip }) {
  const [answer, setAnswer] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!answer.trim()) return
    onSubmit(answer.trim())
    setAnswer('')
  }

  return (
    <div className="modal-overlay">
      <div className="modal captcha-modal">
        <h3>CAPTCHA Required</h3>
        {attempt > 1 && <p className="error">Wrong answer — please try again (attempt {attempt})</p>}
        <img
          src={`data:image/png;base64,${imageBase64}`}
          alt="CAPTCHA"
          className="captcha-image"
        />
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="text"
            className="mock-input"
            placeholder="Type the CAPTCHA text..."
            value={answer}
            onChange={e => setAnswer(e.target.value)}
          />
          <div className="modal-actions">
            <button type="button" className="btn-skip" onClick={onSkip}>
              Skip Invoice ⚠️
            </button>
            <button type="submit" className="btn-primary" disabled={!answer.trim()}>
              Submit →
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

Add to `src/index.css`:

```css
.captcha-modal { max-width: 360px; }
.captcha-image {
  display: block; margin: 16px auto;
  border-radius: 8px; border: 1px solid var(--glass-border);
  max-width: 100%;
}
.btn-skip {
  background: transparent; color: var(--skip);
  border: 1px solid var(--skip); border-radius: 8px;
  padding: 10px 16px; cursor: pointer; font-family: inherit;
}
```

- [ ] **Step 2: Wire CaptchaModal into `src/App.jsx`**

Add state and handlers:

```jsx
// Add to state:
const [captcha, setCaptcha] = useState(null) // { image, attempt }
const [stepWaiting, setStepWaiting] = useState(false)

// Add to useWebSocket handler:
if (msg.type === 'captcha-required') setCaptcha(msg.payload)
if (msg.type === 'invoice-status') {
  setInvoices(prev => prev.map(i => i.id === msg.payload.id ? { ...i, ...msg.payload } : i))
  setCaptcha(null)
}
if (msg.type === 'step-waiting') setStepWaiting(true)
if (msg.type === 'batch-complete') setStepWaiting(false)
if (msg.type === 'mode-changed') { /* update mode state */ }

// Add handlers:
function handleCaptchaSubmit(answer) {
  send({ type: 'captcha-answer', payload: { answer } })
  setCaptcha(null)
}
function handleSkipInvoice() {
  send({ type: 'skip-invoice' })
  setCaptcha(null)
}
function handleAdvanceStep() {
  send({ type: 'advance-step' })
  setStepWaiting(false)
}
```

Add to JSX:

```jsx
{captcha && (
  <CaptchaModal
    imageBase64={captcha.image}
    attempt={captcha.attempt}
    onSubmit={handleCaptchaSubmit}
    onSkip={handleSkipInvoice}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/CaptchaModal.jsx src/App.jsx src/index.css
git commit -m "feat: CAPTCHA modal with skip and retry support"
```
