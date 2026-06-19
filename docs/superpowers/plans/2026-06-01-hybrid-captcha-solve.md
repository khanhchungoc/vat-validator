# Hybrid CAPTCHA Solver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the CAPTCHA text input box inside the Electron app's UI, while implementing human-like sequential keyboard typing (with 80ms delay) in the background GDT automation scripts to prevent "Incorrect CAPTCHA" React blocks, supporting both UI and direct browser solving concurrently.

**Architecture:** We will update the React overlay modal to render a focused input field and submit button. In the Playwright backend, we will implement a non-blocking asynchronous promise race between GDT's own browser events (direct solve) and the Electron UI submission (which programmatically types character-by-character with keyboard events to satisfy React listeners). The GDT browser will launch minimized to prevent desktop clutter.

**Tech Stack:** React (Vite/Electron frontend), Playwright (headless-false node runner), WebSockets (communication layer).

---

## File Structure

We will modify the following existing files:
1. `src/components/CaptchaModal.jsx` - Restore the HTML form, input text field, auto-focus element, and submit handler.
2. `src/App.jsx` - Pass the existing `handleCaptchaSubmit` function as the `onSubmit` prop to `<CaptchaModal>`.
3. `backend/automation/automationEngine.js` - Inject `--start-minimized` chromium launch arguments to keep the desktop clean.
4. `backend/automation/gdtInvoicePortal.js` - Implement the Promise-race block, GDT form clearing, and human-like sequential typing (`page.keyboard.type` with 80ms delay) on GDT Invoice Portal (Site 1).
5. `backend/automation/gdtTaxpayerPortal.js` - Implement the same typing and race logic on GDT Taxpayer Portal (Site 2).

---

## Tasks

### Task 1: Restore Electron CAPTCHA Input UI

**Files:**
- Modify: `src/components/CaptchaModal.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Update `src/components/CaptchaModal.jsx`**
Modify the file to render a form with a text input field (with `autoFocus`) and a Submit button, handling form validation and callback submissions.

Replace the entire contents of `src/components/CaptchaModal.jsx` with:
```jsx
import { useEffect, useState, useRef } from 'react'

export default function CaptchaModal({ imageBase64, attempt, onSubmit, onSkip }) {
  const [answer, setAnswer] = useState('')
  const inputRef = useRef(null)

  // Auto-focus the input box whenever the modal appears
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [imageBase64])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!answer.trim()) return
    onSubmit(answer.trim())
    setAnswer('')
  }

  return (
    <div className="modal-overlay">
      <div className="modal captcha-modal" style={{ textAlign: 'center', padding: '24px 30px' }}>
        <h3 style={{ fontSize: '1.25rem', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          🔑 CAPTCHA Solve Required
        </h3>
        
        <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: 20 }}>
          Enter the CAPTCHA below, or click directly on the <strong>opened browser window</strong> to solve it on the site.
        </p>

        {attempt > 1 && (
          <p className="error" style={{ color: 'var(--fail)', fontWeight: '600', marginBottom: 16, fontSize: '0.85rem' }}>
            ❌ Incorrect CAPTCHA entered. Please try GDT's refreshed code (Attempt {attempt})
          </p>
        )}
        
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'inline-block', marginBottom: 24 }}>
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt="CAPTCHA Hint"
            className="captcha-image"
            style={{ 
              display: 'block',
              margin: '0 auto',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          />
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '280px', margin: '0 auto 24px auto' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter CAPTCHA..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-main)',
                fontSize: '0.95rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={!answer.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Verify
            </button>
          </div>
        </form>

        <div style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa', animation: 'console-indicator-pulse 1.5s infinite' }} />
          <span>Or solve directly in the GDT browser window...</span>
        </div>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'center' }}>
          <button 
            type="button" 
            className="btn-skip" 
            onClick={onSkip}
            style={{ width: '100%', maxWidth: '200px' }}
          >
            Skip Invoice
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/App.jsx`**
Pass the `handleCaptchaSubmit` function to the `<CaptchaModal>` tag as the `onSubmit` prop.

In `src/App.jsx`, modify lines 374-381:
```jsx
            {captchaData && (
              <CaptchaModal
                imageBase64={captchaData.image}
                attempt={captchaData.attempt}
                onSubmit={handleCaptchaSubmit}
                onSkip={handleSkipInvoice}
              />
            )}
```

- [ ] **Step 3: Run production frontend compile check**
Verify the React project compiles successfully with the restored form input.

Run: `npm run build`
Expected: Compilation completes without errors.

- [ ] **Step 4: Commit UI Changes**
```bash
git add src/components/CaptchaModal.jsx src/App.jsx
git commit -m "feat(ui): restore CAPTCHA input box and autofocus in CaptchaModal"
```

---

### Task 2: Background Minimized Browser Launch

**Files:**
- Modify: `backend/automation/automationEngine.js`

- [ ] **Step 1: Add Chromium minimized start argument**
Update the Playwright Chrome browser launching options inside `automationEngine.js` to run in minimized state so it stays quietly in the background without cluttering the desktop, but can be restored via the OS taskbar.

In `backend/automation/automationEngine.js`, modify lines 81-84:
```javascript
    browser = await chromium.launch({ 
      headless: false,
      args: ['--start-minimized']
    })
