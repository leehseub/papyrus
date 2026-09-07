import { useState, useCallback, useRef, useEffect } from 'react'
import type { FolderNode, FileNode } from '../types'
import { saveVaultHandle, loadVaultHandle } from '../lib/vaultStorage'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** content 안의 [[name]] / \[\[name\]\] 를 newName으로 교체 */
function replaceWikilinks(content: string, oldName: string, newName: string): string {
  const e = escapeRegex(oldName)
  // tiptap-markdown이 저장한 이스케이프 형식: \[\[oldName\]\]
  const escapedResult = content.replace(
    new RegExp(`\\\\\\[\\\\\\[${e}\\\\\\]\\\\\\]`, 'g'),
    `\\[\\[${newName}\\]\\]`
  )
  // 일반 형식: [[oldName]]
  return escapedResult.replace(
    new RegExp(`\\[\\[${e}\\]\\]`, 'g'),
    `[[${newName}]]`
  )
}

function flattenFiles(nodes: (FileNode | FolderNode)[]): FileNode[] {
  const files: FileNode[] = []
  for (const node of nodes) {
    if (node.kind === 'file') files.push(node)
    else files.push(...flattenFiles((node as FolderNode).children))
  }
  return files
}

async function buildTree(
  dirHandle: FileSystemDirectoryHandle,
  path: string
): Promise<(FileNode | FolderNode)[]> {
  const entries: FileSystemHandle[] = []
  for await (const entry of dirHandle.values()) {
    entries.push(entry)
  }

  const results = await Promise.all(
    entries.map(async (entry): Promise<FileNode | FolderNode | null> => {
      const entryPath = `${path}/${entry.name}`

      if (entry.kind === 'directory') {
        const subHandle = await dirHandle.getDirectoryHandle(entry.name)
        const subChildren = await buildTree(subHandle, entryPath)
        return { name: entry.name, path: entryPath, kind: 'directory', handle: subHandle, children: subChildren }
      } else if (entry.kind === 'file' && entry.name.endsWith('.md')) {
        const fileHandle = await dirHandle.getFileHandle(entry.name)
        return { name: entry.name, path: entryPath, kind: 'file', handle: fileHandle, dirHandle }
      }
      return null
    })
  )

  const children = results.filter((n): n is FileNode | FolderNode => n !== null)
  children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return children
}


// ─── Electron IPC 기반 가짜 핸들 ────────────────────────────────────────────
// Electron에서는 File System Access API 권한이 재시작 시 초기화되므로
// Node.js fs(IPC)를 통해 실제 파일 작업을 수행하는 핸들 객체를 만들어
// 기존 코드(buildTree, useFile 등)가 변경 없이 동작하게 한다.

type FsApi = NonNullable<Window['electronAPI']>['fs']

function createFakeFileHandle(absPath: string, api: FsApi): FileSystemFileHandle {
  const name = absPath.replace(/\\/g, '/').split('/').pop()!
  return {
    kind: 'file',
    name,
    isSameEntry: async () => false,
    getFile: async () => {
      const content = await api.readfile(absPath)
      return new File([content], name, { type: 'text/markdown' })
    },
    createWritable: async () => {
      let _data = ''
      return {
        write: async (chunk: unknown) => {
          if (typeof chunk === 'string') _data = chunk
          else if (chunk instanceof Blob) _data = await chunk.text()
        },
        close: async () => { await api.writefile(absPath, _data) },
        abort: async () => {},
      } as unknown as FileSystemWritableFileStream
    },
  } as unknown as FileSystemFileHandle
}

function createFakeDirHandle(absPath: string, api: FsApi): FileSystemDirectoryHandle {
  const norm = absPath.replace(/\\/g, '/')
  const name = norm.split('/').pop()!
  return {
    kind: 'directory',
    name,
    isSameEntry: async () => false,
    values: async function* () {
      const entries = await api.readdir(norm)
      for (const e of entries) {
        yield { kind: e.isDirectory ? 'directory' : 'file', name: e.name } as FileSystemHandle
      }
    },
    getFileHandle: async (fname: string, opts?: { create?: boolean }) => {
      const fp = `${norm}/${fname}`
      if (opts?.create) await api.writefile(fp, '')
      return createFakeFileHandle(fp, api)
    },
    getDirectoryHandle: async (dname: string) => createFakeDirHandle(`${norm}/${dname}`, api),
    removeEntry: async (ename: string) => { await api.unlink(`${norm}/${ename}`) },
    // Chrome 독자 확장 — 폴더 rename 에 사용
    move: async (newName: string) => {
      const parent = norm.split('/').slice(0, -1).join('/')
      await api.rename(norm, `${parent}/${newName}`)
    },
  } as unknown as FileSystemDirectoryHandle
}
// ─────────────────────────────────────────────────────────────────────────────

