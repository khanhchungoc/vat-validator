# Light Theme Polishing & Session Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harmonize the application UI typography, migrate the activity log to the light theme, scale up CAPTCHA image display, and implement a previous session deletion feature.

**Architecture:** Update `src/index.css` to unify the font stack, weights, and sizes, and change log console panels to a light background. Modify `App.jsx` and `CaptchaModal.jsx` to fix inline font overrides and scale up the CAPTCHA image. Add a deletion utility on the backend (fs.rmSync) with API endpoint routing, and wire it up to a new Delete button in the frontend `ResumePanel.jsx` component.

**Tech Stack:** React 19, CSS, Node.js/Express, Jest

---

### Task 1: Unify Typography & Light Theme Live Console in CSS

**Files:**
- Modify: `src/index.css`

- [x] **Step 1: Update typography stack, weights, and console panel styles in `src/index.css`**
  Modify `src/index.css` to unify font rules and shift the Live Activity Console to light mode.

  Update the `body` font stack on line 20:
  ```css
  body {
    background: var(--bg-color);
    color: var(--text-main);
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    height: 100vh;
    overflow: hidden;
  }
  ```

  Clean up and normalize weights/sizes across the classes, replacing `500` weights with `400` or `600`, and standardizing sizes to `0.8rem` (small/captions), `0.9rem` (normal), `1rem` (headings), and `1.25rem` (headers).

  Modify **Console Styling** section (lines 359-487) to make it light-themed:
  ```css
  /* Console Styling */
  .live-console {
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .live-console.expanded {
    flex: 1;
    min-height: 250px;
  }
  .live-console.collapsed {
    flex: 0 0 auto;
    min-height: 0;
  }
  .console-accordion-header {
    background: #f8fafc;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--panel-border);
  }
  .console-header-btn {
    background: none;
    border: none;
    flex: 1;
    padding: 12px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    color: var(--text-main);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .console-header-btn:hover {
    background: rgba(0, 0, 0, 0.02);
  }
  .console-close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 12px 16px;
    font-size: 0.9rem;
    transition: color 0.2s;
  }
  .console-close-btn:hover {
    color: var(--fail);
  }
  .console-status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .console-status-indicator.idle {
    background: #64748b;
    box-shadow: 0 0 4px #64748b;
  }
  .console-status-indicator.active {
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
    animation: console-indicator-pulse 1.5s infinite;
  }
  @keyframes console-indicator-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }
  .console-chevron {
    font-size: 0.65rem;
    color: var(--text-muted);
    transition: transform 0.3s;
  }
  .console-chevron.open {
    transform: rotate(180deg);
  }
  .console-body {
    flex: 1;
    min-height: 0;
    padding: 14px;
    overflow-y: auto;
    font-size: 0.8rem;
    line-height: 1.5;
  }
  .console-body::-webkit-scrollbar {
    width: 6px;
  }
  .console-body::-webkit-scrollbar-track {
    background: transparent;
  }
  .console-body::-webkit-scrollbar-thumb {
    background: var(--panel-border);
    border-radius: 20px;
  }
  .console-body::-webkit-scrollbar-thumb:hover {
    background: var(--accent);
  }
  .console-placeholder {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-style: italic;
    text-align: center;
    font-size: 0.75rem;
  }
  .console-lines {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .console-line {
    display: flex;
    gap: 8px;
    word-break: break-all;
  }
  .console-time {
    color: var(--accent);
    flex-shrink: 0;
  }
  .console-text {
    color: var(--text-main);
  }
  ```

- [x] **Step 2: Commit Task 1 changes**
  Run: `git add src/index.css; git commit -m "feat(ui): unify typography and make Live Console light themed"`

---