```

- [ ] **Step 2: Commit launch options change**
```bash
git add backend/automation/automationEngine.js
git commit -m "feat(automation): start Playwright Chrome minimized to prevent desktop clutter"
```

---

### Task 3: Site 1 (Invoice Portal) Hybrid Solve Interception

**Files:**
- Modify: `backend/automation/gdtInvoicePortal.js`

- [ ] **Step 1: Implement Promise-race and sequential typing inside `gdtInvoicePortal.js`**
We will implement a clean Promise race:
- The user can solve it directly in the GDT browser (resolves via GDT's native network API response).
- The user can type it in our Electron UI modal. We intercept this, clear GDT's field, focus it, and use `page.keyboard.type` with an 80ms delay to satisfy React event bindings, then press `Enter`.

In `backend/automation/gdtInvoicePortal.js`, replace the wait-for-solve block (lines 142-171) with the following complete block:
```javascript
    let userSkipped = false
    let electronAnswer = null

    let resolveAnswerSubmitted
    const answerSubmittedPromise = new Promise(resolve => {
      resolveAnswerSubmitted = resolve
    })

    const skipPromise = onCaptcha(captchaBase64, attempt).then(ans => {
      if (ans === null) {
        userSkipped = true
        resolveAnswerSubmitted()
      } else {
        electronAnswer = ans
        resolveAnswerSubmitted()
      }
    })

    // Race GDT's API response directly (user solved directly in browser)
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/sco-query/guest-invoices'),
      { timeout: 600000 } // 10 minutes timeout
    ).catch(() => null)

    const response = await Promise.race([
      responsePromise,
      (async () => {
        await answerSubmittedPromise
        if (userSkipped) return null
        if (electronAnswer) {
          onLog(`Typing CAPTCHA answer "${electronAnswer}" into GDT portal...`)
          // Clear and focus GDT's input field
          await page.fill('input#cvalue', '')
          await page.focus('input#cvalue')
          // Simulate human typing to satisfy React/AntD state listeners
          await page.keyboard.type(electronAnswer, { delay: 80 })
          // Submit the form
          await page.keyboard.press('Enter')
          // Wait for response to finish
          return await responsePromise
        }
        return null
      })()
    ])

    if (userSkipped || !response) {
      return { ok: false, status: 'skipped' }
    }
```

- [ ] **Step 2: Commit Site 1 modifications**
```bash
git add backend/automation/gdtInvoicePortal.js
git commit -m "feat(automation): integrate dual-solve race with human typing on Site 1"
```

---

### Task 4: Site 2 (Taxpayer Portal) Hybrid Solve Interception

**Files:**
- Modify: `backend/automation/gdtTaxpayerPortal.js`

- [ ] **Step 1: Implement Promise-race and sequential typing inside `gdtTaxpayerPortal.js`**
We will implement the exact same Promise race and keyboard entry delay for the Taxpayer Portal.

In `backend/automation/gdtTaxpayerPortal.js`, replace the wait-for-solve block (lines 63-93) with the following complete block:
```javascript
    let userSkipped = false
    let electronAnswer = null

    let resolveAnswerSubmitted
    const answerSubmittedPromise = new Promise(resolve => {
      resolveAnswerSubmitted = resolve
    })

    const skipPromise = onCaptcha(captchaBase64, attempt).then(ans => {
      if (ans === null) {
        userSkipped = true
        resolveAnswerSubmitted()
      } else {
        electronAnswer = ans
        resolveAnswerSubmitted()
      }
    })

    // We wait for GDT's three distinct result states to appear in the DOM
    const resultPromise = page.locator('text=Vui lòng nhập đúng mã xác nhận')
      .or(page.locator('text=BẢNG THÔNG TIN TRA CỨU'))
      .or(page.locator('text=Không tìm thấy người nộp thuế'))
      .waitFor({ state: 'visible', timeout: 600000 }) // Wait up to 10 minutes
      .catch(() => null)

    // Wait for either the user to solve it in the GDT browser or Electron UI
    await Promise.race([
      resultPromise,
      (async () => {
        await answerSubmittedPromise
        if (userSkipped) return
        if (electronAnswer) {
          onLog(`Typing CAPTCHA answer "${electronAnswer}" into GDT portal...`)
          // Clear and focus GDT's taxpayer input field
          await page.fill('input#captcha', '')
          await page.focus('input#captcha')
          // Simulate human typing
          await page.keyboard.type(electronAnswer, { delay: 80 })
          // Press Enter to submit
          await page.keyboard.press('Enter')
          // Wait for DOM updates to reflect
          await resultPromise
        }
      })()
    ])

    if (userSkipped) {
      return { ok: false, status: 'skipped' }
    }
```

- [ ] **Step 2: Commit Site 2 modifications**
```bash
git add backend/automation/gdtTaxpayerPortal.js
git commit -m "feat(automation): integrate dual-solve race with human typing on Site 2"
```

---

### Task 5: Testing & Verification

- [ ] **Step 1: Run complete Jest unit tests**
Ensure that the entire existing mock-based test suite remains 100% passing.

Run: `npm test`
Expected: 47/47 passing tests.

- [ ] **Step 2: Perform End-to-End manual checks**
Open the application (`npm run dev`), load some sample invoices, start processing, and confirm that:
1. GDT Chrome opens minimized in the background.
2. The Electron UI shows the CAPTCHA modal and focuses the input box automatically.
3. Typing the CAPTCHA in the Electron modal and hitting Enter types the CAPTCHA beautifully and processes successfully without any GDT React event errors.
4. Direct solves inside the minimized browser (after maximizing it) still intercept and process perfectly.
