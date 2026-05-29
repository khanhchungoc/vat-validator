# VATOCR — Plan 5: Output Generation (PDF + XLSX)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate `results.pdf` (one A4 page per invoice with metadata + screenshots) and `summary.xlsx` (color-coded Excel summary) at batch completion and serve them for download.

**Architecture:** `pdfGenerator.js` builds an HTML string per invoice, renders it with Playwright's `page.pdf()`. `xlsxGenerator.js` builds the workbook using the `xlsx` package. Both write to the session folder. Express serves the files for download.

**Tech Stack:** Playwright `page.pdf()`, `xlsx` npm package, Express static file serving

**Prereq:** Plans 1–4 complete.

---

## File Structure

```
backend/
├── output/
│   ├── pdfGenerator.js      # Build HTML template + render to PDF via Playwright
│   └── xlsxGenerator.js     # Build Excel workbook from invoice list
└── routes/
    └── download.js          # GET /download/pdf/:sessionId, GET /download/xlsx/:sessionId
```

---

### Task 1: XLSX generator

**Files:**
- Create: `backend/output/xlsxGenerator.js`

- [ ] **Step 1: Install xlsx**

```bash
npm install xlsx
```

- [ ] **Step 2: Create `backend/output/xlsxGenerator.js`**

```js
const XLSX = require('xlsx')
const path = require('path')
const fs = require('fs')

const STATUS_LABELS = {
  pass: 'Pass',
  'invalid-invoice': 'Invalid Invoice',
  'invalid-business': 'Invalid Business',
  skipped: 'Skipped',
  pending: 'Pending'
}

// Row fill colors (ARGB format for xlsx)
const STATUS_FILLS = {
  pass: { fgColor: { argb: 'FF90EE90' } },           // light green
  'invalid-invoice': { fgColor: { argb: 'FFFF9999' } }, // light red
  'invalid-business': { fgColor: { argb: 'FFFF9999' } },
  skipped: { fgColor: { argb: 'FFFFE066' } },          // light yellow
  pending: { fgColor: { argb: 'FFFFFFFF' } }
}

/**
 * Generate summary.xlsx for a batch.
 * @param {string} sessionDir
 * @param {Invoice[]} invoices
 * @returns {string} path to generated file
 */
function generateXLSX(sessionDir, invoices) {
  const wb = XLSX.utils.book_new()

  // Build rows
  const header = ['#', 'Invoice Code', 'Invoice Number', 'Seller Name', 'Tax ID', 'Amount (VND)', 'Status']
  const rows = invoices.map((inv, i) => [
    i + 1,
    inv.invoiceCode,
    inv.invoiceNumber,
    inv.sellerName,
    inv.taxId,
    inv.totalAmount,
    STATUS_LABELS[inv.status] || inv.status
  ])

  const wsData = [header, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 14 }, { wch: 16 }, { wch: 45 },
    { wch: 18 }, { wch: 16 }, { wch: 20 }
  ]

  // Bold header row
  for (let c = 0; c < header.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c })
    if (!ws[cellRef]) continue
    ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { argb: 'FF4472C4' } }, font: { bold: true, color: { argb: 'FFFFFFFF' } } }
  }

  // Color-code data rows by status
  invoices.forEach((inv, rowIdx) => {
    const fill = STATUS_FILLS[inv.status] || STATUS_FILLS.pending
    for (let c = 0; c < header.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c })
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' }
      ws[cellRef].s = { fill: { patternType: 'solid', ...fill } }
    }
  })

  XLSX.utils.book_append_sheet(wb, ws, 'Summary')

  const outputPath = path.join(sessionDir, 'summary.xlsx')
  XLSX.writeFile(wb, outputPath, { bookType: 'xlsx', cellStyles: true })
  return outputPath
}

module.exports = { generateXLSX }
```

- [ ] **Step 3: Write unit test**

Create `backend/__tests__/xlsxGenerator.test.js`:

```js
const { generateXLSX } = require('../output/xlsxGenerator')
const fs = require('fs')
const path = require('path')
const os = require('os')

test('generates xlsx file with correct data', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vatocr-test-'))
  const invoices = [
    { invoiceCode: 'C26MGG', invoiceNumber: '1159855', sellerName: 'Test Co',
      taxId: '0102721191', totalAmount: 1355980, status: 'pass' },
    { invoiceCode: 'C26MGG', invoiceNumber: '1159856', sellerName: 'Bad Co',
      taxId: '0999999999', totalAmount: 500000, status: 'invalid-invoice' }
  ]

  const outputPath = generateXLSX(tmpDir, invoices)
  expect(fs.existsSync(outputPath)).toBe(true)

  const XLSX = require('xlsx')
  const wb = XLSX.readFile(outputPath)
  const ws = wb.Sheets['Summary']
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 })
  expect(data[0]).toContain('Invoice Code')
  expect(data[1][6]).toBe('Pass')
  expect(data[2][6]).toBe('Invalid Invoice')

  fs.rmSync(tmpDir, { recursive: true })
})
```

