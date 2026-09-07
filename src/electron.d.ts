interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  onMaximizeChange: (cb: (maximized: boolean) => void) => void
  removeMaximizeListener: () => void
  onUpdateReady: (cb: (version: string) => void) => void
  onUpdateStatus: (cb: (status: string) => void) => void
  restartAndInstall: () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
