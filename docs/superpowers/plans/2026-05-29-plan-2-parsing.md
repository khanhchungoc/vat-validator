# VATOCR — Plan 2: XML Parsing & Manual Entry

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse Vietnamese e-invoice XML files and accept manual invoice entry, producing a unified invoice queue that feeds into the processing pipeline.

**Architecture:** Backend exposes a REST endpoint for XML upload (multipart) and a WebSocket message for manual entry. Both paths produce the same `Invoice` object shape. Frontend shows a drag-and-drop zone, a manual entry form, and a queue list.

**Tech Stack:** `fast-xml-parser`, `multer` (multipart file upload), React

**Prereq:** Plan 1 complete (scaffold running).

---

## File Structure

```
backend/
├── invoiceParser.js       # XML → Invoice object
├── invoiceStore.js        # In-memory queue for current session
└── routes/
    └── upload.js          # POST /upload — multipart XML upload handler
src/
├── components/
│   ├── DropZone.jsx       # Drag-and-drop XML upload area
│   ├── ManualEntryForm.jsx # "Add Invoice Manually" form
│   └── InvoiceQueue.jsx   # List of queued invoices with status badges
└── App.jsx                # Updated to include queue UI
```

---

### Task 1: Install parsing dependencies

- [ ] **Step 1: Install packages**

```bash
npm install fast-xml-parser multer
```

- [ ] **Step 2: Verify**

```bash
node -e "require('fast-xml-parser'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add fast-xml-parser and multer"
```

---

### Task 2: Invoice parser module

**Files:**
- Create: `backend/invoiceParser.js`

- [ ] **Step 1: Create `backend/invoiceParser.js`**

```js
const { XMLParser } = require('fast-xml-parser')

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

/**
 * Parse a Vietnamese e-invoice XML buffer into an Invoice object.
 * @param {Buffer|string} xmlContent
 * @param {string} filename
 * @returns {{ ok: true, invoice: Invoice } | { ok: false, error: string }}
 */
function parseInvoiceXML(xmlContent, filename) {
  try {
    const result = parser.parse(xmlContent)
    const dl = result?.HDon?.DLHDon

    if (!dl) return { ok: false, error: `${filename}: Missing DLHDon root element` }

    const invoiceCode = dl.KHHDon
    const invoiceNumber = String(dl.SHDon)
    const seller = dl.NDHDon?.NBan
    const payment = dl.NDHDon?.TToan

    const missing = []
    if (!invoiceCode) missing.push('KHHDon')
    if (!invoiceNumber) missing.push('SHDon')
    if (!seller?.Ten) missing.push('NBan.Ten')
    if (!seller?.MST) missing.push('NBan.MST')
    if (!seller?.DChi) missing.push('NBan.DChi')
    if (!payment?.TgTTTBSo) missing.push('TToan.TgTTTBSo')

    if (missing.length > 0) {
      return { ok: false, error: `${filename}: Missing fields: ${missing.join(', ')}` }
    }

    return {
      ok: true,
      invoice: {
        id: `${invoiceCode}-${invoiceNumber}`,
        source: 'xml',
        filename,
        invoiceCode,
        invoiceNumber,
        sellerName: seller.Ten,
        taxId: seller.MST,
        sellerAddress: seller.DChi,
        totalAmount: Number(payment.TgTTTBSo),
        status: 'pending'
      }
    }
  } catch (e) {
    return { ok: false, error: `${filename}: Parse error — ${e.message}` }
  }
}

module.exports = { parseInvoiceXML }
```

- [ ] **Step 2: Write unit test**

Create `backend/__tests__/invoiceParser.test.js`:

