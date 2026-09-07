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
  onUpdateReady: (cb) => {
    ipcRenderer.on('update-ready', (_, version) => cb(version))
  },
  restartAndInstall: () => ipcRenderer.send('restart-and-install'),
})
