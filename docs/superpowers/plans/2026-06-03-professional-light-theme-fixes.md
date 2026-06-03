# Professional Light Theme Styling Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix visual styling regressions in the CAPTCHA modal and error banner to restore visibility and high contrast in the new light theme.

**Architecture:** Update inline styling in `src/components/CaptchaModal.jsx` to replace deleted dark-theme glass variables with new light-theme design tokens. Refactor the inline-styled error banner in `src/App.jsx` to use high-contrast dark text on a light background.

**Tech Stack:** React 19, CSS

---

### Task 1: Refactor CaptchaModal Inline Styles

**Files:**
- Modify: `src/components/CaptchaModal.jsx:38-75`

- [x] **Step 1: Replace glass border and background custom properties with light-theme vars**
  Modify `src/components/CaptchaModal.jsx` to update the modal styling, replacing obsolete `--glass-border` and translucent white styles.

  Find target content (lines 38-42):
  ```javascript
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'inline-block', marginBottom: 24 }}>
            <img
              src={`data:image/png;base64,${imageBase64}`}
              alt="CAPTCHA Hint"
              className="captcha-image"
  ```

  Replace with:
  ```javascript
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)', display: 'inline-block', marginBottom: 24 }}>
            <img
              src={`data:image/png;base64,${imageBase64}`}
              alt="CAPTCHA Hint"
              className="captcha-image"
  ```

  Find target content (lines 61-71):
  ```javascript
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  outline: 'none'
                }}
  ```

  Replace with:
  ```javascript
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--panel-border)',
                  background: 'var(--panel-bg)',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  outline: 'none'
                }}
  ```

- [x] **Step 2: Commit Task 1 changes**
  Run: `git add src/components/CaptchaModal.jsx; git commit -m "feat(ui): fix CAPTCHA modal visibility in light theme"`

---

### Task 2: Refactor Error Banner Inline Styles in App.jsx

**Files:**
- Modify: `src/App.jsx:287-299`

- [ ] **Step 1: Replace dark text color values with high-contrast slate colors**
  Modify `src/App.jsx` to update the error banner inline styles.

  Find target content (lines 287-299):
  ```javascript
                {appError && (
                  <div style={{
                    background: 'rgba(220,53,69,0.15)', border: '1px solid #dc3545',
                    borderRadius: 8, padding: '14px 18px', marginBottom: 16,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12
                  }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: '#ff6b6b', display: 'block', marginBottom: 6 }}>⚠️ Processing Error</strong>
                      <pre style={{ margin: 0, fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#e0e0e0', userSelect: 'text' }}>{appError}</pre>
                    </div>
                    <button onClick={() => setAppError(null)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1.2rem', flexShrink: 0 }}>✕</button>
                  </div>
                )}
  ```

  Replace with:
  ```javascript
                {appError && (
                  <div style={{
                    background: '#fef2f2', border: '1px solid var(--fail)',
                    borderRadius: 8, padding: '14px 18px', marginBottom: 16,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12
                  }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: 'var(--fail)', display: 'block', marginBottom: 6 }}>⚠️ Processing Error</strong>
                      <pre style={{ margin: 0, fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-main)', userSelect: 'text' }}>{appError}</pre>
                    </div>
                    <button onClick={() => setAppError(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', flexShrink: 0 }}>✕</button>
                  </div>
                )}
  ```

- [ ] **Step 2: Run build to ensure successful compilation**
  Run: `npm run build`
  Expected: Success.

- [ ] **Step 3: Run Jest tests to ensure regression-free build**
  Run: `npm test`
  Expected: All 52 tests pass.

- [ ] **Step 4: Commit Task 2 changes**
  Run: `git add src/App.jsx; git commit -m "feat(ui): fix error banner contrast in light theme"`
