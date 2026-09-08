import { remapGraphPath } from '../lib/graphPaths'
import { useState, useCallback, useEffect } from 'react'

export interface GroupLink {
  id: string
  fromId: string        // 항상 그룹 id
  toType: 'group' | 'node'
  toId: string          // 그룹 id 또는 파일 path
}

const KEY = 'papyrus-group-links'

function load(): GroupLink[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
function persist(links: GroupLink[]) {
  localStorage.setItem(KEY, JSON.stringify(links))
}

export function useGroupLinks() {
  const [groupLinks, setGroupLinks] = useState<GroupLink[]>(load)

  useEffect(() => {
    const fn = (e: StorageEvent) => { if (e.key === KEY) setGroupLinks(load()) }
    window.addEventListener('storage', fn)
    return () => window.removeEventListener('storage', fn)
  }, [])

  const createGroupLink = useCallback((fromId: string, toType: 'group' | 'node', toId: string) => {
    if (fromId === toId) return
    const current = load()
    if (current.some(l => l.fromId === fromId && l.toType === toType && l.toId === toId)) return
    const link: GroupLink = { id: `${Date.now()}`, fromId, toType, toId }
    const updated = [...current, link]
    persist(updated)
    setGroupLinks(updated)
  }, [])

  const deleteGroupLink = useCallback((id: string) => {
    const updated = load().filter(l => l.id !== id)
    persist(updated)
    setGroupLinks(updated)
  }, [])

  const remapPaths = useCallback((oldPath: string, newPath: string) => {
    const current = load()
    let changed = false
    const updated = current.map(link => {
      if (link.toType !== 'node') return link
      const toId = remapGraphPath(link.toId, oldPath, newPath)
      if (toId === link.toId) return link
      changed = true
      return { ...link, toId }
    })
    if (changed) { persist(updated); setGroupLinks(updated) }
  }, [])

  return { groupLinks, createGroupLink, deleteGroupLink, remapPaths }
}
