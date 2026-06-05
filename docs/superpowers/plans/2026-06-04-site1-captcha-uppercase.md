# Uppercase CAPTCHA for Site 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify the application to automatically convert the CAPTCHA entry to uppercase in real-time as the user types, specifically and exclusively when solving a CAPTCHA for Site 1 (GDT Invoice Portal).

**Architecture:** We will pass a `site` property (1 or 2) in the WebSocket `captcha-required` payload from the backend. The React client will receive this property in `captchaData` and pass it down to `CaptchaModal`. Inside `CaptchaModal`, the `onChange` input handler will intercept the input text and programmatically apply `.toUpperCase()` in real-time if `site === 1`.

**Tech Stack:** React, Playwright/Node (backend), Jest (for backend testing)

---

### Task 1: Backend - Add site identifier to WebSocket captcha-required event

**Files:**
- Modify: [backend/automation/automationEngine.js](file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/backend/automation/automationEngine.js)
- Modify: [backend/__tests__/automationEngine_sessions.test.js](file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/backend/__tests__/automationEngine_sessions.test.js)

- [ ] **Step 1: Write the failing test**
Modify [backend/__tests__/automationEngine_sessions.test.js](file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/backend/__tests__/automationEngine_sessions.test.js) to add a test verifying that `waitForCaptchaAnswer` broadcasts the `site` parameter.

Replace lines 51-52:
```javascript
  })

  test('should call saveSession when starting processing and after completion', async () => {
```
with:
```javascript
  })

  test('should broadcast captcha-required with site: 1 for Phase 1', async () => {
    const broadcastMock = jest.fn()
    engine.setBroadcast(broadcastMock)

    // Run startProcessing
    const processPromise = engine.startProcessing('test-session-dir', 'auto')

    // Retrieve the onCaptcha callback passed to runGdtInvoicePortal
    // runGdtInvoicePortal is mocked to return pass/screenshot on invocation,
    // but we can extract its 3rd argument (onCaptcha function)
    const onCaptcha = runGdtInvoicePortal.mock.calls[0][2]
    
    // Simulate a CAPTCHA request being triggered
    onCaptcha('mock-image-data-1', 1)

    expect(broadcastMock).toHaveBeenCalledWith({
      type: 'captcha-required',
      payload: {
        id: 'inv1',
        image: 'mock-image-data-1',
        attempt: 1,
        site: 1
      }
    })
  })

  test('should call saveSession when starting processing and after completion', async () => {
```

- [ ] **Step 2: Run tests to verify it fails**
Run: `npm test backend/__tests__/automationEngine_sessions.test.js`
Expected output: Fail on `'should broadcast captcha-required with site: 1 for Phase 1'` because `site` is undefined.

- [ ] **Step 3: Update automationEngine.js to support the site parameter**
Modify [backend/automation/automationEngine.js](file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/backend/automation/automationEngine.js) to accept `site` in `waitForCaptchaAnswer` and pass it in the broadcast payload, and update the calls in Phase 1 and Phase 2.

Replace lines 45-48:
```javascript
async function waitForCaptchaAnswer(invoiceId, base64Image, attempt) {
  broadcast({ type: 'captcha-required', payload: { id: invoiceId, image: base64Image, attempt } })
  return new Promise((resolve) => { captchaResolve = resolve })
}
```
with:
```javascript
async function waitForCaptchaAnswer(invoiceId, base64Image, attempt, site) {
  broadcast({ type: 'captcha-required', payload: { id: invoiceId, image: base64Image, attempt, site } })
  return new Promise((resolve) => { captchaResolve = resolve })
}
```

Replace lines 114-115 (approx):
```javascript
            (img, att) => waitForCaptchaAnswer(invoice.id, img, att),
            (msg) => logStep(invoice.id, `[GDT Invoice Portal] ${msg}`)
```
with:
```javascript
            (img, att) => waitForCaptchaAnswer(invoice.id, img, att, 1),
            (msg) => logStep(invoice.id, `[GDT Invoice Portal] ${msg}`)
```

Replace lines 184-185 (approx):
```javascript
            (img, att) => waitForCaptchaAnswer(representativeInvoice.id, img, att),
            (msg) => logStep(representativeInvoice.id, `[GDT Taxpayer Portal] [TaxID: ${taxId}] ${msg}`)
```
with:
```javascript
            (img, att) => waitForCaptchaAnswer(representativeInvoice.id, img, att, 2),
            (msg) => logStep(representativeInvoice.id, `[GDT Taxpayer Portal] [TaxID: ${taxId}] ${msg}`)
```

- [ ] **Step 4: Run tests to verify they pass**
Run: `npm test backend/__tests__/automationEngine_sessions.test.js`
Expected output: PASS

- [ ] **Step 5: Commit**
Run command:
```bash
git add backend/automation/automationEngine.js backend/__tests__/automationEngine_sessions.test.js
git commit -m "backend: pass site parameter in captcha-required event payload"
```

---

### Task 2: Frontend - Pass site prop down to CaptchaModal

**Files:**
- Modify: [src/App.jsx](file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/App.jsx)

- [ ] **Step 1: Update CaptchaModal render in App.jsx to pass site prop**
Open [src/App.jsx](file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/App.jsx) and find the `CaptchaModal` component instantiation.

Replace lines 376-383:
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
with:
```jsx
            {captchaData && (
              <CaptchaModal
                imageBase64={captchaData.image}
                attempt={captchaData.attempt}
                site={captchaData.site}
                onSubmit={handleCaptchaSubmit}
                onSkip={handleSkipInvoice}
              />
            )}
```

- [ ] **Step 2: Commit**
Run command:
```bash
git add src/App.jsx
git commit -m "frontend: pass site parameter as prop to CaptchaModal"
```

---

### Task 3: Frontend - Capitalize input value in CaptchaModal for Site 1

**Files:**
- Modify: [src/components/CaptchaModal.jsx](file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/CaptchaModal.jsx)

- [ ] **Step 1: Accept site prop and convert input value to uppercase for Site 1**
Modify [src/components/CaptchaModal.jsx](file:///C:/Users/KhanhChuNgoc/Documents/Personal%20Projects/VATOCR/src/components/CaptchaModal.jsx) to destruct the `site` prop and update the input element's `onChange` event to transform input to uppercase in real-time when `site === 1`.

Replace line 3:
```javascript
export default function CaptchaModal({ imageBase64, attempt, onSubmit, onSkip }) {
```
with:
```javascript
export default function CaptchaModal({ imageBase64, attempt, site, onSubmit, onSkip }) {
```

Replace lines 62-63:
```javascript
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
```
with:
```javascript
              value={answer}
              onChange={(e) => {
                const val = e.target.value
                setAnswer(site === 1 ? val.toUpperCase() : val)
              }}
```

- [ ] **Step 2: Commit**
Run command:
```bash
git add src/components/CaptchaModal.jsx
git commit -m "frontend: transform input to uppercase in CaptchaModal for site 1"
```