```bash
npx jest backend/__tests__/xlsxGenerator.test.js --verbose
```

Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add backend/output/xlsxGenerator.js backend/__tests__/xlsxGenerator.test.js package.json package-lock.json
git commit -m "feat: XLSX summary generator with color-coded status rows"
```

---

### Task 2: PDF generator

**Files:**
- Create: `backend/output/pdfGenerator.js`

- [ ] **Step 1: Create `backend/output/pdfGenerator.js`**

```js
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

function formatAmount(amount) {
  return Number(amount).toLocaleString('vi-VN') + ' ₫'
}

function buildInvoicePageHTML(invoice, screenshotsDir) {
  const site1Path = invoice.site1Screenshot
    ? path.join(screenshotsDir, invoice.site1Screenshot)
    : null
  const site2Path = invoice.site2Screenshot
    ? path.join(screenshotsDir, invoice.site2Screenshot)
    : null

  const toBase64 = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath).toString('base64')
  }

  const site1B64 = toBase64(site1Path)
  const site2B64 = toBase64(site2Path)

  const imgTag = (b64, label) => b64
    ? `<div class="screenshot-col">
        <div class="screenshot-label">${label}</div>
        <img src="data:image/png;base64,${b64}" class="screenshot" />
       </div>`
    : `<div class="screenshot-col"><div class="screenshot-label">${label}</div><p class="no-screenshot">Not captured</p></div>`

  return `
    <div class="invoice-page">
      <div class="invoice-header">
        <h2>Invoice: ${invoice.invoiceCode} / ${invoice.invoiceNumber}</h2>
        <span class="status-badge status-${invoice.status}">${invoice.status.replace('-', ' ').toUpperCase()}</span>
      </div>
      <table class="invoice-meta">
        <tr><td>Seller</td><td>${invoice.sellerName}</td></tr>
        <tr><td>Tax ID</td><td>${invoice.taxId}</td></tr>
        <tr><td>Address</td><td>${invoice.sellerAddress || '—'}</td></tr>
        <tr><td>Total Amount</td><td>${formatAmount(invoice.totalAmount)}</td></tr>
      </table>
      <div class="screenshots">
        ${imgTag(site1B64, 'Website 1 — hoadondientu.gdt.gov.vn')}
        ${imgTag(site2B64, 'Website 2 — tracuunnt.gdt.gov.vn')}
      </div>
    </div>
  `
}

const PAGE_CSS = `
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; }
  .invoice-page { page-break-after: always; }
  .invoice-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4472C4; margin-bottom: 8px; padding-bottom: 6px; }
  .invoice-header h2 { margin: 0; font-size: 14px; color: #4472C4; }
  .status-badge { padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; }
  .status-pass { background: #90EE90; color: #155724; }
  .status-invalid-invoice, .status-invalid-business { background: #FF9999; color: #721c24; }
  .status-skipped { background: #FFE066; color: #856404; }
  .invoice-meta { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .invoice-meta td { padding: 3px 6px; border: 1px solid #ddd; }
  .invoice-meta td:first-child { font-weight: bold; width: 100px; background: #f5f5f5; }
  .screenshots { display: flex; gap: 10px; }
  .screenshot-col { flex: 1; }
  .screenshot-label { font-weight: bold; font-size: 10px; color: #555; margin-bottom: 4px; }
  .screenshot { width: 100%; border: 1px solid #ccc; border-radius: 4px; }
  .no-screenshot { color: #999; font-style: italic; }
`

/**
 * Generate results.pdf for a batch.
 * @param {string} sessionDir
 * @param {Invoice[]} invoices - must have site1Screenshot and site2Screenshot filenames
 * @returns {Promise<string>} path to generated PDF
 */
