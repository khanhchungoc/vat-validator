# Two-Phase Batched Automation Engine

**Date:** 2026-06-01  
**Status:** Approved  
**Scope:** `backend/automation/automationEngine.js` only  

---

## Problem

The current engine interleaves Site 1 and Site 2 per invoice:

```
Invoice 1 → Site 1 → Site 2
Invoice 2 → Site 1 → Site 2
Invoice 3 → Site 1 → Site 2
```

This causes two inefficiencies:
1. **Repeated domain switching** — the browser navigates between two different GDT portals on every invoice, paying the `goto` + `networkidle` cost twice per invoice.
2. **Redundant Site 2 lookups** — Site 2 only cares about the seller Tax ID. If 5 invoices share the same Tax ID, Site 2 is called 5 times with identical input, returning identical results.

---

## Solution: Two-Phase Sequential Engine

Restructure the engine into two sequential phases:

```
Phase 1: Invoice 1 → Site 1
         Invoice 2 → Site 1
         Invoice 3 → Site 1

Phase 2: Tax ID A   → Site 2  (covers Invoice 1 + Invoice 2)
         Tax ID B   → Site 2  (covers Invoice 3)
```

### Phase 1 — GDT Invoice Portal (Site 1)

- Iterate over all `pending` invoices.
- For each invoice, call `runGdtInvoicePortal`.
- Store the result in a `phase1Results` map: `{ [invoiceId]: { status, screenshotBase64 } }`.
- Save `site1Screenshot` to disk immediately after each invoice completes.
- Broadcast `invoice-status` with a new intermediate status `site1-done` (or retain `processing`) so the UI can show progress.
- Do **not** finalize the invoice status yet — wait until Phase 2 applies.
- If an invoice is `skipped` or `invalid-invoice`, mark it as final immediately (no Phase 2 needed).

### Phase 2 — GDT Taxpayer Portal (Site 2)

- Collect the set of **unique Tax IDs** from invoices whose Phase 1 result was `pass`.
- For each unique Tax ID:
  - Call `runGdtTaxpayerPortal` once.
  - Cache the result in a `site2Cache` map: `{ [taxId]: { status, screenshotBase64 } }`.
- After all unique Tax IDs are looked up, apply results to each invoice:
  - Find all invoices with that Tax ID whose Phase 1 was `pass`.
  - For each such invoice, **copy** the screenshot buffer to disk as `<invoiceId>_site2.png` (same naming convention as today).
  - Set `site2Screenshot` filename on the invoice.
  - Compute final status (see table below).
- If a Tax ID lookup is `skipped`, all invoices with that Tax ID are also `skipped`.

### Final Status Logic

| Phase 1 Result    | Phase 2 Result     | Final Invoice Status |
|-------------------|--------------------|----------------------|
| `pass`            | `pass`             | `pass`               |
| `pass`            | `invalid-business` | `invalid-business`   |
| `pass`            | `skipped`          | `skipped`            |
| `invalid-invoice` | (not run)          | `invalid-invoice`    |
| `skipped`         | (not run)          | `skipped`            |

---

## Screenshot Handling

- Site 1 screenshot: saved immediately after Phase 1, `<invoiceId>_site1.png` — unchanged.
- Site 2 screenshot: one screenshot taken per unique Tax ID. **Copied** (not symlinked) to each invoice that shares that Tax ID as `<invoiceId>_site2.png`.
- The `pdfGenerator.js` and `xlsxGenerator.js` are **not changed** — they already expect `site2Screenshot` as a filename per invoice.
- The PDF output continues to show two screenshots side by side per invoice, exactly as before.

---

## Data Structures

```javascript
// Populated during Phase 1
const phase1Results = {}
// { [invoiceId]: { status: 'pass'|'invalid-invoice'|'skipped', screenshotBase64: string } }

// Populated during Phase 2
const site2Cache = {}
// { [taxId]: { status: 'pass'|'invalid-business'|'skipped', screenshotBase64: string } }
```

---

## Files Changed

| File | Change |
|---|---|
| `backend/automation/automationEngine.js` | Full restructure of `startProcessing` into two phases |
| `backend/automation/gdtInvoicePortal.js` | **No change** |
| `backend/automation/gdtTaxpayerPortal.js` | **No change** |
| `backend/output/pdfGenerator.js` | **No change** |
| `backend/output/xlsxGenerator.js` | **No change** |
| `src/App.jsx` | **No change** |

---

## UI / Activity Console

- During Phase 1: logs appear as today — `[GDT Invoice Portal] ...` messages per invoice.
- Between phases: broadcast a log message `"Phase 1 complete. Starting Tax ID lookups..."`.
- During Phase 2: logs appear as `[GDT Taxpayer Portal] [TaxID: <id>] ...` — grouped by Tax ID, not by invoice.
- Invoice status cards update in two waves:
  - After Phase 1: cards for `invalid-invoice` and `skipped` invoices flip to final status immediately.
  - After Phase 2: remaining cards flip to their final status.

---

## Error Handling

- If a Phase 1 invoice throws an unrecoverable error, it is marked `skipped` as today. It is excluded from Phase 2.
- If a Phase 2 Tax ID lookup throws an unrecoverable error, all invoices with that Tax ID are marked `skipped`.
- The retry logic (up to 3 process attempts) wraps Phase 1 per invoice, unchanged.
- Phase 2 Tax ID lookups also get up to 3 retry attempts on unrecoverable error.

---

## Out of Scope

- Parallel tabs / concurrent browser pages.
- Changes to the CAPTCHA UI or modal behavior.
- Changes to session management or file output format.
