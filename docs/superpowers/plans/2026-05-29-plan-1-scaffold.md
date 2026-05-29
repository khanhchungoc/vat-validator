# VATOCR — Plan 1: Project Scaffold

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the complete Electron + Vite/React frontend + Node.js/Express backend project structure with working WebSocket communication.

**Architecture:** Electron hosts a Node.js backend (Express + WebSocket server) as a child process and loads the Vite/React frontend in its BrowserWindow. During development, the frontend runs on Vite's dev server; in production it's served from the built `dist/` folder.

**Tech Stack:** Electron, electron-builder, Vite, React, Node.js, Express, `ws` (WebSocket library)

---

## File Structure

```
VATOCR/
├── electron/
│   └── main.js              # Electron entry point — creates window, spawns backend
├── backend/
│   ├── index.js             # Express + WebSocket server entry point
│   └── wsHandler.js         # WebSocket message router
├── src/                     # React frontend (Vite)
│   ├── main.jsx             # React entry
│   ├── App.jsx              # Root component
│   ├── useWebSocket.js      # WebSocket hook (connect, send, receive)
│   └── index.css            # Global styles (glassmorphism base)
├── package.json             # Root package (Electron + scripts)
├── vite.config.js           # Vite config
└── .gitignore
```

---

### Task 1: Initialise git and project root

**Files:**
- Create: `.gitignore`
- Create: `package.json`

- [ ] **Step 1: Initialise git**

```bash
git init
```

Expected: `Initialized empty Git repository`

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
out/
.vite/
output/
.superpowers/
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "vatocr",
  "version": "1.0.0",
  "description": "VAT Invoice Validation Desktop App",
  "main": "electron/main.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\" \"npm run dev:electron\"",
    "dev:frontend": "vite",
    "dev:backend": "node backend/index.js",
    "dev:electron": "wait-on http://localhost:5173 && electron .",
    "build": "vite build",
    "pack": "npm run build && electron-builder"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore package.json
git commit -m "chore: initialise project"
```

---

### Task 2: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install all dependencies**

```bash
npm install --save-dev electron electron-builder vite @vitejs/plugin-react concurrently wait-on
npm install react react-dom express ws
```

- [ ] **Step 2: Verify install succeeded**

```bash
node -e "require('electron'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install dependencies"
```

---

### Task 3: Vite + React frontend scaffold

**Files:**
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/index.css`

- [ ] **Step 1: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: 'dist' }
})
```

- [ ] **Step 2: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VATOCR — VAT Invoice Validator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 4: Create `src/App.jsx`**

```jsx
export default function App() {
  return (
    <div className="app">
      <h1>VATOCR</h1>
      <p>VAT Invoice Validator</p>
    </div>
  )
}
```

- [ ] **Step 5: Create `src/index.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0f0c29;
  --bg2: #302b63;
  --bg3: #24243e;
  --accent: #6c63ff;
  --accent2: #48cfad;
  --text: #f0f0f0;
  --text-muted: #a0a0c0;
  --glass: rgba(255,255,255,0.07);
  --glass-border: rgba(255,255,255,0.12);
  --radius: 12px;
  --pass: #28c840;
  --fail: #ff5f57;
  --skip: #febc2e;
}

body {
  font-family: 'Inter', sans-serif;
  background: linear-gradient(135deg, var(--bg), var(--bg2), var(--bg3));
  min-height: 100vh;
  color: var(--text);
}

.app { padding: 32px; }
```

- [ ] **Step 6: Run frontend and verify**

```bash
npm run dev:frontend
```

Open `http://localhost:5173` — expect to see "VATOCR" heading on dark glassmorphism background.

- [ ] **Step 7: Commit**

```bash
git add vite.config.js index.html src/
git commit -m "feat: scaffold React frontend with glassmorphism base styles"
```

---

### Task 4: Node.js/Express + WebSocket backend

**Files:**
- Create: `backend/index.js`
- Create: `backend/wsHandler.js`

- [ ] **Step 1: Create `backend/index.js`**

```js
const express = require('express')
const http = require('http')
const { WebSocketServer } = require('ws')
const { handleMessage } = require('./wsHandler')

const PORT = 3001
const app = express()
app.use(express.json())

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }))

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  console.log('[WS] Client connected')
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data)
      handleMessage(ws, msg, wss)
    } catch (e) {
      console.error('[WS] Bad message:', e.message)
    }
  })
  ws.on('close', () => console.log('[WS] Client disconnected'))
})

server.listen(PORT, () => {
  console.log(`[Backend] Running on http://localhost:${PORT}`)
})

