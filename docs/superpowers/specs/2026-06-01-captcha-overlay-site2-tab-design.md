# Design Specification: Localized Captcha Overlay & Site 2 Tab Selection

This specification defines the changes required to overlay the CAPTCHA modal only on the left column (preserving the right-hand live activity log's visibility) and ensuring Site 2 selects the correct taxpayer info tab and inputs the Seller Tax ID accurately.

## Goals
- Localize overlay modals (such as `CaptchaModal` and other overlays) to the primary left column `.layout-left` by making the left column relative and the overlay absolute.
- Keep the right-hand Live Console fully visible and active while the user inputs CAPTCHAs.
- Explicitly click and select the "Thông tin về người nộp thuế" (Taxpayer Information) tab on Site 2 before filling the Seller Tax ID.

## Detailed Changes

### 1. Localized Overlay Modals

#### `src/index.css`
- Add `position: relative;` to `.layout-left` so absolute overlays position themselves relative to the left column container.
- Modify `.modal-overlay` to use `position: absolute;` instead of `position: fixed;`. This makes the overlay dim and overlay only its parent container (`.layout-left`), leaving the sidebar (`.layout-right`) fully visible.
- Add `border-radius: var(--radius);` to `.modal-overlay` so the overlay fits the glassmorphic rounded corners of the main container perfectly.

#### `src/App.jsx`
- Move all overlay components (`ManualEntryForm`, `CaptchaModal`, `DuplicateWarning`) from the root level of the render tree inside `.layout-left`.

---

### 2. Site 2 Tab Selection & Logging

#### `backend/automation/site2.js`
- Select the tab `"Thông tin về người nộp thuế"` explicitly before proceeding:
  ```javascript
  // Explicitly choose the "Thông tin về người nộp thuế" tab
  try {
    const tab = await page.$('a:has-text("Thông tin về người nộp thuế")')
    if (tab) {
      onLog('Selecting tab "Thông tin về người nộp thuế"...')
      await tab.click()
      await page.waitForTimeout(500)
    }
  } catch (err) {
    // Ignore if tab click fails
  }
  ```
- Print a clear log statement indicating that the Seller Tax ID (stripped of branch suffix) is being filled into the first visible field.

---

## Verification Plan

### Manual Verification
1. Load invoices, click Start Processing.
2. Verify that when the CAPTCHA modal appears:
   - It dims and overlays *only* the left column of the dashboard.
   - The right-hand Live Console is completely bright, legible, and scrolling real-time steps dynamically.
3. During Site 2 lookup, check the Live Console log steps. Verify:
   - It outputs: `[Site 2] Selecting tab "Thông tin về người nộp thuế"...`
   - It outputs: `[Site 2] Entering Seller Tax ID (XXXXXXXXXX) into the first field...`
   - Playwright correctly navigates the GDT page and selects the tab before typing the tax ID.

### Automated Tests
Run `npm test` to verify zero regressions.
