# 7% Randomized Dynamic Timing Jitter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a randomized 7% dynamic timing jitter (±7%) across all automated browser delays to bypass GDT bot telemetry without hardcoded constraints or metronomic patterns.

**Architecture:** We will update the central `getRandomDelay(baseMs)` utility in both automation files to calculate a ±7% jitter range dynamically without arbitrary minimum bounds (eliminating `Math.max(30, ...)`). We will use Test-Driven Development (TDD) to write tests validating this timing range, verify their failure under the old implementation, update the logic, and verify success.

**Tech Stack:** JavaScript, Playwright, Jest unit testing framework.

---

### Task 1: Timing Jitter Unit Tests (TDD - Failing)

**Files:**
- Modify: `backend/__tests__/gdtTaxpayerPortal.test.js`
- Modify: `backend/automation/gdtTaxpayerPortal.js:233` (to export `getRandomDelay`)

- [ ] **Step 1: Export `getRandomDelay` from taxpayer portal**
Open `backend/automation/gdtTaxpayerPortal.js` and modify the bottom module exports:
```javascript
module.exports = { runGdtTaxpayerPortal, stripBranchSuffix, getRandomDelay }
```

- [ ] **Step 2: Add timing jitter tests**
Open `backend/__tests__/gdtTaxpayerPortal.test.js` and update the content to test both large and small delays:
```javascript
const { stripBranchSuffix, getRandomDelay } = require('../automation/gdtTaxpayerPortal')

test('strips branch suffix', () => {
  expect(stripBranchSuffix('0102721191-068')).toBe('0102721191')
})

test('leaves plain tax id unchanged', () => {
  expect(stripBranchSuffix('0102721191')).toBe('0102721191')
})

test('getRandomDelay timing output contains ±7% dynamic jitter', () => {
  const base = 1000
  const jitter = Math.round(base * 0.07) // 70
  const min = base - jitter // 930
  const max = base + jitter // 1070

  for (let i = 0; i < 200; i++) {
    const delay = getRandomDelay(base)
    expect(delay).toBeGreaterThanOrEqual(min)
    expect(delay).toBeLessThanOrEqual(max)
  }
})

test('getRandomDelay has narrow 7% jitter for small timing values like 50ms', () => {
  const base = 50
  const jitter = Math.round(base * 0.07) // 4
  const min = base - jitter // 46
  const max = base + jitter // 54

  for (let i = 0; i < 200; i++) {
    const delay = getRandomDelay(base)
    expect(delay).toBeGreaterThanOrEqual(min)
    expect(delay).toBeLessThanOrEqual(max)
  }
})
```

- [ ] **Step 3: Run the test suite and verify the failure**
Run: `npx jest backend/__tests__/gdtTaxpayerPortal.test.js --no-coverage`
Expected output: Fail on the `50ms` test with a value outside of `[46, 54]` (because the old logic uses a minimum jitter of 30ms, yielding values between 20ms and 80ms).

- [ ] **Step 4: Commit the failing tests**
```bash
git add backend/__tests__/gdtTaxpayerPortal.test.js backend/automation/gdtTaxpayerPortal.js
git commit -m "test: add unit tests for 7% dynamic timing jitter (TDD - failing)"
```

---

### Task 2: Implement 7% Timing Jitter in Taxpayer Portal

**Files:**
- Modify: `backend/automation/gdtTaxpayerPortal.js:4-11`

- [ ] **Step 1: Modify `getRandomDelay` in taxpayer portal**
Open `backend/automation/gdtTaxpayerPortal.js`. Locate `getRandomDelay` at the top:
```javascript
function getRandomDelay(baseMs) {
  const jitter = Math.max(30, Math.floor(baseMs * 0.1)); // 10% jitter, min 30ms
  const min = baseMs - jitter;
  const max = baseMs + jitter;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```
Replace it with the new ±7% dynamic timing jitter:
```javascript
function getRandomDelay(baseMs) {
  const jitter = Math.round(baseMs * 0.07); // 7% dynamic jitter
  const min = baseMs - jitter;
  const max = baseMs + jitter;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

- [ ] **Step 2: Run taxpayer portal tests to verify they now pass**
Run: `npx jest backend/__tests__/gdtTaxpayerPortal.test.js --no-coverage`
Expected output: All 4 tests in the suite PASS.

- [ ] **Step 3: Commit the changes**
```bash
git add backend/automation/gdtTaxpayerPortal.js
git commit -m "feat(automation): implement 7% randomized timing jitter in taxpayer portal"
```

---

### Task 3: Implement 7% Timing Jitter in Invoice Portal

**Files:**
- Modify: `backend/automation/gdtInvoicePortal.js:4-11`

- [ ] **Step 1: Modify `getRandomDelay` in invoice portal**
Open `backend/automation/gdtInvoicePortal.js`. Locate `getRandomDelay` at the top:
```javascript
function getRandomDelay(baseMs) {
  const jitter = Math.max(30, Math.floor(baseMs * 0.1)); // 10% jitter, min 30ms
  const min = baseMs - jitter;
  const max = baseMs + jitter;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```
Replace it with the new ±7% dynamic timing jitter:
```javascript
function getRandomDelay(baseMs) {
  const jitter = Math.round(baseMs * 0.07); // 7% dynamic jitter
  const min = baseMs - jitter;
  const max = baseMs + jitter;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

- [ ] **Step 2: Run full unit test suite to ensure zero regressions**
Run: `npm test`
Expected output: All 11 test suites and 49 unit tests PASS.

- [ ] **Step 3: Commit the changes**
```bash
git add backend/automation/gdtInvoicePortal.js
git commit -m "feat(automation): implement 7% randomized timing jitter in invoice portal"
```

---

### Task 4: Recompile and Package Verification

**Files:**
- None (Build verification)

- [ ] **Step 1: Run production frontend compile check**
Run: `npm run build`
Expected: Compilation completes without errors.

- [ ] **Step 2: Package the application into production executable**
Run: `npm run pack`
Expected: Compiles cleanly and outputs executable at `release\win-unpacked\VAT-validator.exe`.
