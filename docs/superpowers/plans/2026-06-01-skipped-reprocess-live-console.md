# Skipped Invoices & Sliding Activity Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to reprocess skipped invoices and view Playwright's progress in a toggleable sliding sidebar log console.

**Architecture:** We extend `invoiceStore` with a reset function, handle `reset-skipped` in `wsHandler`, broadcast steps via `processing-log` in `automationEngine`, add `onLog` to site automation scripts, create a sliding flexbox layout in CSS, build a glassmorphic expandable log accordion component, and wire them together in the dashboard.

**Tech Stack:** JavaScript, React, CSS, Playwright, WebSockets

---

### Task 1: Backend Store & WS Handler for Skipped Invoices

**Files:**
- Modify: `backend/invoiceStore.js`
- Modify: `backend/wsHandler.js`

- [ ] **Step 1: Update `backend/invoiceStore.js`**
Add the `resetSkippedInvoices` function to find skipped invoices and reset their fields:

```javascript
function resetSkippedInvoices() {
  let count = 0
  invoices.forEach(inv => {
    if (inv.status === 'skipped') {
      inv.status = 'pending'
      inv.site1Screenshot = null
      inv.site2Screenshot = null
      count++
    }
  })
  return count
}
```

Make sure to export `resetSkippedInvoices` at the bottom:
```javascript
module.exports = { addInvoice, getInvoices, updateInvoiceStatus, clearInvoices, loadInvoices, resetSkippedInvoices }
```

- [ ] **Step 2: Update `backend/wsHandler.js`**
Add `resetSkippedInvoices` and `saveSession` imports, and implement the `'reset-skipped'` case:

```javascript
const { addInvoice, getInvoices, resetSkippedInvoices } = require('./invoiceStore')
const { saveSession } = require('./sessionManager')
```

Add the case inside the switch block:
```javascript
    case 'reset-skipped': {
      const { sessionDir } = msg.payload || {}
      const count = resetSkippedInvoices()
      if (count > 0 && sessionDir) {
        saveSession(sessionDir, getInvoices())
      }
      broadcast(wss, { type: 'invoices-reset', payload: getInvoices() })
      break
    }
```

- [ ] **Step 3: Run Jest tests to check for regressions**
Run: `npm test`
Expected: 46/46 tests passing.

- [ ] **Step 4: Commit**
```bash
git add backend/invoiceStore.js backend/wsHandler.js
git commit -m "feat(backend): add reset-skipped invoices function and ws handler"
```

---

### Task 2: Playwright Progress Logs Integration

**Files:**
- Modify: `backend/automation/automationEngine.js`
- Modify: `backend/automation/site1.js`
- Modify: `backend/automation/site2.js`

- [ ] **Step 1: Modify `backend/automation/automationEngine.js`**
Add progress logging helpers and clear/broadcast hooks.

Define `logStep` inside `automationEngine.js` around line 23:
```javascript
function logStep(invoiceId, message) {
  console.log(`[LogStep] [${invoiceId}]: ${message}`)
  broadcast({
    type: 'processing-log',
    payload: {
      invoiceId,
      message,
      timestamp: new Date().toLocaleTimeString()
    }
  })
}
```

Inside `startProcessing` around line 66, clear the logs at startup:
```javascript
  isRunning = true
  stepMode = mode === 'step'
  currentSessionDir = sessionDir

  // Clear client activity logs at start
  broadcast({ type: 'processing-log-clear' })
```

Update lines 88 and 99 where `runSite1` and `runSite2` are invoked to pass the logging callback as the fourth argument:
```javascript
          // Site 1
          const site1Result = await runSite1(
            page, 
            invoice, 
            (img, att) => waitForCaptchaAnswer(invoice.id, img, att),
            (msg) => logStep(invoice.id, `[Site 1] ${msg}`)
          )
```
and:
```javascript
              // Site 2 (only if Site 1 passed)
              const site2Result = await runSite2(
                page, 
                invoice, 
                (img, att) => waitForCaptchaAnswer(invoice.id, img, att),
                (msg) => logStep(invoice.id, `[Site 2] ${msg}`)
              )
```

- [ ] **Step 2: Modify `backend/automation/site1.js`**
Update `runSite1` signature and add progress triggers:
```javascript
async function runSite1(page, invoice, onCaptcha, onLog = () => {}) {
  onLog('Navigating to GDT Portal (https://hoadondientu.gdt.gov.vn/)...')
  await page.goto(SITE1_URL, { waitUntil: 'networkidle', timeout: 30000 })

  // Close announcement modal
  try {
    const closeBtn = await page.$('.ant-modal-close')
    if (closeBtn) {
      onLog('Bypassing announcement popup...')
      await closeBtn.click()
      await page.waitForTimeout(500)
    }
  } catch (err) {}

  onLog(`Filling invoice details: Seller Tax ID (${invoice.taxId}), Code, Number, Amount...`)
```

