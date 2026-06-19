# VATOCR — Plan 4: Session Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist processing progress to a timestamped session folder so users can resume abandoned batches. On app launch, detect and list incomplete sessions for resumption.

**Architecture:** `sessionManager.js` creates the session folder, writes `session.json` after every invoice, and reads it back on resume. The frontend shows a "Resume Sessions" panel on the home screen when incomplete sessions exist.

**Tech Stack:** Node.js `fs`, Express REST endpoints

**Prereq:** Plans 1–3 complete.

---

## File Structure

```
backend/
└── sessionManager.js        # Create, save, load, list sessions
backend/routes/
└── sessions.js              # GET /sessions (list), GET /sessions/:id (load), POST /sessions/new
src/components/
└── ResumePanel.jsx          # Lists incomplete sessions, resume button
```

---

### Task 1: Session manager module

**Files:**
- Create: `backend/sessionManager.js`

- [ ] **Step 1: Create `backend/sessionManager.js`**

```js
const fs = require('fs')
const path = require('path')

// Output folder relative to app root (or Electron resources dir in production)
const OUTPUT_DIR = path.join(process.cwd(), 'output')

function getTimestamp() {
  const d = new Date()
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_')
}

function createSession() {
  const id = getTimestamp()
  const sessionDir = path.join(OUTPUT_DIR, id)
  fs.mkdirSync(path.join(sessionDir, 'screenshots'), { recursive: true })

  const session = {
    id,
    sessionDir,
    createdAt: new Date().toISOString(),
    status: 'incomplete',
    invoices: [],
    progress: { done: 0, total: 0 }
  }

  fs.writeFileSync(path.join(sessionDir, 'session.json'), JSON.stringify(session, null, 2))
  return session
}

function saveSession(sessionDir, invoices) {
  const done = invoices.filter(i => i.status !== 'pending' && i.status !== 'processing').length
  const session = {
    id: path.basename(sessionDir),
    sessionDir,
    status: done === invoices.length ? 'complete' : 'incomplete',
    invoices,
    progress: { done, total: invoices.length },
    updatedAt: new Date().toISOString()
  }
  fs.writeFileSync(path.join(sessionDir, 'session.json'), JSON.stringify(session, null, 2))
  return session
}

function loadSession(sessionDir) {
  const file = path.join(sessionDir, 'session.json')
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function listIncompleteSessions() {
  if (!fs.existsSync(OUTPUT_DIR)) return []

  return fs.readdirSync(OUTPUT_DIR)
    .map(name => {
      const sessionDir = path.join(OUTPUT_DIR, name)
      const file = path.join(sessionDir, 'session.json')
      if (!fs.existsSync(file)) return null
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'))
        return data.status === 'incomplete' ? data : null
      } catch { return null }
    })
    .filter(Boolean)
    .sort((a, b) => b.id.localeCompare(a.id)) // newest first
}

module.exports = { createSession, saveSession, loadSession, listIncompleteSessions, OUTPUT_DIR }
```

- [ ] **Step 2: Write unit tests**

Create `backend/__tests__/sessionManager.test.js`:

```js
const { createSession, saveSession, loadSession, listIncompleteSessions } = require('../sessionManager')
const fs = require('fs')
const path = require('path')
const os = require('os')

// Override OUTPUT_DIR for tests
jest.mock('../sessionManager', () => {
  const original = jest.requireActual('../sessionManager')
  const tmpDir = require('os').tmpdir()
  // Re-export with test output dir
  return { ...original }
})

test('createSession creates folder and session.json', () => {
  const session = createSession()
  expect(fs.existsSync(session.sessionDir)).toBe(true)
  expect(fs.existsSync(path.join(session.sessionDir, 'session.json'))).toBe(true)
  expect(session.status).toBe('incomplete')
  // Cleanup
  fs.rmSync(session.sessionDir, { recursive: true })
})

test('saveSession marks complete when all invoices done', () => {
  const session = createSession()
  const invoices = [{ id: 'A', status: 'pass' }, { id: 'B', status: 'invalid-invoice' }]
  const saved = saveSession(session.sessionDir, invoices)
  expect(saved.status).toBe('complete')
  fs.rmSync(session.sessionDir, { recursive: true })
})

test('loadSession reads saved data', () => {
  const session = createSession()
  const invoices = [{ id: 'A', status: 'pending' }]
  saveSession(session.sessionDir, invoices)
  const loaded = loadSession(session.sessionDir)
  expect(loaded.invoices).toHaveLength(1)
  fs.rmSync(session.sessionDir, { recursive: true })
})
```

```bash
npx jest backend/__tests__/sessionManager.test.js --verbose
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/sessionManager.js backend/__tests__/sessionManager.test.js
git commit -m "feat: session manager creates, saves, loads, and lists sessions"
```

---

### Task 2: Sessions REST endpoints

**Files:**
- Create: `backend/routes/sessions.js`
- Modify: `backend/index.js`

- [ ] **Step 1: Create `backend/routes/sessions.js`**

