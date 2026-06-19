const { app, BrowserWindow, screen } = require('electron')
const path = require('path')
const net = require('net')
const os = require('os')
const { BROWSER_BOUNDS_ENV, buildSplitWindowLayout } = require('../backend/windowLayout')

const isDev = !app.isPackaged

// Ensure only one instance runs — a second launch focuses the existing window
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

/** Ask the OS for a free TCP port by binding to port 0, then releasing it. */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close((err) => (err ? reject(err) : resolve(port)))
    })
    srv.on('error', reject)
  })
}

function getBackendPath() {
  // __dirname resolves inside app.asar in production, where node_modules also live
  return path.join(__dirname, '../backend/index.js')
}

function showErrorWindow(err) {
  const win = new BrowserWindow({
    width: 680,
    height: 420,
    title: 'VAT-validator — Startup Error',
    resizable: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  win.loadFile(path.join(__dirname, 'error.html'), {
    query: { message: `Failed to start the background validator service:\n\n${err.stack || err.message}` }
  })
  win.setMenu(null)
}

function startBackend(port, browserBounds) {
  try {
    process.env.BACKEND_PORT = String(port)
    if (browserBounds) {
      process.env[BROWSER_BOUNDS_ENV] = JSON.stringify(browserBounds)
    }
    if (!isDev) {
      process.env.NODE_ENV = 'production'
      process.env.OUTPUT_DIR = path.join(app.getPath('documents'), 'VAT-validator', 'output')
      // Tell Playwright where to find its Chromium browser in the packaged app.
      // Uses os.homedir() for reliability across all Windows configurations.
      if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
        process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
          os.homedir(), 'AppData', 'Local', 'ms-playwright'
        )
      }
    }
    require(getBackendPath())
  } catch (err) {
    console.error('[Electron] Failed to start backend:', err)
    showErrorWindow(err)
  }
}

function getSplitWindowLayout() {
  return buildSplitWindowLayout(screen.getPrimaryDisplay().workArea)
}

function createWindow(port, appBounds) {
  const bounds = appBounds || getSplitWindowLayout().appBounds
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: Math.min(960, bounds.width),
    minHeight: Math.min(600, bounds.height),
    title: 'VAT-validator — VAT Invoice Validator',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Pass the dynamically chosen port to the renderer via URL query param
    win.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { port: String(port) }
    })
  }
}

app.whenReady().then(async () => {
  // Catch async errors that bypass try-catch and route them to the custom error window
  process.on('uncaughtException', (err) => {
    console.error('[Electron] Uncaught exception:', err)
    showErrorWindow(err)
  })

  // Find a guaranteed-free port before starting the backend
  let port
  try {
    port = isDev ? 3001 : await findFreePort()
    console.log(`[Electron] Using backend port: ${port}`)
  } catch (err) {
    showErrorWindow(new Error(`Could not find a free port: ${err.message}`))
    return
  }

  const windowLayout = getSplitWindowLayout()
  startBackend(port, windowLayout.browserBounds)
  setTimeout(() => createWindow(port, windowLayout.appBounds), isDev ? 1000 : 2000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port, getSplitWindowLayout().appBounds)
    }
  })

  // Focus existing window if a second instance tries to launch
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) { if (win.isMinimized()) win.restore(); win.focus() }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
