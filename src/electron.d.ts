interface ElectronAPI {
  getDragPosition: () => Promise<{ point: { x: number; y: number }; bounds: { x: number; y: number; width: number; height: number } }>
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
  openDirectoryPicker: () => Promise<string | null>
  fs: {
    readdir: (path: string) => Promise<{ name: string; isDirectory: boolean }[]>
    readfile: (path: string) => Promise<string>
    writefile: (path: string, content: string) => Promise<void>
    unlink: (path: string) => Promise<void>
    rename: (oldPath: string, newPath: string) => Promise<void>
    exists: (path: string) => Promise<boolean>
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