```js
const { parseInvoiceXML } = require('../invoiceParser')
const fs = require('fs')
const path = require('path')

const SAMPLE_XML = path.join(
  __dirname,
  '../../../Requirements/Sample invoices/1159855_1_C26MGG/1159855_1_C26MGG/1159855_1_C26MGG.xml'
)

test('parses valid sample XML correctly', () => {
  const xml = fs.readFileSync(SAMPLE_XML)
  const result = parseInvoiceXML(xml, '1159855_1_C26MGG.xml')
  expect(result.ok).toBe(true)
  expect(result.invoice.invoiceCode).toBe('C26MGG')
  expect(result.invoice.invoiceNumber).toBe('1159855')
  expect(result.invoice.taxId).toBe('0102721191-068')
  expect(result.invoice.totalAmount).toBe(1355980)
})

test('returns error for empty XML', () => {
  const result = parseInvoiceXML('<HDon></HDon>', 'bad.xml')
  expect(result.ok).toBe(false)
  expect(result.error).toContain('Missing DLHDon')
})

test('returns error for XML missing required fields', () => {
  const xml = '<HDon><DLHDon><KHHDon>X</KHHDon></DLHDon></HDon>'
  const result = parseInvoiceXML(xml, 'partial.xml')
  expect(result.ok).toBe(false)
  expect(result.error).toContain('Missing fields')
})
```

- [ ] **Step 3: Install test runner and run tests**

```bash
npm install --save-dev jest
npx jest backend/__tests__/invoiceParser.test.js --verbose
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/invoiceParser.js backend/__tests__/invoiceParser.test.js package.json
git commit -m "feat: XML invoice parser with unit tests"
```

---

### Task 3: In-memory invoice store

**Files:**
- Create: `backend/invoiceStore.js`

- [ ] **Step 1: Create `backend/invoiceStore.js`**

```js
// In-memory store for the current session's invoice queue.
// Replaced/cleared on new session start. Persisted via sessionManager (Plan 4).

let invoices = []

function addInvoice(invoice) {
  // Prevent duplicates by id
  if (invoices.find(i => i.id === invoice.id)) {
    return { ok: false, error: `Duplicate invoice ID: ${invoice.id}` }
  }
  invoices.push(invoice)
  return { ok: true }
}

function getInvoices() {
  return [...invoices]
}

function updateInvoiceStatus(id, status, extra = {}) {
  const inv = invoices.find(i => i.id === id)
  if (!inv) return false
  Object.assign(inv, { status, ...extra })
  return true
}

function clearInvoices() {
  invoices = []
}

function loadInvoices(list) {
  invoices = list
}

module.exports = { addInvoice, getInvoices, updateInvoiceStatus, clearInvoices, loadInvoices }
```

- [ ] **Step 2: Write unit test**

Create `backend/__tests__/invoiceStore.test.js`:

```js
const store = require('../invoiceStore')

beforeEach(() => store.clearInvoices())

const sample = {
  id: 'C26MGG-1159855', source: 'xml', invoiceCode: 'C26MGG',
  invoiceNumber: '1159855', sellerName: 'Test Co', taxId: '0102721191',
  sellerAddress: 'Hanoi', totalAmount: 1355980, status: 'pending'
}

test('adds invoice', () => {
  const result = store.addInvoice(sample)
  expect(result.ok).toBe(true)
  expect(store.getInvoices()).toHaveLength(1)
})

test('rejects duplicate invoice id', () => {
  store.addInvoice(sample)
  const result = store.addInvoice(sample)
  expect(result.ok).toBe(false)
  expect(result.error).toContain('Duplicate')
})

test('updates invoice status', () => {
  store.addInvoice(sample)
  store.updateInvoiceStatus('C26MGG-1159855', 'pass')
  expect(store.getInvoices()[0].status).toBe('pass')
})
```

- [ ] **Step 3: Run tests**

```bash
npx jest backend/__tests__/invoiceStore.test.js --verbose
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/invoiceStore.js backend/__tests__/invoiceStore.test.js
git commit -m "feat: in-memory invoice store with duplicate detection"
```

---

### Task 4: Upload endpoint

**Files:**
- Create: `backend/routes/upload.js`
- Modify: `backend/index.js`

- [ ] **Step 1: Create `backend/routes/upload.js`**

