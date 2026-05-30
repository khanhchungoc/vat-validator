const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')

const isDev = !app.isPackaged

function getBackendPath() {
  if (isDev) return path.join(__dirname, '../backend/index.js')
  return path.join(process.resourcesPath, 'backend/index.js')
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
    if (!isDev) {
      dialog.showErrorBox(
        'Backend Validator Service Failure',
        `Failed to start the background validator service:\n${err.message}\n\nPlease try reinstalling.`
      )
    }
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
