const { app, BrowserWindow } = require('electron')
const path = require('path')

const isDev = !app.isPackaged

function getBackendPath() {
  // __dirname resolves inside app.asar in production, where node_modules also live
  return path.join(__dirname, '../backend/index.js')
}

function showErrorWindow(err) {
  const win = new BrowserWindow({
    width: 680,
    height: 420,
    title: 'VATOCR — Startup Error',
    resizable: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  const detail = encodeURIComponent(
    `Failed to start the background validator service:\n\n${err.stack || err.message}`
  )
  win.loadFile(path.join(__dirname, 'error.html'), { query: { message: decodeURIComponent(detail) } })
  win.setMenu(null)
}

function startBackend() {
  try {
    if (!isDev) {
      process.env.NODE_ENV = 'production'
      process.env.OUTPUT_DIR = path.join(app.getPath('documents'), 'VATOCR', 'output')
    }
    const backendPath = getBackendPath()
    require(backendPath)
  } catch (err) {
    console.error('[Electron] Failed to start backend:', err)
    showErrorWindow(err)
  }
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
  if (process.platform !== 'darwin') app.quit()
})
