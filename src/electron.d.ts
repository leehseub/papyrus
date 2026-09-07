interface ElectronAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  onMaximizeChange: (cb: (maximized: boolean) => void) => void
  removeMaximizeListener: () => void
  onUpdateAvailable: (cb: (version: string) => void) => void
  onUpdateProgress: (cb: (percent: number) => void) => void
  onUpdateReady: (cb: (version: string) => void) => void
  onUpdateStatus: (cb: (status: string) => void) => void
  downloadUpdate: () => void
  restartAndInstall: () => void
  getVersion: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