### Task 2: Fix Error Banner & Scale CAPTCHA Image

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/CaptchaModal.jsx`

- [x] **Step 1: Refactor Error Banner pre element font in `src/App.jsx`**
  Modify `src/App.jsx` to explicitly inherit font-family in the error pre element, preventing browser monospace fallback (around line 295).

  Find:
  ```javascript
  <pre style={{ margin: 0, fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-main)', userSelect: 'text' }}>{appError}</pre>
  ```

  Replace with:
  ```javascript
  <pre style={{ margin: 0, fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-main)', userSelect: 'text', fontFamily: 'inherit' }}>{appError}</pre>
  ```

- [x] **Step 2: Scale up CAPTCHA image in `src/components/CaptchaModal.jsx`**
  Modify `src/components/CaptchaModal.jsx` to specify a larger size for the CAPTCHA image.

  Find:
  ```javascript
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)', display: 'inline-block', marginBottom: 24 }}>
            <img
              src={`data:image/png;base64,${imageBase64}`}
              alt="CAPTCHA Hint"
              className="captcha-image"
              style={{ 
                display: 'block',
                margin: '0 auto',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}
            />
          </div>
  ```

  Replace with:
  ```javascript
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)', display: 'inline-block', marginBottom: 24 }}>
            <img
              src={`data:image/png;base64,${imageBase64}`}
              alt="CAPTCHA Hint"
              className="captcha-image"
              style={{ 
                display: 'block',
                margin: '0 auto',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                width: '240px',
                height: 'auto'
              }}
            />
          </div>
  ```

- [x] **Step 3: Commit Task 2 changes**
  Run: `git add src/App.jsx src/components/CaptchaModal.jsx; git commit -m "feat(ui): inherit error font and scale up CAPTCHA modal image"`

---

### Task 3: Backend Session Deletion Utility & Route

**Files:**
- Modify: `backend/sessionManager.js`
- Modify: `backend/routes/sessions.js`
- Modify: `backend/__tests__/sessionManager.test.js`
- Modify: `backend/__tests__/routes_sessions.test.js`

- [x] **Step 1: Add `deleteSession` helper in `backend/sessionManager.js`**
  Add definition and export it.

  Add function:
  ```javascript
  function deleteSession(sessionDir) {
    try {
      if (!validateDir(sessionDir)) {
        throw new Error(`Invalid session directory: ${sessionDir}`)
      }
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true })
      }
      return true
    } catch (err) {
      console.error('Failed to delete session:', err)
      return false
    }
  }
  ```

  Export it at the end of the file:
  ```javascript
  module.exports = { createSession, saveSession, loadSession, deleteSession, listIncompleteSessions, OUTPUT_DIR, validateDir }
  ```

- [x] **Step 2: Add unit test in `backend/__tests__/sessionManager.test.js`**
  Add a test to verify `deleteSession` deletes the folder correctly.

  Add test content (around line 64):
  ```javascript
    test('deleteSession should delete the session folder', () => {
      const session = createSession()
      expect(fs.existsSync(session.sessionDir)).toBe(true)
      
      const deleted = deleteSession(session.sessionDir)
      expect(deleted).toBe(true)
      expect(fs.existsSync(session.sessionDir)).toBe(false)
    })
  ```

- [x] **Step 3: Expose `POST /sessions/delete` route in `backend/routes/sessions.js`**
  Import `deleteSession` and add the router callback.

  Find imports:
  ```javascript
  const { createSession, loadSession, listIncompleteSessions, OUTPUT_DIR, validateDir } = require('../sessionManager')
  ```

  Replace with:
  ```javascript
  const { createSession, loadSession, deleteSession, listIncompleteSessions, OUTPUT_DIR, validateDir } = require('../sessionManager')
  ```

  Add route handler before `module.exports`:
  ```javascript
  // POST /sessions/delete - delete a session folder
  router.post('/delete', (req, res) => {
    const { sessionDir } = req.body
    if (!sessionDir) return res.status(400).json({ error: 'sessionDir required' })

    if (!validateDir(sessionDir)) {
      return res.status(400).json({ error: 'Invalid session directory' })
    }

    const success = deleteSession(sessionDir)
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete session' })
    }

    res.json({ ok: true })
  })
  ```

- [x] **Step 4: Add route tests in `backend/__tests__/routes_sessions.test.js`**
  Mock `deleteSession` and add test cases verifying success and failure handling of the deletion route.

  Update the mocked imports at line 16:
  ```javascript
  jest.mock('../sessionManager', () => ({
    createSession: jest.fn(),
    loadSession: jest.fn(),
    deleteSession: jest.fn(),
    listIncompleteSessions: jest.fn(),
    OUTPUT_DIR: 'C:\\Users\\KhanhChuNgoc\\Documents\\Personal Projects\\VATOCR\\output',
    validateDir: jest.fn().mockImplementation((dir) => {
      if (!dir) return false
      const path = require('path')
      const absolute = path.resolve(dir)
      const base = path.resolve('C:\\Users\\KhanhChuNgoc\\Documents\\Personal Projects\\VATOCR\\output')
      return absolute === base || absolute.startsWith(base + path.sep)
    })
  }))
  ```

  Add describe block:
  ```javascript
    describe('POST /delete', () => {
      const handler = getHandler('POST', '/delete')
      const validDir = 'C:\\Users\\KhanhChuNgoc\\Documents\\Personal Projects\\VATOCR\\output\\session1'

      test('returns 400 if sessionDir is missing', () => {
        handler(req, res)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ error: 'sessionDir required' })
      })

      test('returns 400 if sessionDir is invalid', () => {
        req.body.sessionDir = 'C:\\Users\\KhanhChuNgoc\\Documents\\Secret'
        handler(req, res)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session directory' })
      })

      test('returns 500 if deleteSession fails', () => {
        req.body.sessionDir = validDir
        deleteSession.mockReturnValue(false)
        handler(req, res)
        expect(res.status).toHaveBeenCalledWith(500)
      })

      test('returns 200/ok on success', () => {
        req.body.sessionDir = validDir
        deleteSession.mockReturnValue(true)
        handler(req, res)
        expect(res.json).toHaveBeenCalledWith({ ok: true })
      })
    })
  ```

- [x] **Step 5: Run backend tests to verify correctness**
  Run: `npm test backend/__tests__/sessionManager.test.js backend/__tests__/routes_sessions.test.js`
  Expected: PASS

- [x] **Step 6: Commit Task 3 changes**
  Run: `git add backend/sessionManager.js backend/routes/sessions.js backend/__tests__/sessionManager.test.js backend/__tests__/routes_sessions.test.js; git commit -m "feat(backend): implement session deletion API and tests"`

---

### Task 4: UI Delete Session Integration

**Files:**
- Modify: `src/components/ResumePanel.jsx`
- Modify: `src/App.jsx`

- [x] **Step 1: Implement Delete Button in `src/components/ResumePanel.jsx`**
  Add a `handleDelete` callback fetching the delete endpoint, prompting confirmation, and calling a callback to update state.

  Rewrite `src/components/ResumePanel.jsx`:
  ```javascript
  import { useEffect, useState } from 'react'

  export default function ResumePanel({ onResume, onDeleteSession }) {
    const [sessions, setSessions] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchSessions = () => {
      const port = new URLSearchParams(window.location.search).get('port') || '3001'
      fetch(`http://localhost:${port}/sessions`)
        .then(r => r.json())
        .then(data => { setSessions(data); setLoading(false) })
        .catch(() => setLoading(false))
    }

    useEffect(() => {
      fetchSessions()
    }, [])

    const handleDelete = async (session) => {
      const confirmed = window.confirm(`Are you sure you want to permanently delete the session "${session.id.replace(/_/g, ' ')}"? This action cannot be undone.`)
      if (!confirmed) return

      try {
        const port = new URLSearchParams(window.location.search).get('port') || '3001'
        const res = await fetch(`http://localhost:${port}/sessions/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionDir: session.sessionDir })
        })
        if (res.ok) {
          setSessions(prev => prev.filter(s => s.id !== session.id))
          if (onDeleteSession) onDeleteSession(session.sessionDir)
        } else {
          const data = await res.json()
          alert(data.error || 'Failed to delete session')
        }
      } catch (err) {
        alert('Failed to delete session')
      }
    }

    if (loading || sessions.length === 0) return null

    return (
      <div className="resume-panel">
        <h3>📁 Resume Previous Sessions</h3>
        {sessions.map(session => (
          <div key={session.id} className="resume-card">
            <div className="resume-info">
              <span className="resume-id">{session.id.replace(/_/g, ' ')}</span>
              <span className="resume-progress">
                {session.progress.done}/{session.progress.total} invoices completed
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn-secondary" 
                style={{ borderColor: 'var(--fail)', color: 'var(--fail)' }} 
                onClick={() => handleDelete(session)}
              >
                Delete
              </button>
              <button className="btn-primary" onClick={() => onResume(session.sessionDir)}>
                Resume →
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }
  ```

- [x] **Step 2: Update `ResumePanel` parameters in `src/App.jsx`**
  Modify `src/App.jsx` to pass `onDeleteSession` callback (so it can clean up if the current session directory was deleted).

  Find (around line 301):
  ```javascript
                {!currentSessionDir && invoices.length === 0 && (
                  <ResumePanel onResume={handleResume} />
                )}
  ```

  Replace with:
  ```javascript
                {!currentSessionDir && invoices.length === 0 && (
                  <ResumePanel onResume={handleResume} onDeleteSession={(dir) => {
                    if (currentSessionDir === dir) {
                      setCurrentSessionDir(null)
                    }
                  }} />
                )}
  ```

- [x] **Step 3: Build frontend client and run all Jest tests**
  Run: `npm run build`
  Run: `npm test`
  Expected: Success.

- [x] **Step 4: Commit Task 4 changes**
  Run: `git add src/components/ResumePanel.jsx src/App.jsx; git commit -m "feat(ui): integrate session deletion into ResumePanel"`
