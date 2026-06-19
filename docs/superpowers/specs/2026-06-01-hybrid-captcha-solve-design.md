# Design Specification: Hybrid CAPTCHA Solver with Human-Like Typing

We are introducing the "Hybrid CAPTCHA Solver," allowing users to solve GDT CAPTCHAs directly inside the Electron React app UI without window switching, while preserving direct GDT browser solving. We address the previous "Incorrect CAPTCHA" errors by simulating human-like, character-by-character typing with delay triggers to satisfy GDT's React event listeners.

## Goals
- Restore the CAPTCHA text input field and submit button in the Electron UI (`CaptchaModal.jsx`).
- Implement automatic keyboard focus on the text input in the Electron UI for instant, hands-on typing.
- Setup a seamless, non-blocking asynchronous race inside both GDT portal scripts (`gdtInvoicePortal.js` and `gdtTaxpayerPortal.js`) supporting **both** Electron UI entry and direct in-browser entry.
- Implement human-like typing (`page.keyboard.type(answer, { delay: 80 })`) when submitting the CAPTCHA from the Electron UI, satisfying all GDT React/Ant-Design event bindings.
- Enable smooth background execution by allowing the GDT browser to run minimized natively in the OS.

---

## Architecture & Data Flow

```mermaid
sequenceDiagram
    participant User as User (Electron UI)
    participant Engine as Automation Engine
    participant PW as Playwright Browser
    participant GDT as GDT Web Server

    PW->>Engine: Captures CAPTCHA Image
    Engine->>User: Broadcasts "captcha-required" with image
    Note over User: CaptchaModal opens, focuses Input Box

    alt Path A: User enters CAPTCHA in Electron UI
        User->>Engine: Submits text "aBcDe"
        Engine->>PW: Focuses GDT input & types "aBcDe" (80ms character delay)
        Engine->>PW: Submits form (Presses Enter)
        PW->>GDT: Sends API / Form Request
    else Path B: User solves directly in GDT browser
        User->>PW: Clicks GDT browser, types "aBcDe" & submits
        PW->>GDT: Sends API / Form Request
    }

    GDT-->>PW: Returns Response (API/DOM)
    PW-->>Engine: Intercepts result (HTTP 200/401/DOM status)
    Engine->>User: Broadcasts "captcha-success" & proceeds
```

---

## Detailed Changes

### 1. Electron Frontend Modals

#### `src/components/CaptchaModal.jsx`
- Restore the text input field `<input type="text" />`.
- Add `autoFocus` to the input field so users can type immediately without clicking.
- Implement form submission handling (`onSubmit`) that calls the `onSubmit(answer)` prop and resets local state.
- Keep the `onSkip` button active.

#### `src/App.jsx`
- Pass the existing `handleCaptchaSubmit` function as the `onSubmit` prop to `<CaptchaModal>`:
  ```jsx
  <CaptchaModal
    imageBase64={captchaData.image}
    attempt={captchaData.attempt}
    onSubmit={handleCaptchaSubmit}
    onSkip={handleSkipInvoice}
  />
  ```

---

### 2. GDT Automation Loops (Backend)

We implement a smart Promise-race that handles both user interaction paths seamlessly.

#### `backend/automation/gdtInvoicePortal.js`
Modify the wait-for-solve block in `runGdtInvoicePortal`:
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

    // Race GDT's API response directly
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/sco-query/guest-invoices'),
      { timeout: 600000 }
    ).catch(() => null)

    const response = await Promise.race([
      responsePromise,
      (async () => {
        await answerSubmittedPromise
        if (userSkipped) return null
        if (electronAnswer) {
          // Clear and focus GDT's input field
          await page.fill('input#cvalue', '')
          await page.focus('input#cvalue')
          // Simulate human typing to trigger React event listeners
          await page.keyboard.type(electronAnswer, { delay: 80 })
          // Press Enter to submit GDT's form
          await page.keyboard.press('Enter')
          // Return the intercepted response
          return await responsePromise
        }
        return null
      })()
    ])
```

#### `backend/automation/gdtTaxpayerPortal.js`
Modify the wait-for-solve block in `runGdtTaxpayerPortal` similarly:
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

    // Race GDT's DOM result selectors
    const resultPromise = page.locator('text=Vui lòng nhập đúng mã xác nhận')
      .or(page.locator('text=BẢNG THÔNG TIN TRA CỨU'))
      .or(page.locator('text=Không tìm thấy người nộp thuế'))
      .waitFor({ state: 'visible', timeout: 600000 })
      .catch(() => null)

    await Promise.race([
      resultPromise,
      (async () => {
        await answerSubmittedPromise
        if (userSkipped) return
        if (electronAnswer) {
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
```

---

## Verification Plan

### Manual Verification
1. Click **Start Processing**.
2. When the CAPTCHA modal appears in Electron:
   - Verify the input box is automatically focused.
   - Type the CAPTCHA and press `Enter`.
   - Verify that Playwright inputs it on the GDT site and successfully submits.
3. Test direct solving:
   - Click GDT's browser instead, type the CAPTCHA, and hit search.
   - Verify the app detects the success/failure and moves on automatically without any errors.

### Automated Tests
Run `npm test` to verify no regressions in our automation store and session logic.
