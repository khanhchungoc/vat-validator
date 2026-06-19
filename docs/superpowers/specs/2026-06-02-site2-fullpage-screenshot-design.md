# Site 2 Successful Match Full-Page Screenshot Design Specification

## Overview
When GDT Taxpayer Portal (Site 2) returns multiple businesses for a query, capturing only the active viewport can cause rows near the bottom of the table to be cut off. To ensure all matched businesses are visible in the captured result, the screenshot logic for successful matches on Site 2 will be updated to capture the full page.

## Requirements
- **Target State:** The full-page screenshot will only be applied to successful taxpayer lookups where the search results table (`BẢNG THÔNG TIN TRA CỨU`) is detected.
- **Other States:** Lookups resulting in "Taxpayer not found" or triggering fallback screenshots will continue to capture only the active viewport (`{ fullPage: false }`) to avoid generating bloated files.
- **Approach:** Call Playwright's `page.screenshot({ fullPage: true })` immediately upon finding the success table.

## Implementation Details

### GDT Taxpayer Portal (`backend/automation/gdtTaxpayerPortal.js`)
We will modify the success branch inside `runGdtTaxpayerPortal`:

```javascript
    const hasSuccessTable = await page.$('text=BẢNG THÔNG TIN TRA CỨU')
    if (hasSuccessTable && await hasSuccessTable.isVisible()) {
      onLog('Verification successful! Capturing business status screenshot...')
      // Capture the full scrollable page to include all businesses if multiple are returned
      const screenshotBuffer = await page.screenshot({ fullPage: true })
      const screenshotBase64 = screenshotBuffer.toString('base64')
      return { ok: true, screenshotBase64, status: 'pass' }
    }
```
This replaces the old:
```javascript
      const screenshotBuffer = await page.screenshot({ fullPage: false })
```
