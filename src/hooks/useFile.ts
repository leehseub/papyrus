import { useState, useCallback } from 'react'
import type { FileNode } from '../types'

export function useFile() {
  const [saving, setSaving] = useState(false)

  const save = useCallback(async (fileNode: FileNode, content: string): Promise<boolean> => {
    setSaving(true)
    try {
      const writable = await fileNode.handle.createWritable()
      await writable.write(content)
      await writable.close()
      return true
    } catch {
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  const rename = useCallback(async (
    fileNode: FileNode,
    content: string,
    newTitle: string,
  ): Promise<FileNode | null> => {
    if (!fileNode.dirHandle) return null
    const newName = newTitle.trim().endsWith('.md') ? newTitle.trim() : `${newTitle.trim()}.md`
    if (newName === fileNode.name) return fileNode
    try {
      const newHandle = await fileNode.dirHandle.getFileHandle(newName, { create: true })
      const writable = await newHandle.createWritable()
      await writable.write(content)
      await writable.close()
      await fileNode.dirHandle.removeEntry(fileNode.name)
      const parentPath = fileNode.path.split('/').slice(0, -1).join('/')
      const newPath = parentPath ? `${parentPath}/${newName}` : newName
      return { ...fileNode, name: newName, path: newPath, handle: newHandle }
    } catch {
      return null
    }
  }, [])

  return { saving, save, rename }
}