```js
const express = require('express')
const { createSession, loadSession, listIncompleteSessions } = require('../sessionManager')
const { loadInvoices } = require('../invoiceStore')

const router = express.Router()

// GET /sessions — list all incomplete sessions
router.get('/', (req, res) => {
  res.json(listIncompleteSessions())
})

// POST /sessions/new — create a new session, returns { sessionDir }
router.post('/new', (req, res) => {
  const session = createSession()
  res.json({ sessionDir: session.sessionDir, id: session.id })
})

// POST /sessions/resume — load a session into the invoice store
router.post('/resume', (req, res) => {
  const { sessionDir } = req.body
  if (!sessionDir) return res.status(400).json({ error: 'sessionDir required' })

  const session = loadSession(sessionDir)
  if (!session) return res.status(404).json({ error: 'Session not found' })

  // Load pending invoices into store (skip completed ones)
  const toResume = session.invoices.map(i =>
    (i.status === 'processing') ? { ...i, status: 'pending' } : i
  )
  loadInvoices(toResume)

  res.json({ session, invoices: toResume })
})

module.exports = router
```

- [ ] **Step 2: Register in `backend/index.js`**

```js
const sessionsRoute = require('./routes/sessions')
app.use('/sessions', sessionsRoute)
```

- [ ] **Step 3: Test endpoints**

```bash
node backend/index.js
curl -X POST http://localhost:3001/sessions/new
```

Expected: `{"sessionDir":"...","id":"2026-05-29_..."}`.

```bash
curl http://localhost:3001/sessions
```

Expected: JSON array of incomplete sessions.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/sessions.js backend/index.js
git commit -m "feat: session REST endpoints for create, list, and resume"
```

---

### Task 3: Wire session saving into automation engine

**Files:**
- Modify: `backend/automation/automationEngine.js`

- [ ] **Step 1: Import sessionManager and save after each invoice**

Add at top of `automationEngine.js`:

```js
const { saveSession } = require('../sessionManager')
```

Inside the `for` loop in `startProcessing`, after `updateInvoiceStatus(...)` and `broadcast(...)`, add:

```js
// Persist progress after every invoice
saveSession(currentSessionDir, getInvoices())
```

Also add `getInvoices` to the import from `invoiceStore`:

```js
const { getInvoices, updateInvoiceStatus } = require('../invoiceStore')
```

- [ ] **Step 2: Commit**

```bash
git add backend/automation/automationEngine.js
git commit -m "feat: save session progress after each invoice"
```

---

### Task 4: Frontend — ResumePanel component

**Files:**
- Create: `src/components/ResumePanel.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `src/components/ResumePanel.jsx`**

```jsx
import { useEffect, useState } from 'react'

export default function ResumePanel({ onResume }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('http://localhost:3001/sessions')
      .then(r => r.json())
      .then(data => { setSessions(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading || sessions.length === 0) return null

  return (
    <div className="resume-panel">
      <h3>📂 Resume Previous Sessions</h3>
      {sessions.map(session => (
        <div key={session.id} className="resume-card">
          <div>
            <span className="resume-id">{session.id.replace(/_/g, ' ')}</span>
            <span className="resume-progress">
              {session.progress.done}/{session.progress.total} invoices completed
            </span>
          </div>
          <button className="btn-primary" onClick={() => onResume(session.sessionDir)}>
            Resume →
          </button>
        </div>
      ))}
    </div>
  )
}
```

Add to `src/index.css`:

```css
.resume-panel {
  background: var(--glass); border: 1px solid var(--accent);
  border-radius: var(--radius); padding: 20px; margin-bottom: 24px;
}
.resume-panel h3 { margin-bottom: 14px; font-size: 0.95rem; }
.resume-card {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid var(--glass-border);
}
.resume-card:last-child { border-bottom: none; }
.resume-id { display: block; font-weight: 500; font-size: 0.9rem; }
.resume-progress { display: block; font-size: 0.78rem; color: var(--text-muted); }
```

- [ ] **Step 2: Wire ResumePanel into `src/App.jsx`**

```jsx
import ResumePanel from './components/ResumePanel'

// Add handler:
async function handleResume(sessionDir) {
  const res = await fetch('http://localhost:3001/sessions/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionDir })
  })
  const data = await res.json()
  setInvoices(data.invoices)
  setCurrentSessionDir(sessionDir)
}

// Add to JSX before DropZone:
<ResumePanel onResume={handleResume} />
```

- [ ] **Step 3: Add sessionDir state and pass to start-processing**

```jsx
const [currentSessionDir, setCurrentSessionDir] = useState(null)

// On start processing:
async function handleStartProcessing(mode) {
  let sessionDir = currentSessionDir
  if (!sessionDir) {
    const res = await fetch('http://localhost:3001/sessions/new', { method: 'POST' })
    const data = await res.json()
    sessionDir = data.sessionDir
    setCurrentSessionDir(sessionDir)
  }
  send({ type: 'start-processing', payload: { sessionDir, mode } })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ResumePanel.jsx src/App.jsx src/index.css
git commit -m "feat: resume panel loads incomplete sessions from disk"
```