```js
const express = require('express')
const multer = require('multer')
const { parseInvoiceXML } = require('../invoiceParser')
const { addInvoice } = require('../invoiceStore')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// POST /upload — accepts multiple XML files
router.post('/', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' })
  }

  const results = []
  const duplicates = []

  for (const file of req.files) {
    const parsed = parseInvoiceXML(file.buffer, file.originalname)
    if (!parsed.ok) {
      results.push({ filename: file.originalname, ok: false, error: parsed.error })
      continue
    }
    const added = addInvoice(parsed.invoice)
    if (!added.ok) {
      duplicates.push(parsed.invoice.id)
      results.push({ filename: file.originalname, ok: false, error: added.error })
    } else {
      results.push({ filename: file.originalname, ok: true, invoice: parsed.invoice })
    }
  }

  res.json({ results, duplicates })
})

module.exports = router
```

- [ ] **Step 2: Register route in `backend/index.js`**

Add after `app.use(express.json())`:

```js
const uploadRoute = require('./routes/upload')
app.use('/upload', uploadRoute)
```

- [ ] **Step 3: Test with sample XML**

```bash
node backend/index.js
# In another terminal:
curl -X POST http://localhost:3001/upload \
  -F "files=@Requirements/Sample invoices/1159855_1_C26MGG/1159855_1_C26MGG/1159855_1_C26MGG.xml"
```

Expected: JSON with `ok: true` and parsed invoice fields.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/upload.js backend/index.js
git commit -m "feat: XML upload endpoint parses files into invoice queue"
```

---

### Task 5: Manual entry via WebSocket

**Files:**
- Modify: `backend/wsHandler.js`

- [ ] **Step 1: Add `add-manual-invoice` handler to `backend/wsHandler.js`**

```js
const { addInvoice } = require('./invoiceStore')

function handleMessage(ws, msg, wss) {
  console.log('[WS] Received:', msg.type)
  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }))
      break

    case 'add-manual-invoice': {
      const { invoiceCode, invoiceNumber, sellerName, taxId, sellerAddress, totalAmount } = msg.payload
      const missing = []
      if (!invoiceCode) missing.push('invoiceCode')
      if (!invoiceNumber) missing.push('invoiceNumber')
      if (!sellerName) missing.push('sellerName')
      if (!taxId) missing.push('taxId')
      if (!totalAmount) missing.push('totalAmount')

      if (missing.length > 0) {
        ws.send(JSON.stringify({ type: 'error', payload: `Missing fields: ${missing.join(', ')}` }))
        break
      }

      const invoice = {
        id: `${invoiceCode}-${invoiceNumber}`,
        source: 'manual',
        invoiceCode,
        invoiceNumber: String(invoiceNumber),
        sellerName,
        taxId,
        sellerAddress: sellerAddress || '',
        totalAmount: Number(totalAmount),
        status: 'pending'
      }

      const result = addInvoice(invoice)
      if (!result.ok) {
        ws.send(JSON.stringify({ type: 'error', payload: result.error }))
      } else {
        ws.send(JSON.stringify({ type: 'invoice-added', payload: invoice }))
      }
      break
    }

    default:
      console.warn('[WS] Unknown message type:', msg.type)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/wsHandler.js
git commit -m "feat: manual invoice entry via WebSocket add-manual-invoice message"
```

---

### Task 6: Frontend — DropZone component

**Files:**
- Create: `src/components/DropZone.jsx`

- [ ] **Step 1: Create `src/components/DropZone.jsx`**

```jsx
import { useRef, useState } from 'react'

