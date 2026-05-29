const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

const isDev = !app.isPackaged

function getBackendPath() {
  if (isDev) return path.join(__dirname, '../backend/index.js')
  return path.join(process.resourcesPath, 'backend/index.js')
}

function getNodePath() {
  if (isDev) return 'node'
  return path.join(path.dirname(process.execPath), 'node.exe')
}

let backendProcess = null

function startBackend() {
  const backendPath = getBackendPath()
  backendProcess = spawn(getNodePath(), [backendPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      OUTPUT_DIR: path.join(app.getPath('documents'), 'VATOCR', 'output')
    }
  })
  backendProcess.on('error', (err) => {
    console.error('[Electron] Backend error:', err)
    if (!isDev) {
      dialog.showErrorBox(
        'Backend Validator Service Failure',
        `Failed to start the background validator service:\n${err.message}\n\nPlease try reinstalling or running the application as Administrator.`
      )
    }
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

process.on('exit', () => {
  if (backendProcess) backendProcess.kill()
})