Before captcha capture around line 65:
```javascript
    onLog(`Capturing CAPTCHA image (attempt ${attempt})...`)
```

Before prompting around line 103:
```javascript
    onLog('Prompting user for CAPTCHA input...')
```

After captcha submit around line 109:
```javascript
    onLog(`Submitting CAPTCHA answer: "${answer}"...`)
```

After 401 check around line 116:
```javascript
    if (response.status() === 401) {
      onLog('GDT returned HTTP 401 (Incorrect CAPTCHA). Refreshing and retrying...')
      console.log(`[Site 1] Incorrect CAPTCHA submitted (attempt ${attempt}). Retrying...`)
      continue
    }
```

When 200 invoice not found is caught around line 140:
```javascript
      if (!body || Object.keys(body).length === 0) {
        onLog('GDT returned HTTP 200 (Invoice not found). Capturing error screenshot...')
```

When 200 invoice found is caught around line 149:
```javascript
      } else {
        onLog('GDT returned HTTP 200 (Invoice verified!). Capturing success screenshot...')
```

In the fallback around line 173:
```javascript
  onLog('API response timed out or failed. Falling back to DOM verification checks...')
```

- [ ] **Step 3: Modify `backend/automation/site2.js`**
Update `runSite2` signature and add progress logs:
```javascript
async function runSite2(page, invoice, onCaptcha, onLog = () => {}) {
  const rootTaxId = stripBranchSuffix(invoice.taxId)
  onLog(`Stripping branch suffix from Tax ID (using: ${rootTaxId})...`)
  onLog('Navigating to Taxpayer Portal (https://tracuunnt.gdt.gov.vn/)...')
  await page.goto(SITE2_URL, { waitUntil: 'networkidle', timeout: 30000 })

  await page.fill('input[name="mst"], input[id*="mst"], input[placeholder*="mã số thuế"]', rootTaxId)

  let attempt = 0
  while (true) {
    attempt++
    onLog(`Capturing CAPTCHA image (attempt ${attempt})...`)
```

Before prompting around line 46:
```javascript
    onLog('Prompting user for CAPTCHA input...')
```

Before submitting around line 53:
```javascript
    onLog(`Submitting CAPTCHA answer: "${answer}"...`)
```

If CAPTCHA fails around line 60:
```javascript
    if (formIsStillVisible && await formIsStillVisible.isVisible()) {
      onLog('CAPTCHA incorrect. Refreshing and retrying...')
      continue
    }
```

At screenshots evaluation around line 71:
```javascript
  const isNotFound = await page.$('text=Không tìm thấy, text=không có kết quả, .no-result')
  if (isNotFound) {
    onLog('Taxpayer not found (Invalid business!). Capturing error screenshot...')
  } else {
    onLog('Verification successful! Capturing business status screenshot...')
  }
  const status = isNotFound ? 'invalid-business' : 'pass'
```

- [ ] **Step 4: Run Jest tests**
Run: `npm test`
Expected: 46/46 passing.

- [ ] **Step 5: Commit**
```bash
git add backend/automation/automationEngine.js backend/automation/site1.js backend/automation/site2.js
git commit -m "feat(automation): integrate real-time playwright progress logs"
```

---

### Task 3: LiveConsole Component & CSS Layout

**Files:**
- Create: `src/components/LiveConsole.jsx`
- Modify: `src/index.css`

- [ ] **Step 1: Create `src/components/LiveConsole.jsx`**
Build the LiveConsole accordion component:

```jsx
import { useEffect, useRef, useState } from 'react'

export default function LiveConsole({ logs, isProcessing, onClose }) {
  const [isOpen, setIsOpen] = useState(true)
  const logsEndRef = useRef(null)

  useEffect(() => {
    if (logsEndRef.current && isOpen) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, isOpen])

  // Auto expand when processing begins
  useEffect(() => {
    if (isProcessing) {
      setIsOpen(true)
    }
  }, [isProcessing])

  return (
    <div className={`live-console ${isOpen ? 'expanded' : 'collapsed'}`}>
      <div className="console-accordion-header">
        <button 
          className="console-header-btn"
          onClick={() => setIsOpen(!isOpen)}
          title={isOpen ? "Collapse console" : "Expand console"}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className={`console-status-indicator ${isProcessing ? 'active' : 'idle'}`}></div>
            <span className="console-title-text">&gt;_ Live Activity Log</span>
          </div>
          <span className={`console-chevron ${isOpen ? 'open' : ''}`}>▼</span>
        </button>
        <button className="console-close-btn" onClick={onClose} title="Hide console sidebar">✕</button>
      </div>

      {isOpen && (
        <div className="console-body">
          {logs.length === 0 ? (
            <div className="console-placeholder">
              <span>Waiting for automation to start. Real-time steps will appear here...</span>
            </div>
          ) : (
            <div className="console-lines">
              {logs.map((log, index) => (
                <div key={index} className="console-line">
                  <span className="console-time">[{log.timestamp}]</span>
                  <span className="console-text">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `src/index.css`**
Append styles for the sliding console and the layout split:

```css
/* Sidebar Sliding Layout */
.app-layout {
  display: flex;
  width: 100%;
  max-width: 1300px;
  margin: 0 auto;
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
.layout-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 8px;
  transition: all 0.3s ease;
}
.layout-right {
  width: 360px;
  flex-shrink: 0;
  margin-left: 24px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  transition: transform 0.3s ease, margin 0.3s ease, opacity 0.2s ease;
  transform: translateX(0);
  opacity: 1;
}

/* When sidebar is hidden */
.app-layout.no-sidebar .layout-right {
  width: 0;
  margin-left: 0;
  transform: translateX(100%);
  opacity: 0;
  pointer-events: none;
}

/* Slide in button */
.btn-console-toggle {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  color: var(--text-main);
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}
.btn-console-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent);
}
.btn-console-toggle.active {
  background: rgba(59, 130, 246, 0.15);
  border-color: var(--accent);
  color: #60a5fa;
}

/* Console Styling */
.live-console {
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: 'Consolas', 'Courier New', Courier, monospace;
}
.live-console.expanded {
  flex: 1;
  min-height: 250px;
}
.live-console.collapsed {
  flex: 0 0 auto;
  min-height: 0;
}
.console-accordion-header {
  background: rgba(30, 41, 59, 0.7);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.console-header-btn {
  background: none;
  border: none;
  flex: 1;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  color: var(--text-main);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
}
.console-header-btn:hover {
  background: rgba(255, 255, 255, 0.02);
}
.console-close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 12px 16px;
  font-size: 0.9rem;
  transition: color 0.2s;
}
.console-close-btn:hover {
  color: var(--fail);
}
.console-status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.console-status-indicator.idle {
  background: #64748b;
  box-shadow: 0 0 4px #64748b;
}
.console-status-indicator.active {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
  animation: console-indicator-pulse 1.5s infinite;
}
@keyframes console-indicator-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}
.console-chevron {
  font-size: 0.65rem;
  color: var(--text-muted);
  transition: transform 0.3s;
}
.console-chevron.open {
  transform: rotate(180deg);
}
.console-body {
  flex: 1;
  min-height: 0;
  padding: 14px;
  overflow-y: auto;
  font-size: 0.8rem;
  line-height: 1.5;
}
.console-body::-webkit-scrollbar {
  width: 6px;
}
.console-body::-webkit-scrollbar-track {
  background: transparent;
}
.console-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
}
.console-body::-webkit-scrollbar-thumb:hover {
  background: var(--accent);
}
.console-placeholder {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-style: italic;
  text-align: center;
  font-size: 0.75rem;
}
.console-lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.console-line {
  display: flex;
  gap: 8px;
  word-break: break-all;
}
.console-time {
  color: #3b82f6;
  flex-shrink: 0;
}
.console-text {
  color: #e2e8f0;
}

/* Media Query Responsive Collapse */
@media (max-width: 960px) {
  .app-layout {
    flex-direction: column;
  }
  .layout-right {
    width: 100%;
    margin-left: 0;
    margin-top: 16px;
  }
  .app-layout.no-sidebar .layout-right {
    display: none;
  }
}
```

- [ ] **Step 3: Commit**
```bash
git add src/components/LiveConsole.jsx src/index.css
git commit -m "feat(frontend): create LiveConsole component and slide out styles"
```

---

### Task 4: Main Dashboard Wiring (`src/App.jsx`) & Final Build

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Modify `src/App.jsx`**
Import `LiveConsole`, wire WebSocket logs and reset events, toggle console sidebar, and adjust layouts:

1. Import `LiveConsole`:
```javascript
import LiveConsole from './components/LiveConsole'
```

2. Add states inside `App()`:
```javascript
  const [logs, setLogs] = useState([])
  const [showConsole, setShowConsole] = useState(false)
