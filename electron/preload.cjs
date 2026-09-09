const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getDragPosition: () => ipcRenderer.invoke('graph-drag-position'),
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
  getPendingUpdate: () => ipcRenderer.invoke('get-pending-update'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  restartAndInstall: () => ipcRenderer.send('restart-and-install'),
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  openDirectoryPicker: () => ipcRenderer.invoke('open-directory-picker'),
  fs: {
    readdir: (p) => ipcRenderer.invoke('fs-readdir', p),
    readfile: (p) => ipcRenderer.invoke('fs-readfile', p),
    writefile: (p, content) => ipcRenderer.invoke('fs-writefile', p, content),
    unlink: (p) => ipcRenderer.invoke('fs-unlink', p),
    rename: (oldPath, newPath) => ipcRenderer.invoke('fs-rename', oldPath, newPath),
    exists: (p) => ipcRenderer.invoke('fs-exists', p),
  },
})
