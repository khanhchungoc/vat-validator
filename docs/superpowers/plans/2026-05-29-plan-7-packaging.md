# VATOCR — Plan 7: Electron Packaging

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the complete app into a distributable Windows `.exe` installer using `electron-builder`. The installer bundles Electron, Node.js, Playwright + Chromium, and all npm dependencies — no setup required on target machines.

**Architecture:** `electron-builder` reads config from `package.json` and produces an NSIS `.exe` installer in the `release/` folder. The Electron main process is updated to resolve backend paths correctly when running from the installed location.

**Tech Stack:** `electron-builder`, NSIS (Windows installer format)

**Prereq:** Plans 1–6 complete (app fully functional in dev mode).

---

## File Structure

```
electron/
└── main.js              # Updated: production-safe path resolution
assets/
└── icon.ico             # App icon (Windows)
package.json             # Updated: full electron-builder config
release/                 # Output folder (gitignored) — contains .exe
```

---

### Task 1: Verify dev mode works end-to-end

- [ ] **Step 1: Run full dev stack**

```bash
npm run dev
```

Confirm all features work before packaging:
- [ ] XML upload and parsing
- [ ] Manual entry
- [ ] CAPTCHA modal
- [ ] Step / Auto mode toggle
- [ ] Session resume
- [ ] PDF + XLSX generation and download

- [ ] **Step 2: If any test fails, fix before proceeding to packaging**

---

### Task 2: Production-safe Electron main process

**Files:**
- Modify: `electron/main.js`

- [ ] **Step 1: Update `electron/main.js` for production paths**

```js
const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

const isDev = !app.isPackaged

function getBackendPath() {
  if (isDev) return path.join(__dirname, '../backend/index.js')
  // In packaged app, resources are in process.resourcesPath
  return path.join(process.resourcesPath, 'backend/index.js')
}

function getNodePath() {
  if (isDev) return 'node'
  // electron-builder bundles node — use the one bundled with Electron
  return process.execPath.replace('VATOCR.exe', 'node.exe')
}

let backendProcess = null

function startBackend() {
  const backendPath = getBackendPath()
  backendProcess = spawn(getNodePath(), [backendPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      // Output folder: user's Documents/VATOCR
      OUTPUT_DIR: path.join(app.getPath('documents'), 'VATOCR', 'output')
    }
  })
  backendProcess.on('error', (err) => console.error('[Electron] Backend error:', err))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'VATOCR — VAT Invoice Validator',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  startBackend()
  setTimeout(createWindow, isDev ? 1000 : 2000)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 2: Update `backend/sessionManager.js` to respect `OUTPUT_DIR` env var**

Replace the `OUTPUT_DIR` line:

```js
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(process.cwd(), 'output')
```

- [ ] **Step 3: Commit**

```bash
git add electron/main.js backend/sessionManager.js
git commit -m "feat: production-safe paths for Electron packaged app"
```

---

### Task 3: App icon

**Files:**
- Create: `assets/icon.ico`

- [ ] **Step 1: Create or source a 256x256 icon**

Option A — use a placeholder (for testing):
```bash
# Download a free placeholder .ico (replace before final release)
curl -o assets/icon.ico "https://www.google.com/favicon.ico"
```

Option B — create from a PNG using an online converter (https://convertio.co/) and save to `assets/icon.ico`.

> The icon should ideally be 256x256 pixels, ICO format, containing multiple resolutions (16, 32, 48, 256px).

- [ ] **Step 2: Commit**

```bash
git add assets/icon.ico
git commit -m "chore: add app icon"
```

---

### Task 4: Full electron-builder config

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace the `build` key in `package.json` with the final config**

```json
"build": {
  "appId": "com.vatocr.app",
  "productName": "VATOCR",
  "copyright": "Copyright © 2026",
  "directories": {
    "output": "release",
    "buildResources": "assets"
  },
  "files": [
    "dist/**/*",
    "electron/**/*",
    "backend/**/*",
    "node_modules/**/*",
    "package.json"
  ],
  "extraResources": [
    {
      "from": "backend",
      "to": "backend",
      "filter": ["**/*"]
    }
  ],
  "win": {
    "target": "nsis",
    "icon": "assets/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "installerIcon": "assets/icon.ico",
    "uninstallerIcon": "assets/icon.ico",
    "installerHeaderIcon": "assets/icon.ico",
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: finalize electron-builder packaging config"
```

---

### Task 5: Build and test the installer

- [ ] **Step 1: Build the React frontend**

```bash
npm run build
```

Expected: `dist/` folder created with `index.html` and assets.

- [ ] **Step 2: Package with electron-builder**

```bash
npm run pack
```

Expected output in `release/`:
```
release/
├── VATOCR Setup 1.0.0.exe   ← installer
└── win-unpacked/            ← unpacked version for testing
```

> This will take 3–10 minutes the first time as it downloads Electron binaries.

- [ ] **Step 3: Test the unpacked version first (faster)**

```bash
release\win-unpacked\VATOCR.exe
```

Confirm:
- [ ] App window opens with native Windows title bar
- [ ] "VATOCR" title visible
- [ ] Backend connects (ws-status shows Connected)
- [ ] XML upload works
- [ ] Output files save to `Documents/VATOCR/output/`

- [ ] **Step 4: Test the installer**

Double-click `release/VATOCR Setup 1.0.0.exe`:
- [ ] Installer runs, shows VATOCR name and icon
- [ ] Can choose install directory
- [ ] Desktop shortcut created
- [ ] App launches from shortcut
- [ ] All features work

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: app successfully packages to Windows .exe installer"
```

---

### Task 6: Final smoke test checklist

Run through the complete user workflow on the installed app:

- [ ] Launch from desktop shortcut
- [ ] Drop sample XML file → invoice appears
- [ ] Add one invoice manually → appears in queue
- [ ] No duplicates warning with unique invoices
- [ ] Select Step Mode
- [ ] Click Start Processing → CAPTCHA modal appears
- [ ] Enter CAPTCHA → processing continues
- [ ] Step button appears → click to advance
- [ ] Invoice card updates with ✅ Pass (or ❌ status)
- [ ] After all invoices: Download PDF button visible
- [ ] Download XLSX button visible
- [ ] Files appear in `Documents/VATOCR/output/<session-id>/`
- [ ] Close app → reopen → Resume Sessions panel shows previous session
- [ ] Click Resume → queue reloads from `session.json`

- [ ] **Final commit**

```bash
git tag v1.0.0
git commit -m "release: v1.0.0 — VATOCR complete"
```