```

3. Update `handleWsMessage` to receive logs:
```javascript
    if (msg.type === 'invoices-reset') {
      setInvoices(msg.payload)
    }
    if (msg.type === 'processing-log-clear') {
      setLogs([])
    }
    if (msg.type === 'processing-log') {
      setLogs(prev => [...prev, msg.payload])
    }
```

4. Inside `handleStartProcessing`, auto-open the console and clear old logs:
```javascript
    setLogs([])
    setShowConsole(true)
    setProcessingMode(mode)
```

5. In the header JSX, add the log drawer toggle button right next to wsStatus:
```jsx
      <header className="app-header">
        <h1>VAT-validator</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            className={`btn-console-toggle ${showConsole ? 'active' : ''}`}
            onClick={() => setShowConsole(!showConsole)}
            title="Toggle Live Activity Console"
          >
            {showConsole ? '✕ Close Log' : '📋 Activity Log'}
          </button>
          <span className="ws-status">{wsStatus}</span>
        </div>
      </header>
```

6. Add the "🔄 Reset Skipped to Pending" button in the buttons list:
```jsx
              <button 
                className="btn-primary" 
                onClick={() => handleStartProcessing(processingMode)}
                disabled={invoices.length === 0}
              >
                🚀 Start Processing
              </button>
              {invoices.some(i => i.status === 'skipped') && (
                <button 
                  className="btn-secondary" 
                  onClick={() => send({ type: 'reset-skipped', payload: { sessionDir: currentSessionDir } })}
                >
                  🔄 Reset Skipped to Pending
                </button>
              )}
```

7. Reorganize `<main>` children to fit the side-by-side sliding layout:
```jsx
      <main className="app-main" style={{ maxWidth: 'none', margin: '0', padding: '0', display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div className={`app-layout ${showConsole ? 'with-sidebar' : 'no-sidebar'}`}>
          <div className="layout-left">
            {!currentSessionDir && invoices.length === 0 && (
              <ResumePanel onResume={handleResume} />
            )}
            
            <DropZone onFilesUploaded={handleFilesUploaded} disabled={isProcessing} />
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 12 }}>
              {!isProcessing ? (
                <>
                  <button 
                    className="btn-primary" 
                    onClick={() => handleStartProcessing(processingMode)}
                    disabled={invoices.length === 0}
                  >
                    🚀 Start Processing
                  </button>
                  {invoices.some(i => i.status === 'skipped') && (
                    <button 
                      className="btn-secondary" 
                      onClick={() => send({ type: 'reset-skipped', payload: { sessionDir: currentSessionDir } })}
                    >
                      🔄 Reset Skipped to Pending
                    </button>
                  )}
                  <ModeToggle 
                    mode={processingMode} 
                    onChange={handleModeChange} 
                    disabled={invoices.length === 0} 
                  />
                  <button 
                    className="btn-secondary" 
                    onClick={() => setShowManualForm(true)}
                  >
                    + Add Invoice Manually
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-stop" onClick={handleStopProcessing}>
                    🛑 Stop
                  </button>
                  <ModeToggle 
                    mode={processingMode} 
                    onChange={handleModeChange} 
                    disabled={false} 
                  />
                </>
              )}
            </div>

            <StepButton visible={isProcessing && isStepWaiting} onStep={handleAdvanceStep} />
            <ProgressBar invoices={invoices} />

            <ErrorBanner error={processingError} onRetry={handleRetry} onSkip={handleErrorSkip} />
            <InvoiceQueue invoices={invoices} />
            <DownloadButtons pdfUrl={downloadUrls.pdfUrl} xlsxUrl={downloadUrls.xlsxUrl} />
          </div>

          <div className="layout-right">
            <LiveConsole 
              logs={logs} 
              isProcessing={isProcessing} 
              onClose={() => setShowConsole(false)} 
            />
          </div>
        </div>
      </main>
```

- [ ] **Step 2: Verify frontend compiles cleanly**
Run Vite production build: `npm run build`
Expected: PASS with zero bundle errors.

- [ ] **Step 3: Run Jest tests**
Run: `npm test`
Expected: 46/46 passing.

- [ ] **Step 4: Commit and stage final modifications**
```bash
git add src/App.jsx
git commit -m "feat(frontend): wire reset-skipped action, logs listeners, and sidebar layout"
```
