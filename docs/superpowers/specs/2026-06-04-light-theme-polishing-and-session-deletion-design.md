# Design Spec: Light Theme Polishing & Session Deletion

Refine the application's light theme, standardize the typography layout, and implement a feature allowing users (accountants) to delete incomplete previous sessions directly from the UI.

## Problem Statement

1. **Dark Theme Residuals**: The Live Activity Console (logs) still uses a dark background internally which diverges from the light theme design language.
2. **Typography Deviations**: There are multiple font families (Segoe UI, -apple-system, BlinkMacSystemFont, Arial, etc.) and too many distinct font sizes and weights in use. This causes visual noise. Monospace should be limited strictly to the console logs.
3. **Session Management**: Users have no way to clean up aborted, incomplete, or corrupted previous sessions from the workspace, leading to cluttered dashboards.

## Solution

### 1. Visual Theme & Typographical Harmonization

- **Light Theme Console**: Shift the `.live-console` panel background to solid white, change headers, indicators, chevrons, and log line text to use high-contrast slate-gray/dark text.
- **Font Stack**: Restrict the font family to exactly one standard stack:
  ```css
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
  ```
  Apply this to `body` and ensure it is inherited by all headers, buttons, inputs, and modals.
- **Minimizing Font Variations**:
  - Limit font weights to: `400` (normal) and `600` (bold).
  - Limit font sizes to:
    - Base / normal text: `0.9rem` (14px)
    - Headings / card titles: `1rem` (16px)
    - App main title: `1.25rem` (20px)
    - Small captions / metadata: `0.8rem` (12.8px)
- **Error Banner `<pre>` Refactor**: In `src/App.jsx`, replace the `<pre>` error element with a styled `div` using `font-family: inherit` to prevent browser monospace fallbacks.

### 2. Session Deletion Feature

We will introduce a backend route to safely delete a session folder and wire it up to a "Delete" button inside `ResumePanel.jsx`.

- **Backend**:
  - `backend/sessionManager.js`: Add `deleteSession(sessionDir)` which deletes the folder recursively using `fs.rmSync` after safety validation.
  - `backend/routes/sessions.js`: Expose `POST /sessions/delete`.
- **Frontend**:
  - `ResumePanel.jsx`: Add a "Delete" button next to "Resume →". Clicking it prompts for confirmation (`window.confirm`) and performs a POST request to `/sessions/delete`, then triggers state removal.

---

## Detailed Design

### Code Changes

#### 1. `src/index.css` (Typography and Console)

- Set `font-family` on `body` to `'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif`.
- Update `.live-console` to:
  ```css
  .live-console {
    background: var(--panel-bg);
    border: 1px solid var(--panel-border);
    /* ... */
  }
  .console-accordion-header {
    background: #f8fafc;
    border-bottom: 1px solid var(--panel-border);
  }
  .console-header-btn {
    color: var(--text-main);
  }
  .console-chevron {
    color: var(--text-muted);
  }
  .console-text {
    color: var(--text-main);
  }
  ```
- Unify font sizes and weights globally across selectors.

#### 2. `backend/sessionManager.js`
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

#### 3. `backend/routes/sessions.js`
```javascript
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

#### 4. `src/components/ResumePanel.jsx`
- Add API callback: `fetch('.../sessions/delete', { method: 'POST', body: { sessionDir } })`
- Display a small red Delete button next to the Resume button.

#### 5. `src/components/CaptchaModal.jsx` (CAPTCHA Image Scaling)
- Scale up the CAPTCHA image inside the modal to make characters highly legible.
- Set inline style `width: '240px'` and `height: 'auto'` on the `<img>` element. Use `image-rendering: 'pixelated'` or `image-rendering: 'crisp-edges'` if the upscaling causes excessive blur, but standard scaling should suffice.

