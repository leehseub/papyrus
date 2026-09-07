const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  onMaximizeChange: (cb) => {
    ipcRenderer.on('maximize-change', (_, maximized) => cb(maximized))
  },
  removeMaximizeListener: () => {
    ipcRenderer.removeAllListeners('maximize-change')
  },
  onUpdateAvailable: (cb) => {
    ipcRenderer.on('update-available', (_, version) => cb(version))
  },
  onUpdateProgress: (cb) => {
    ipcRenderer.on('update-progress', (_, percent) => cb(percent))
  },
  onUpdateReady: (cb) => {
    ipcRenderer.on('update-ready', (_, version) => cb(version))
  },
  onUpdateStatus: (cb) => {
    ipcRenderer.on('update-status', (_, status) => cb(status))
  },
  downloadUpdate: () => ipcRenderer.send('download-update'),
  restartAndInstall: () => ipcRenderer.send('restart-and-install'),
  getVersion: () => ipcRenderer.invoke('get-app-version'),
})
