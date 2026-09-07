interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  onMaximizeChange: (cb: (maximized: boolean) => void) => void
  removeMaximizeListener: () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
