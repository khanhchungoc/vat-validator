# Design Specification: Localized Captcha Overlay & Site 2 Verification Flow

This specification defines the changes required to overlay the CAPTCHA modal only on the left column (preserving the right-hand live activity log's visibility) and validates the taxpayer search flow on Site 2.

## Goals
- Localize overlay modals (such as `CaptchaModal` and other overlays) to the primary left column `.layout-left` by making the left column relative and the overlay absolute.
- Keep the right-hand Live Console fully visible and active while the user inputs CAPTCHAs.
- Verify that on Site 2, the Tax ID (Mã số thuế) is successfully entered into the first field *before* entering the CAPTCHA interaction loop. No explicit tab click is needed as `/tcnnt/mstdn.jsp` is already the correct default tab.

## Detailed Changes

### 1. Localized Overlay Modals

#### `src/index.css`
- Add `position: relative;` to `.layout-left` so absolute overlays position themselves relative to the left column container.
- Modify `.modal-overlay` to use `position: absolute;` instead of `position: fixed;`. This makes the overlay dim and overlay only its parent container (`.layout-left`), leaving the sidebar (`.layout-right`) fully visible.
- Add `border-radius: var(--radius);` to `.modal-overlay` so the overlay fits the glassmorphic rounded corners of the main container perfectly.

#### `src/App.jsx`
- Move all overlay components (`ManualEntryForm`, `CaptchaModal`, `DuplicateWarning`) from the root level of the render tree inside `.layout-left` (right after `DownloadButtons`).

### 2. Site 2 Field Verification
- No code changes are required for `backend/automation/site2.js` for tab click since `mstdn.jsp` loads the correct tab. We verify that the Tax ID field `input[name="mst"]` is filled at the very top of `runSite2`, prior to entering the `while(true)` CAPTCHA loop.

---

## Verification Plan

### Manual Verification
1. Load invoices, click Start Processing.
2. Verify that when the CAPTCHA modal appears:
   - It dims and overlays *only* the left column of the dashboard.
   - The right-hand Live Console is completely bright, legible, and scrolling real-time steps dynamically.

### Automated Tests
Run `npm test` to verify zero regressions.
