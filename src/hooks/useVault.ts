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

async function requestPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  // queryPermission / requestPermission are File System Access API extensions not yet in TS lib
  const h = handle as FileSystemDirectoryHandle & {
    queryPermission(opts: { mode: string }): Promise<string>
    requestPermission(opts: { mode: string }): Promise<string>
  }
  const perm = await h.queryPermission({ mode: 'readwrite' })
  if (perm === 'granted') return true
  const req = await h.requestPermission({ mode: 'readwrite' })
  return req === 'granted'
}

export function useVault() {
  const [vault, setVault] = useState<FolderNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootHandleRef = useRef<FileSystemDirectoryHandle | null>(null)

  // 앱 시작 시 저장된 vault handle 복원
  useEffect(() => {
    loadVaultHandle().then(async handle => {
      if (!handle) return
      const granted = await requestPermission(handle)
      if (!granted) return
      setLoading(true)
      try {
        rootHandleRef.current = handle
        const children = await buildTree(handle, handle.name)
        setVault({ name: handle.name, path: handle.name, kind: 'directory', handle, children })
      } catch {
        // 복원 실패는 조용히 무시
      } finally {
        setLoading(false)
      }
    }).catch(() => {})
  }, [])

  const openVault = useCallback(async () => {
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

  return { vault, loading, error, openVault, openFile, refreshVault, createFile, deleteFile, updateLinksForRename, moveFile, renameFolder }
}
