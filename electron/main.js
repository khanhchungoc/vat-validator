const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let backendProcess = null

function startBackend() {
  backendProcess = spawn('node', [path.join(__dirname, '../backend/index.js')], {
    stdio: 'inherit'
  })
  backendProcess.on('error', (err) => {
    console.error('[Electron] Failed to start backend:', err)
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'VATOCR — VAT Invoice Validator',
    webPreferences: {
      nodeIntegration: false, // Security best practice
      contextIsolation: true
    }
  })

  // In development, load from Vite dev server
  const isDev = !app.isPackaged
  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  startBackend()
  
  // Wait a moment for Vite server to be ready before creating window
  setTimeout(createWindow, 1000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