export function useVault() {
  const [vault, setVault] = useState<FolderNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootHandleRef = useRef<FileSystemDirectoryHandle | null>(null)
  // 권한 재확인이 필요한 handle (유저 제스처 필요 → 버튼으로 처리)
  const [pendingHandle, setPendingHandle] = useState<FileSystemDirectoryHandle | null>(null)

  async function mountVault(handle: FileSystemDirectoryHandle) {
    setLoading(true)
    try {
      rootHandleRef.current = handle
      const children = await buildTree(handle, handle.name)
      setVault({ name: handle.name, path: handle.name, kind: 'directory', handle, children })
      setPendingHandle(null)
    } catch {
      // 복원 실패는 조용히 무시
    } finally {
      setLoading(false)
    }
  }

  // Electron IPC 경로 기반 마운트 (권한 불필요)
  async function mountVaultFromPath(absPath: string) {
    const api = window.electronAPI?.fs
    if (!api) return
    setLoading(true)
    try {
      const norm = absPath.replace(/\\/g, '/')
      const vaultName = norm.split('/').pop()!
      const fakeHandle = createFakeDirHandle(norm, api)
      const children = await buildTree(fakeHandle, vaultName)
      rootHandleRef.current = fakeHandle
      setVault({ name: vaultName, path: vaultName, kind: 'directory', handle: fakeHandle, children })
      setPendingHandle(null)
    } catch {
      localStorage.removeItem('papyrus-vault-path')
    } finally {
      setLoading(false)
    }
  }

  // 앱 시작 시 저장된 vault 복원
  useEffect(() => {
    async function tryRestore() {
      // Electron: localStorage에 절대 경로가 있으면 IPC로 바로 마운트 (권한 불필요)
      if (window.electronAPI?.fs) {
        const savedPath = localStorage.getItem('papyrus-vault-path')
        if (savedPath) {
          const exists = await window.electronAPI.fs.exists(savedPath)
          if (exists) { await mountVaultFromPath(savedPath); return }
          localStorage.removeItem('papyrus-vault-path')
        }
      }

      // 폴백: File System Access API handle (브라우저 / 첫 실행)
      const handle = await loadVaultHandle()
      if (!handle) return
      const h = handle as FileSystemDirectoryHandle & {
        queryPermission(opts: { mode: string }): Promise<string>
        requestPermission(opts: { mode: string }): Promise<string>
      }
      let perm = await h.queryPermission({ mode: 'readwrite' })
      if (perm !== 'granted') {
        try { perm = await h.requestPermission({ mode: 'readwrite' }) } catch {}
      }
      if (perm === 'granted') await mountVault(handle)
      else setPendingHandle(handle)
    }
    tryRestore().catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 재연결 버튼 클릭 핸들러
  const reconnectVault = useCallback(async () => {
    // Electron: IPC 다이얼로그로 폴더 재선택 → 경로 저장 → 이후 자동 복원
    if (window.electronAPI?.openDirectoryPicker) {
      const dirPath = await window.electronAPI.openDirectoryPicker()
      if (!dirPath) return
      const norm = dirPath.replace(/\\/g, '/')
      localStorage.setItem('papyrus-vault-path', norm)
      await mountVaultFromPath(norm)
      return
    }

    // 브라우저: requestPermission (유저 제스처 필요)
    if (!pendingHandle) return
    const h = pendingHandle as FileSystemDirectoryHandle & {
      requestPermission(opts: { mode: string }): Promise<string>
    }
    try {
      const req = await h.requestPermission({ mode: 'readwrite' })
      if (req === 'granted') await mountVault(pendingHandle)
      else setPendingHandle(null)
    } catch {
      setPendingHandle(null)
    }
  }, [pendingHandle])

  const openVault = useCallback(async () => {
    // Electron: 네이티브 다이얼로그로 절대 경로 획득 → localStorage에 저장 → IPC 마운트
    if (window.electronAPI?.openDirectoryPicker) {
      const dirPath = await window.electronAPI.openDirectoryPicker()
      if (!dirPath) return
      const norm = dirPath.replace(/\\/g, '/')
      localStorage.setItem('papyrus-vault-path', norm)
      await mountVaultFromPath(norm)
      return
    }

    // 브라우저: File System Access API
    try {
      setLoading(true)
      setError(null)
      const dirHandle = await (window as unknown as { showDirectoryPicker(opts?: { mode?: string }): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'readwrite' })
      rootHandleRef.current = dirHandle
      const children = await buildTree(dirHandle, dirHandle.name)
      setVault({ name: dirHandle.name, path: dirHandle.name, kind: 'directory', handle: dirHandle, children })
      await saveVaultHandle(dirHandle)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Vault를 열지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshVault = useCallback(async () => {
    const dirHandle = rootHandleRef.current
    if (!dirHandle) return
    try {
      setLoading(true)
      const children = await buildTree(dirHandle, dirHandle.name)
      setVault(prev => prev ? { ...prev, children } : null)
    } finally {
      setLoading(false)
    }
  }, [])

  const createFile = useCallback(async (): Promise<FileNode | null> => {
    const dirHandle = rootHandleRef.current
    if (!dirHandle) return null

    // "Untitled.md", "Untitled 2.md" ... 순서로 고유 이름 생성
    let filename = 'Untitled.md'
    let counter = 2
    while (true) {
      try {
        await dirHandle.getFileHandle(filename, { create: false })
        filename = `Untitled ${counter++}.md`
      } catch {
        break
      }
    }

    try {
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(`# ${filename.replace(/\.md$/, '')}\n`)
      await writable.close()
      await refreshVault()
      return { name: filename, path: `${dirHandle.name}/${filename}`, kind: 'file', handle: fileHandle, dirHandle }
    } catch {
      return null
    }
  }, [refreshVault])

  const openFile = useCallback(async () => {
    localStorage.removeItem('papyrus-vault-path')
    try {
      setLoading(true)
      setError(null)
      const [fileHandle] = await (window as unknown as { showOpenFilePicker(opts?: object): Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
        types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
        multiple: false,
      })
      const fileNode: FileNode = { name: fileHandle.name, path: fileHandle.name, kind: 'file', handle: fileHandle, dirHandle: null }
      rootHandleRef.current = null
      setVault({ name: '열린 파일', path: '', kind: 'directory', handle: null as unknown as FileSystemDirectoryHandle, children: [fileNode] })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('파일을 열지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 파일 rename 후 vault 전체에서 해당 파일을 가리키는 wikilink를 새 이름으로 업데이트
   * oldBaseName / newBaseName: .md 확장자 없는 파일 기본 이름
   */
  const updateLinksForRename = useCallback(async (oldBaseName: string, newBaseName: string) => {
    const files = flattenFiles(vault?.children ?? [])
    await Promise.all(files.map(async (file) => {
      try {
        const f = await file.handle.getFile()
        const content = await f.text()
        // .md 포함/미포함 두 형태 모두 교체
        let updated = replaceWikilinks(content, oldBaseName, newBaseName)
        updated = replaceWikilinks(updated, `${oldBaseName}.md`, `${newBaseName}.md`)
        if (updated === content) return
        const writable = await file.handle.createWritable()
        await writable.write(updated)
        await writable.close()
      } catch { /* 삭제된 파일 등 무시 */ }
    }))
  }, [vault])

  const deleteFile = useCallback(async (file: FileNode): Promise<boolean> => {
    if (!file.dirHandle) return false
    try {
      await file.dirHandle.removeEntry(file.name)
      await refreshVault()
      return true
    } catch {
      return false
    }
  }, [refreshVault])


  const moveFile = useCallback(async (
    file: FileNode,
    targetDirHandle: FileSystemDirectoryHandle,
    targetPath: string
  ): Promise<FileNode | null> => {
    if (!file.dirHandle) return null
    try {
      try {
        await targetDirHandle.getFileHandle(file.name, { create: false })
        return null // duplicate filename — caller handles error display
      } catch { /* not exists — ok */ }

      const f = await file.handle.getFile()
      const text = await f.text()
      const newHandle = await targetDirHandle.getFileHandle(file.name, { create: true })
      const writable = await newHandle.createWritable()
      await writable.write(text)
      await writable.close()
      await file.dirHandle.removeEntry(file.name)

      // path 기반 wikilink 업데이트: [[folder/file]] → [[newFolder/file]]
      // 파일명은 동일하므로 경로가 바뀐 경우만 처리
      const oldWikiPath = file.path.replace(/\.md$/, '').split('/').slice(1).join('/')
      const newWikiPath = `${targetPath}/${file.name}`.replace(/\.md$/, '').split('/').slice(1).join('/')
      if (oldWikiPath !== newWikiPath) {
        const allFiles = flattenFiles(vault?.children ?? [])
        await Promise.all(allFiles.map(async (other) => {
          if (other.handle === file.handle) return
          try {
            const otherF = await other.handle.getFile()
            const otherText = await otherF.text()
            const updated = replaceWikilinks(otherText, oldWikiPath, newWikiPath)
            if (updated === otherText) return
            const w = await other.handle.createWritable()
            await w.write(updated)
            await w.close()
          } catch { /* 무시 */ }
        }))
      }

      await refreshVault()
      return { name: file.name, path: `${targetPath}/${file.name}`, kind: 'file', handle: newHandle, dirHandle: targetDirHandle }
    } catch {
      return null
    }
  }, [refreshVault, vault])

  const renameFolder = useCallback(async (folder: FolderNode, newName: string): Promise<boolean> => {
    const handle = folder.handle as unknown as Record<string, unknown>
    if (!('move' in handle) || typeof handle.move !== 'function') return false
    try {
      await (handle.move as (name: string) => Promise<void>)(newName)
      await refreshVault()
      return true
    } catch {
      return false
    }
  }, [refreshVault])

  return { vault, loading, error, pendingHandle, reconnectVault, openVault, openFile, refreshVault, createFile, deleteFile, updateLinksForRename, moveFile, renameFolder }
}