export default function DropZone({ onFilesUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  async function uploadFiles(files) {
    const xmlFiles = Array.from(files).filter(f => f.name.endsWith('.xml'))
    if (xmlFiles.length === 0) return

    setUploading(true)
    const formData = new FormData()
    xmlFiles.forEach(f => formData.append('files', f))

    try {
      const res = await fetch('http://localhost:3001/upload', { method: 'POST', body: formData })
      const data = await res.json()
      onFilesUploaded(data.results)
    } catch (e) {
      console.error('Upload failed:', e)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files) }}
      onClick={() => inputRef.current.click()}
    >
      <input ref={inputRef} type="file" accept=".xml" multiple hidden
        onChange={e => uploadFiles(e.target.files)} />
      {uploading
        ? <p>Uploading...</p>
        : <p>📂 Drop XML files here or click to browse</p>}
    </div>
  )
}
```

Add to `src/index.css`:

```css
.dropzone {
  border: 2px dashed var(--glass-border);
  border-radius: var(--radius);
  padding: 40px;
  text-align: center;
  cursor: pointer;
  background: var(--glass);
  transition: border-color 0.2s, background 0.2s;
  color: var(--text-muted);
}
.dropzone.dragging, .dropzone:hover {
  border-color: var(--accent);
  background: rgba(108,99,255,0.1);
  color: var(--text);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DropZone.jsx src/index.css
git commit -m "feat: drag-and-drop XML upload DropZone component"
```

---

### Task 7: Frontend — ManualEntryForm component

**Files:**
- Create: `src/components/ManualEntryForm.jsx`

- [ ] **Step 1: Create `src/components/ManualEntryForm.jsx`**

```jsx
import { useState } from 'react'

const EMPTY = { invoiceCode: '', invoiceNumber: '', sellerName: '', taxId: '', sellerAddress: '', totalAmount: '' }

export default function ManualEntryForm({ onSubmit, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const required = ['invoiceCode', 'invoiceNumber', 'sellerName', 'taxId', 'totalAmount']
    const missing = required.filter(k => !form[k].trim())
    if (missing.length > 0) { setError(`Required: ${missing.join(', ')}`); return }
    onSubmit({ ...form, totalAmount: Number(form.totalAmount) })
    setForm(EMPTY)
    setError('')
  }

  const fields = [
    { name: 'invoiceCode', label: 'Invoice Code (Ký hiệu)', required: true },
    { name: 'invoiceNumber', label: 'Invoice Number (Số HĐ)', required: true },
    { name: 'sellerName', label: 'Seller Name', required: true },
    { name: 'taxId', label: 'Tax ID (MST)', required: true },
    { name: 'sellerAddress', label: 'Seller Address', required: false },
    { name: 'totalAmount', label: 'Total Amount (VND)', required: true, type: 'number' }
  ]

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Add Invoice Manually</h3>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          {fields.map(f => (
            <div className="field" key={f.name}>
              <label>{f.label}{f.required && ' *'}</label>
              <input name={f.name} type={f.type || 'text'} value={form[f.name]}
                onChange={handleChange} className="mock-input" />
            </div>
          ))}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Add Invoice</button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

Add to `src/index.css`:

```css
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal {
  background: linear-gradient(135deg, var(--bg2), var(--bg3));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius); padding: 32px; width: 480px; max-width: 95vw;
}
.modal h3 { margin-bottom: 20px; font-size: 1.2rem; }
.field { margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 0.85rem; color: var(--text-muted); }
.mock-input {
  background: var(--glass); border: 1px solid var(--glass-border);
  border-radius: 8px; padding: 10px 14px; color: var(--text);
  font-size: 0.9rem; font-family: inherit; width: 100%;
}
.mock-input:focus { outline: none; border-color: var(--accent); }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; }
.btn-primary {
  background: var(--accent); color: white; border: none;
  border-radius: 8px; padding: 10px 20px; cursor: pointer; font-family: inherit;
}
.btn-secondary {
  background: var(--glass); color: var(--text); border: 1px solid var(--glass-border);
  border-radius: 8px; padding: 10px 20px; cursor: pointer; font-family: inherit;
}
.error { color: var(--fail); font-size: 0.85rem; margin-bottom: 12px; }
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ManualEntryForm.jsx src/index.css
git commit -m "feat: manual invoice entry form with validation"
```

---

### Task 8: Frontend — InvoiceQueue component & App wiring

**Files:**
- Create: `src/components/InvoiceQueue.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `src/components/InvoiceQueue.jsx`**

```jsx
const STATUS_LABELS = {
  pending: { label: 'Pending', color: 'var(--text-muted)' },
  processing: { label: 'Processing...', color: 'var(--accent)' },
  pass: { label: '✅ Pass', color: 'var(--pass)' },
  'invalid-invoice': { label: '❌ Invalid Invoice', color: 'var(--fail)' },
  'invalid-business': { label: '❌ Invalid Business', color: 'var(--fail)' },
  skipped: { label: '⚠️ Skipped', color: 'var(--skip)' }
}

export default function InvoiceQueue({ invoices }) {
  if (invoices.length === 0) return null

  return (
    <div className="queue">
      <h3>Invoice Queue ({invoices.length})</h3>
      {invoices.map((inv) => {
        const s = STATUS_LABELS[inv.status] || STATUS_LABELS.pending
        return (
          <div key={inv.id} className={`invoice-card ${inv.status}`}>
            <div className="invoice-info">
              <span className="invoice-id">{inv.invoiceCode} / {inv.invoiceNumber}</span>
              <span className="invoice-seller">{inv.sellerName}</span>
              <span className="invoice-amount">{inv.totalAmount.toLocaleString('vi-VN')} ₫</span>
            </div>
            <span className="invoice-status" style={{ color: s.color }}>{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}
```

Add to `src/index.css`:

```css
.queue { margin-top: 24px; }
.queue h3 { margin-bottom: 12px; font-size: 1rem; color: var(--text-muted); }
.invoice-card {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--glass); border: 1px solid var(--glass-border);
  border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;
  transition: background 0.2s;
}
.invoice-card.processing { border-color: var(--accent); }
.invoice-card.pass { border-color: var(--pass); }
.invoice-card.invalid-invoice, .invoice-card.invalid-business { border-color: var(--fail); }
.invoice-info { display: flex; flex-direction: column; gap: 2px; }
.invoice-id { font-weight: 600; font-size: 0.95rem; }
.invoice-seller { font-size: 0.8rem; color: var(--text-muted); }
.invoice-amount { font-size: 0.8rem; color: var(--accent2); }
.invoice-status { font-size: 0.85rem; font-weight: 500; white-space: nowrap; }
```

- [ ] **Step 2: Update `src/App.jsx` to wire everything together**

```jsx
import { useState } from 'react'
import { useWebSocket } from './useWebSocket'
import DropZone from './components/DropZone'
import ManualEntryForm from './components/ManualEntryForm'
import InvoiceQueue from './components/InvoiceQueue'

export default function App() {
  const [invoices, setInvoices] = useState([])
  const [showManualForm, setShowManualForm] = useState(false)
  const [wsStatus, setWsStatus] = useState('Connecting...')

  const { send } = useWebSocket((msg) => {
    if (msg.type === 'pong') setWsStatus('Connected')
    if (msg.type === 'invoice-added') {
      setInvoices(prev => [...prev, msg.payload])
    }
    if (msg.type === 'error') {
      alert(msg.payload)
    }
  })

  function handleFilesUploaded(results) {
    const added = results.filter(r => r.ok).map(r => r.invoice)
    const errors = results.filter(r => !r.ok)
    setInvoices(prev => [...prev, ...added])
    if (errors.length > 0) alert(errors.map(e => e.error).join('\n'))
  }

  function handleManualSubmit(data) {
    send({ type: 'add-manual-invoice', payload: data })
    setShowManualForm(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>VATOCR</h1>
        <span className="ws-status">{wsStatus}</span>
      </header>
      <main className="app-main">
        <DropZone onFilesUploaded={handleFilesUploaded} />
        <button className="btn-secondary" style={{ marginTop: 12 }}
          onClick={() => setShowManualForm(true)}>
          + Add Invoice Manually
        </button>
        <InvoiceQueue invoices={invoices} />
      </main>
      {showManualForm && (
        <ManualEntryForm
          onSubmit={handleManualSubmit}
          onClose={() => setShowManualForm(false)}
        />
      )}
    </div>
  )
}
```

Add to `src/index.css`:

```css
.app-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 32px;
}
.app-header h1 { font-size: 1.8rem; font-weight: 700; letter-spacing: 2px; }
.ws-status { font-size: 0.8rem; color: var(--text-muted); }
.app-main { max-width: 800px; margin: 0 auto; }
```

- [ ] **Step 3: Run full stack and verify end-to-end**

```bash
npm run dev
```

1. Drop the sample XML file onto the drop zone → invoice appears in queue
2. Click "Add Invoice Manually" → fill form → invoice appears in queue
3. Confirm no duplicate warning for unique invoices

- [ ] **Step 4: Commit**

```bash
git add src/components/InvoiceQueue.jsx src/App.jsx src/index.css
git commit -m "feat: invoice queue UI wired to XML upload and manual entry"
```
