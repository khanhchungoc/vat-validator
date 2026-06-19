# Randomized Timing Jitter Design Specification

## Overview
To improve bot detection avoidance and prevent metronomic timing signatures, all hardcoded delays and timeouts within the GDT tax authority automation portals will be randomized dynamically. Rather than using fixed wait values or standard hard limits, all delay timing will utilize a centralized dynamic jitter function.

## Requirement
- **Timing Jitter Range:** A 7% randomized timing jitter (±7%) will be applied to all base timing delays.
- **Universal Application:** All calls to `page.waitForTimeout` and related timing mechanisms in `gdtInvoicePortal.js` and `gdtTaxpayerPortal.js` will inherit this behavior.
- **Dynamic Calculation:** For a given base delay of `baseMs`, the timing delay will resolve to a random integer within `[baseMs - jitter, baseMs + jitter]`, where `jitter = Math.round(baseMs * 0.07)`.
  - For `50ms`, `jitter = 4ms`, producing a randomized range of `46ms` to `54ms`.
  - For `500ms`, `jitter = 35ms`, producing a randomized range of `465ms` to `535ms`.

## Implementation Details

### Central `getRandomDelay` Utility Function
We will update `getRandomDelay` in both `backend/automation/gdtInvoicePortal.js` and `backend/automation/gdtTaxpayerPortal.js`:

```javascript
/**
 * Generate a randomized delay with ±7% dynamic jitter to bypass bot heuristics.
 * @param {number} baseMs - The base delay in milliseconds.
 * @returns {number} The randomized delay.
 */
function getRandomDelay(baseMs) {
  const jitter = Math.round(baseMs * 0.07);
  const min = baseMs - jitter;
  const max = baseMs + jitter;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

This replaces the old logic:
```javascript
// OLD LOGIC
function getRandomDelay(baseMs) {
  const jitter = Math.max(30, Math.floor(baseMs * 0.1)); // 10% jitter, min 30ms
  const min = baseMs - jitter;
  const max = baseMs + jitter;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```
The new implementation avoids arbitrary hard floor bounds (`Math.max(30, ...)`) and provides a natural 7% scale for all timing sizes.
