const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

const isDev = !app.isPackaged

// Remove default application menu
Menu.setApplicationMenu(null)

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    icon: path.join(__dirname, '../public/icon.png'),
    title: 'Papyrus',
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    const isInternal =
      url.startsWith('http://localhost') ||
      url.startsWith('http://127.0.0.1') ||
      url.startsWith('file://')

    if (!isInternal) {
      shell.openExternal(url)
      return { action: 'deny' }
    }

    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        frame: false,
        icon: path.join(__dirname, '../public/icon.png'),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.cjs'),
        },
      },
    }
  })
}

// All windows: maximize/unmaximize events via IPC
app.on('browser-window-created', (_, win) => {
  win.on('maximize', () => win.webContents.send('maximize-change', true))
  win.on('unmaximize', () => win.webContents.send('maximize-change', false))
})

// IPC: each window controls itself via sender reference
ipcMain.on('window-minimize', e => {
  BrowserWindow.fromWebContents(e.sender)?.minimize()
})
ipcMain.on('window-maximize', e => {
  const w = BrowserWindow.fromWebContents(e.sender)
  if (!w) return
  w.isMaximized() ? w.unmaximize() : w.maximize()
})
ipcMain.on('window-close', e => {
  BrowserWindow.fromWebContents(e.sender)?.close()
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  if (!isDev) {
    function sendToRenderer(channel, data) {
      const win = BrowserWindow.getAllWindows()[0]
      win?.webContents.send(channel, data)
    }

    autoUpdater.autoDownload = false

    autoUpdater.on('update-available', (info) => {
      sendToRenderer('update-available', info.version)
    })
    autoUpdater.on('update-not-available', () => {
      sendToRenderer('update-status', 'not-available')
    })
    autoUpdater.on('download-progress', (p) => {
      sendToRenderer('update-progress', Math.round(p.percent))
    })
    autoUpdater.on('update-downloaded', (info) => {
      sendToRenderer('update-ready', info.version)
    })
    autoUpdater.on('error', (err) => {
      sendToRenderer('update-status', `error: ${err.message}`)
    })

    autoUpdater.checkForUpdates()
  }
})

ipcMain.handle('get-app-version', () => app.getVersion())

ipcMain.on('download-update', () => {
  autoUpdater.downloadUpdate()
})

ipcMain.on('restart-and-install', () => {
  autoUpdater.quitAndInstall(true, true)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
