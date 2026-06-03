# Design Spec: Site 1 Load Verification

Ensure that the GDT Invoice Portal loads successfully (meaning key elements are present and the page is not blank) before proceeding with the automation steps. If a blank page or load failure is detected, the engine will automatically reload the page up to a configurable number of times (default 3) before failing.

## Problem Statement

When the GDT Invoice Portal (Site 1) is accessed:
- Sometimes a blank page is displayed or elements fail to load due to network drops, GDT portal instability, or slow server response.
- The automation engine continues execution regardless, trying to interact with fields that are not present.
- This causes immediate, unhandled locator errors or long timeouts, which eventually fail or skip the invoice without clear diagnostic info.

## Solution

We will introduce a load verification step inside the navigation block of `runGdtInvoicePortal`.

### 1. Verification Logic

We will define a robust check that:
- Runs immediately after navigating to `SITE1_URL`.
- Waits for the key element `input#nbmst` (Seller Tax ID) to become visible within a 10-second timeout.
- If it fails, attempts a clean page reload and checks again.
- Retries this sequence up to a maximum of 3 times.
- If all 3 attempts fail, throws a descriptive error to stop the phase immediately and mark it as failed or let the engine retry normally.

### 2. Affected Files

- `backend/automation/gdtInvoicePortal.js`: Implement the verification helper and check.

## Detailed Design

### Code Changes

#### `backend/automation/gdtInvoicePortal.js`

Add helper function:

```javascript
/**
 * Verifies that the page loaded successfully by checking for the visibility of a key selector.
 * If the check fails, the page is reloaded and the check is retried.
 * @param {import('playwright').Page} page
 * @param {string} url - The URL to reload if check fails
 * @param {string} selector - The key selector to check
 * @param {number} maxAttempts - The maximum load attempts
 * @param {function} onLog - Logging callback
 * @returns {Promise<boolean>} Resolves to true if page loaded successfully, false otherwise
 */
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
      return true;
    } catch (err) {
      onLog(`Site load check failed on attempt ${attempt}: ${err.message}`)
    }
  }
  return false;
}
```

In `runGdtInvoicePortal`:
```javascript
  const currentUrl = page.url()
  if (!currentUrl.includes('hoadondientu.gdt.gov.vn')) {
    onLog('Navigating to GDT Portal (https://hoadondientu.gdt.gov.vn/)...')
    await page.goto(SITE1_URL, { waitUntil: 'networkidle', timeout: 30000 })

    const loaded = await verifySiteLoaded(page, SITE1_URL, 'input#nbmst', 3, onLog)
    if (!loaded) {
      throw new Error('GDT Invoice Portal failed to load successfully after 3 attempts.')
    }

    // Close the annoying "CỤC THUẾ THÔNG BÁO" modal if it pops up and blocks the screen
    ...
```
