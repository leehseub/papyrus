import { useState, useCallback } from 'react'
import type { FileNode } from '../types'

export interface Tab {
  file: FileNode
  content: string      // current working content (may have unsaved changes)
  savedContent: string // content as last saved to disk
}

interface TabsState {
  tabs: Tab[]
  activeIdx: number
}

export function useTabs() {
  const [state, setState] = useState<TabsState>({ tabs: [], activeIdx: -1 })

  const openTab = useCallback((file: FileNode, content: string) => {
    setState(prev => {
      const existingIdx = prev.tabs.findIndex(t => t.file.path === file.path)
      if (existingIdx >= 0) return { ...prev, activeIdx: existingIdx }
      return {
        tabs: [...prev.tabs, { file, content, savedContent: content }],
        activeIdx: prev.tabs.length,
      }
    })
  }, [])

  const switchTab = useCallback((idx: number) => {
    setState(prev => ({ ...prev, activeIdx: idx }))
  }, [])

  const closeTab = useCallback((idx: number) => {
    setState(prev => {
      const next = prev.tabs.filter((_, i) => i !== idx)
      let newActiveIdx = prev.activeIdx
      if (next.length === 0) newActiveIdx = -1
      else if (prev.activeIdx === idx) newActiveIdx = Math.max(0, idx - 1)
      else if (prev.activeIdx > idx) newActiveIdx = prev.activeIdx - 1
      return { tabs: next, activeIdx: newActiveIdx }
    })
  }, [])

  const updateTabContent = useCallback((idx: number, content: string) => {
    setState(prev => {
      if (idx < 0 || idx >= prev.tabs.length) return prev
      const tabs = [...prev.tabs]
      tabs[idx] = { ...tabs[idx], content }
      return { ...prev, tabs }
    })
  }, [])

  const markSaved = useCallback((idx: number, content: string) => {
    setState(prev => {
      if (idx < 0 || idx >= prev.tabs.length) return prev
      const tabs = [...prev.tabs]
      tabs[idx] = { ...tabs[idx], content, savedContent: content }
      return { ...prev, tabs }
    })
  }, [])

  const clearTabs = useCallback(() => {
    setState({ tabs: [], activeIdx: -1 })
  }, [])

  const closePaths = useCallback((paths: Set<string>) => {
    setState(prev => {
      const nextTabs = prev.tabs.filter(t => !paths.has(t.file.path))
      const removedBefore = prev.tabs.slice(0, prev.activeIdx).filter(t => paths.has(t.file.path)).length
      let newActiveIdx = prev.activeIdx - removedBefore
      if (nextTabs.length === 0) newActiveIdx = -1
      else if (newActiveIdx >= nextTabs.length) newActiveIdx = nextTabs.length - 1
      return { tabs: nextTabs, activeIdx: Math.max(-1, newActiveIdx) }
    })
  }, [])

  const updateTabFile = useCallback((idx: number, file: FileNode) => {
    setState(prev => {
      if (idx < 0 || idx >= prev.tabs.length) return prev
      const tabs = [...prev.tabs]
      tabs[idx] = { ...tabs[idx], file }
      return { ...prev, tabs }
    })
  }, [])

  const activeTab =
    state.activeIdx >= 0 && state.activeIdx < state.tabs.length
      ? state.tabs[state.activeIdx]
      : null

  return {
    tabs: state.tabs,
    activeIdx: state.activeIdx,
    activeTab,
    openTab,
    switchTab,
    closeTab,
    clearTabs,
    closePaths,
    updateTabContent,
    markSaved,
    updateTabFile,
  }
}