module.exports = { app, wss }
```

- [ ] **Step 2: Create `backend/wsHandler.js`**

```js
// Central WebSocket message router
// msg shape: { type: string, payload: any }

function handleMessage(ws, msg, wss) {
  console.log('[WS] Received:', msg.type)
  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }))
      break
    default:
      console.warn('[WS] Unknown message type:', msg.type)
  }
}

// Broadcast to all connected clients
function broadcast(wss, msg) {
  const data = JSON.stringify(msg)
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(data)
  })
}

module.exports = { handleMessage, broadcast }
```

- [ ] **Step 3: Start backend and verify health endpoint**

```bash
node backend/index.js
```

In another terminal:
```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "feat: Express + WebSocket backend skeleton"
```

---

### Task 5: WebSocket hook in React frontend

**Files:**
- Create: `src/useWebSocket.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create `src/useWebSocket.js`**

```js
import { useEffect, useRef, useCallback } from 'react'

const WS_URL = 'ws://localhost:3001'

export function useWebSocket(onMessage) {
  const ws = useRef(null)

  useEffect(() => {
    const socket = new WebSocket(WS_URL)
    ws.current = socket

    socket.onopen = () => {
      console.log('[WS] Connected')
      socket.send(JSON.stringify({ type: 'ping' }))
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        onMessage(msg)
      } catch (e) {
        console.error('[WS] Parse error:', e)
      }
    }

    socket.onclose = () => console.log('[WS] Disconnected')
    socket.onerror = (e) => console.error('[WS] Error:', e)

    return () => socket.close()
  }, [])

  const send = useCallback((msg) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg))
    }
  }, [])

  return { send }
}
```

- [ ] **Step 2: Update `src/App.jsx` to test WebSocket**

```jsx
import { useState } from 'react'
import { useWebSocket } from './useWebSocket'

export default function App() {
  const [status, setStatus] = useState('Connecting...')

  const { send } = useWebSocket((msg) => {
    if (msg.type === 'pong') setStatus('Backend connected ✅')
  })

  return (
    <div className="app">
      <h1>VATOCR</h1>
      <p>VAT Invoice Validator</p>
      <p style={{ color: 'var(--accent2)', marginTop: 16 }}>{status}</p>
    </div>
  )
}
```

- [ ] **Step 3: Run both and verify connection**

In two terminals:
```bash
node backend/index.js
npm run dev:frontend
```

Open `http://localhost:5173` — expect to see "Backend connected ✅" within 1 second.

- [ ] **Step 4: Commit**

```bash
git add src/useWebSocket.js src/App.jsx
git commit -m "feat: WebSocket hook connects frontend to backend"
```

---

### Task 6: Electron main process

**Files:**
- Create: `electron/main.js`

- [ ] **Step 1: Create `electron/main.js`**

```js
const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

const isDev = process.env.NODE_ENV !== 'production'
let backendProcess = null

function startBackend() {
  backendProcess = spawn('node', [path.join(__dirname, '../backend/index.js')], {
    stdio: 'inherit',
    env: { ...process.env }
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
  // Give backend 1s to start before opening window
  setTimeout(createWindow, 1000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 2: Run full dev stack**

```bash
npm run dev
```

Expected: Electron window opens showing "VATOCR" with "Backend connected ✅". Check DevTools console for no errors.

- [ ] **Step 3: Commit**

```bash
git add electron/main.js
git commit -m "feat: Electron main process spawns backend and opens React window"
```

---

### Task 7: electron-builder config

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add build config to `package.json`**

Add this top-level key to `package.json`:

```json
"build": {
  "appId": "com.vatocr.app",
  "productName": "VATOCR",
  "directories": { "output": "release" },
  "files": [
    "dist/**",
    "electron/**",
    "backend/**",
    "node_modules/**",
    "package.json"
  ],
  "win": {
    "target": "nsis",
    "icon": "assets/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  },
  "extraResources": [
    { "from": "node_modules/playwright", "to": "playwright" }
  ]
}
```

- [ ] **Step 2: Create placeholder icon directory**

```bash
mkdir assets
```

Add a placeholder `assets/icon.ico` (can be any valid .ico for now — replace before final release).

- [ ] **Step 3: Commit**

```bash
git add package.json assets/
git commit -m "chore: add electron-builder config for Windows .exe packaging"
```