async function generatePDF(sessionDir, invoices) {
  const screenshotsDir = path.join(sessionDir, 'screenshots')

  const pagesHTML = invoices
    .map(inv => buildInvoicePageHTML(inv, screenshotsDir))
    .join('\n')

  const fullHTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${PAGE_CSS}</style></head>
<body>${pagesHTML}</body></html>`

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent(fullHTML, { waitUntil: 'networkidle' })

  const outputPath = path.join(sessionDir, 'results.pdf')
  await page.pdf({ path: outputPath, format: 'A4', landscape: true, printBackground: true })
  await browser.close()

  return outputPath
}

module.exports = { generatePDF }
```

- [ ] **Step 2: Commit**

```bash
git add backend/output/pdfGenerator.js
git commit -m "feat: PDF generator renders invoice pages with screenshots via Playwright"
```

---

### Task 3: Wire output generation into automation engine

**Files:**
- Modify: `backend/automation/automationEngine.js`
- Modify: `backend/wsHandler.js`

- [ ] **Step 1: Trigger generation on batch complete in `automationEngine.js`**

Add imports at top:

```js
const { generatePDF } = require('../output/pdfGenerator')
const { generateXLSX } = require('../output/xlsxGenerator')
```

After the `for` loop (after `browser.close()`), before `broadcast({ type: 'batch-complete' })`:

```js
try {
  const allInvoices = getInvoices()
  const [pdfPath, xlsxPath] = await Promise.all([
    generatePDF(currentSessionDir, allInvoices),
    Promise.resolve(generateXLSX(currentSessionDir, allInvoices))
  ])
  const sessionId = require('path').basename(currentSessionDir)
  broadcast({
    type: 'batch-complete',
    payload: {
      pdfUrl: `http://localhost:3001/download/pdf/${sessionId}`,
      xlsxUrl: `http://localhost:3001/download/xlsx/${sessionId}`
    }
  })
} catch (e) {
  console.error('[Engine] Output generation failed:', e.message)
  broadcast({ type: 'batch-complete', payload: {} })
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/automation/automationEngine.js
git commit -m "feat: generate PDF and XLSX at batch completion"
```

---

### Task 4: Download endpoints

**Files:**
- Create: `backend/routes/download.js`
- Modify: `backend/index.js`

- [ ] **Step 1: Create `backend/routes/download.js`**

```js
const express = require('express')
const path = require('path')
const fs = require('fs')
const { OUTPUT_DIR } = require('../sessionManager')

const router = express.Router()

router.get('/pdf/:sessionId', (req, res) => {
  const filePath = path.join(OUTPUT_DIR, req.params.sessionId, 'results.pdf')
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'PDF not found' })
  res.download(filePath, `vatocr-results-${req.params.sessionId}.pdf`)
})

router.get('/xlsx/:sessionId', (req, res) => {
  const filePath = path.join(OUTPUT_DIR, req.params.sessionId, 'summary.xlsx')
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'XLSX not found' })
  res.download(filePath, `vatocr-summary-${req.params.sessionId}.xlsx`)
})

module.exports = router
```

- [ ] **Step 2: Register in `backend/index.js`**

```js
const downloadRoute = require('./routes/download')
app.use('/download', downloadRoute)
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/download.js backend/index.js
git commit -m "feat: download endpoints for PDF and XLSX"
```

---

### Task 5: Frontend — download buttons

**Files:**
- Create: `src/components/DownloadButtons.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `src/components/DownloadButtons.jsx`**

```jsx
export default function DownloadButtons({ pdfUrl, xlsxUrl }) {
  if (!pdfUrl && !xlsxUrl) return null

  return (
    <div className="download-section">
      <h3>✅ Batch Complete — Download Results</h3>
      <div className="download-buttons">
        {pdfUrl && (
          <a href={pdfUrl} download className="btn-download btn-pdf">
            📄 Download PDF
          </a>
        )}
        {xlsxUrl && (
          <a href={xlsxUrl} download className="btn-download btn-xlsx">
            📊 Download Excel Summary
          </a>
        )}
      </div>
    </div>
  )
}
```

Add to `src/index.css`:

```css
.download-section {
  margin-top: 32px; padding: 24px;
  background: var(--glass); border: 1px solid var(--pass);
  border-radius: var(--radius); text-align: center;
}
.download-section h3 { margin-bottom: 16px; color: var(--pass); }
.download-buttons { display: flex; gap: 16px; justify-content: center; }
.btn-download {
  display: inline-block; padding: 12px 28px; border-radius: 8px;
  font-family: inherit; font-size: 0.95rem; font-weight: 600;
  text-decoration: none; cursor: pointer; transition: opacity 0.2s;
}
.btn-download:hover { opacity: 0.85; }
.btn-pdf { background: #dc3545; color: white; }
.btn-xlsx { background: #198754; color: white; }
```

- [ ] **Step 2: Wire into `src/App.jsx`**

```jsx
import DownloadButtons from './components/DownloadButtons'

// Add state:
const [downloadUrls, setDownloadUrls] = useState({ pdfUrl: null, xlsxUrl: null })

// In useWebSocket handler for batch-complete:
if (msg.type === 'batch-complete') {
  setStepWaiting(false)
  if (msg.payload?.pdfUrl) {
    setDownloadUrls({ pdfUrl: msg.payload.pdfUrl, xlsxUrl: msg.payload.xlsxUrl })
  }
}

// Add to JSX after InvoiceQueue:
<DownloadButtons pdfUrl={downloadUrls.pdfUrl} xlsxUrl={downloadUrls.xlsxUrl} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DownloadButtons.jsx src/App.jsx src/index.css
git commit -m "feat: download buttons appear after batch completes"
```
