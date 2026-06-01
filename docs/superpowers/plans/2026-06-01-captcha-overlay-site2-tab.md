# Localized Overlay & Site 2 Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confine the CAPTCHA and manual form overlays to the primary left column (keeping the Live Console sidebar fully visible) and verify that the Tax ID (Mã số thuế) is filled *before* entering the CAPTCHA loop on Site 2.

**Architecture:** We set `.layout-left` to relative and `.modal-overlay` to absolute. We relocate overlay components inside `.layout-left` in the React render tree. No changes are made to Site 2's script as it already fills the Tax ID prior to the CAPTCHA loop.

**Tech Stack:** JavaScript, React, CSS, Playwright

---

### Task 1: Localized Captcha Overlay (App.jsx & index.css)

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.jsx`

- [ ] **Step 1: Modify `src/index.css`**
Update `.layout-left` to use `position: relative` and `.modal-overlay` to use `position: absolute`:

Modify `.layout-left` around line 292:
```css
.layout-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 8px;
  transition: all 0.3s ease;
  position: relative; /* Position context for localized overlays */
}
```

Modify `.modal-overlay` around line 95:
```css
.modal-overlay {
  position: absolute; inset: 0; /* Confine to parent layout-left */
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 100;
  border-radius: var(--radius); /* Clean rounded border matching parent */
}
```

- [ ] **Step 2: Modify `src/App.jsx`**
Relocate the overlay components (`ManualEntryForm`, `CaptchaModal`, `DuplicateWarning`) from the root level of the render tree inside the `.layout-left` container:

Move lines 356-378 from the very bottom of the render tree into the bottom of `<div className="layout-left">` (around line 344, right after `DownloadButtons`):

```jsx
            <StepButton visible={isProcessing && isStepWaiting} onStep={handleAdvanceStep} />
            <ProgressBar invoices={invoices} />

            <ErrorBanner error={processingError} onRetry={handleRetry} onSkip={handleErrorSkip} />
            <InvoiceQueue invoices={invoices} />
            <DownloadButtons pdfUrl={downloadUrls.pdfUrl} xlsxUrl={downloadUrls.xlsxUrl} />

            {showManualForm && (
              <ManualEntryForm
                onSubmit={handleManualSubmit}
                onClose={() => setShowManualForm(false)}
              />
            )}
            {captchaData && (
              <CaptchaModal
                imageBase64={captchaData.image}
                attempt={captchaData.attempt}
                onSubmit={handleCaptchaSubmit}
                onSkip={handleSkipInvoice}
              />
            )}
            {showDuplicateWarning && (
              <DuplicateWarning
                duplicates={duplicates}
                onRemove={handleRemoveDuplicates}
                onProceed={handleProceedWithDuplicates}
              />
            )}
          </div>
```

Ensure they are removed from the bottom of the tree so that they are not rendered twice.

- [ ] **Step 3: Verify frontend compiles successfully**
Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add src/index.css src/App.jsx
git commit -m "feat(ui): localize overlays to left column, keeping live log console fully visible"
```

---

### Task 2: Production Rebuild & Pack

- [ ] **Step 1: Run Jest tests**
Run: `npm test`
Expected: 46/46 passing.

- [ ] **Step 2: Re-pack the application**
Run the packaging command:
`Stop-Process -Name "VAT-validator", "VATOCR", "electron" -Force -ErrorAction SilentlyContinue; npm run pack`
Expected: Successful compilation, producing the updated unpacked executable.
