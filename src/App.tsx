import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { TitleBar } from './components/TitleBar/TitleBar'
import { useTheme } from './hooks/useTheme'
import { useLocale, type Locale } from './hooks/useLocale'
import { useVault } from './hooks/useVault'
import { useSidebarResize } from './hooks/useSidebarResize'
import { useFile } from './hooks/useFile'
import { useTabs } from './hooks/useTabs'
import { useSearch } from './hooks/useSearch'
import { useTagIndex } from './hooks/useTagIndex'
import { useGraphData } from './hooks/useGraphData'
import type { GraphData, GraphNode } from './hooks/useGraphData'
import { useGroups } from './hooks/useGroups'
import { useGroupLinks } from './hooks/useGroupLinks'
import { FileTree, getDraggedFileNode } from './components/FileTree/FileTree'
import { TabBar } from './components/TabBar/TabBar'
import { Search } from './components/Search/Search'
import { TagPanel } from './components/TagPanel/TagPanel'
import { Editor } from './components/Editor/Editor'
import { GraphView } from './components/GraphView/GraphView'
import type { GraphViewHandle, NodePositions } from './components/GraphView/GraphView'
import type { FileNode, FSNode, FolderNode } from './types'
import './App.css'

function flattenFiles(nodes: FSNode[]): FileNode[] {
  const files: FileNode[] = []
  for (const node of nodes) {
    if (node.kind === 'file') files.push(node)
    else files.push(...flattenFiles((node as FolderNode).children))
  }
  return files
}

function serializeGraphData(gd: GraphData) {
  return {
    nodes: gd.nodes.map(n => ({ id: n.id, name: n.name })),
    edges: gd.edges.map(e => ({
      source: typeof e.source === 'string' ? e.source : (e.source as GraphNode).id,
      target: typeof e.target === 'string' ? e.target : (e.target as GraphNode).id,
    })),
  }
}

function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const { locale, setLocale } = useLocale()
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const langMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!langMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [langMenuOpen])
  const { vault, loading, error, openVault, openFile, refreshVault, createFile, deleteFile, updateLinksForRename, moveFile, renameFolder } = useVault()
  const { width, isOpen, isResizing, toggle, onResizerMouseDown } = useSidebarResize()
  const { saving, save, rename } = useFile()
  const { tabs, activeIdx, activeTab, openTab, switchTab, closeTab, clearTabs, closePaths, updateTabContent, markSaved, updateTabFile } = useTabs()

  // selectedFile is derived from the active tab
  const selectedFile = activeTab?.file ?? null

  const [sidebarMode, setSidebarMode] = useState<'tree' | 'search' | 'tags'>('tree')
  const { query, setQuery, results, searching, clear } = useSearch(vault?.children ?? [])
  const { tagMap, indexing, buildIndex } = useTagIndex(vault?.children ?? [])
  const { graphData, building: buildingGraph, buildGraph } = useGraphData(vault?.children ?? [])
  const { groups, createGroup, deleteGroup } = useGroups()
  const { groupLinks, createGroupLink, deleteGroupLink } = useGroupLinks()
  const [showGraph, setShowGraph] = useState(false)
  const showGraphRef = useRef(showGraph)
  showGraphRef.current = showGraph

  const [graphWindowOpen, setGraphWindowOpen] = useState(false)
  const graphWindowOpenRef = useRef(graphWindowOpen)
  graphWindowOpenRef.current = graphWindowOpen

  const themeRef = useRef(theme)
  themeRef.current = theme

  // Graph panel resize
  const [graphWidth, setGraphWidth] = useState(280)
  const isResizingGraph = useRef(false)
  const graphResizeStart = useRef({ x: 0, width: 0 })

  const onGraphResizerMouseDown = useCallback((e: React.MouseEvent) => {
    isResizingGraph.current = true
    graphResizeStart.current = { x: e.clientX, width: graphWidth }
    e.preventDefault()
  }, [graphWidth])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizingGraph.current) return
      const delta = graphResizeStart.current.x - e.clientX
      const newWidth = Math.min(window.innerWidth - 300, Math.max(180, graphResizeStart.current.width + delta))
      setGraphWidth(newWidth)
    }
    function onMouseUp() { isResizingGraph.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // Always-fresh refs for use inside callbacks/effects
  const vaultRef = useRef(vault)
  vaultRef.current = vault
  const buildGraphRef = useRef(buildGraph)
  buildGraphRef.current = buildGraph
  const graphDataRef = useRef(graphData)
  graphDataRef.current = graphData
  const selectedFileRef = useRef(selectedFile)
  selectedFileRef.current = selectedFile
  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab
  const activeIdxRef = useRef(activeIdx)
  activeIdxRef.current = activeIdx
  const openTabRef = useRef(openTab)
  openTabRef.current = openTab

  // BroadcastChannel for graph window
  const graphChannelRef = useRef<BroadcastChannel | null>(null)
  const graphWindowRef = useRef<Window | null>(null)
  const graphViewRef = useRef<GraphViewHandle>(null)

  useEffect(() => {
    const channel = new BroadcastChannel('papyrus-graph')
    graphChannelRef.current = channel

    channel.onmessage = async (e) => {
      const { type, data } = e.data
      if (type === 'ready') {
        if (graphDataRef.current) channel.postMessage({ type: 'graphData', data: serializeGraphData(graphDataRef.current) })
        channel.postMessage({ type: 'selectedPath', data: selectedFileRef.current?.path ?? null })
        channel.postMessage({ type: 'theme', data: themeRef.current })
      } else if (type === 'selectFile') {
        const files = flattenFiles(vaultRef.current?.children ?? [])
        const found = files.find(f => f.path === data)
        if (found) {
          try {
            const f = await found.handle.getFile()
            openTabRef.current(found, await f.text())
          } catch {}
        }
      } else if (type === 'nodePositions') {
        const positions: NodePositions = new Map(Object.entries(data as Record<string, { x: number; y: number }>))
        graphViewRef.current?.applyPositions(positions)
      } else if (type === 'requestBuild') {
        buildGraphRef.current()
      } else if (type === 'closed') {
        setGraphWindowOpen(false)
      }
    }

    return () => { channel.close(); graphChannelRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (graphData && graphChannelRef.current) {
      graphChannelRef.current.postMessage({ type: 'graphData', data: serializeGraphData(graphData) })
    }
  }, [graphData])

  useEffect(() => {
    graphChannelRef.current?.postMessage({ type: 'selectedPath', data: selectedFile?.path ?? null })
  }, [selectedFile?.path])

  useEffect(() => {
    if (buildingGraph) graphChannelRef.current?.postMessage({ type: 'building' })
  }, [buildingGraph])

  useEffect(() => {
    graphChannelRef.current?.postMessage({ type: 'theme', data: theme })
  }, [theme])

  function openGraphWindow() {
    if (graphWindowRef.current && !graphWindowRef.current.closed) {
      graphWindowRef.current.focus()
      return
    }
    const win = window.open(
      '/?graphview=1',
      'papyrus-graph',
      'width=800,height=600,menubar=no,toolbar=no'
    )
    graphWindowRef.current = win
    setGraphWindowOpen(true)
    buildGraph()
  }

  useEffect(() => {
    if ((showGraph || graphWindowOpen) && vault) buildGraph()
  }, [showGraph, graphWindowOpen, vault, buildGraph])

  // wikilink 클릭 → 해당 파일을 탭으로 열기
  const handleWikilinkClick = useCallback((title: string) => {
    if (!vault) return
    const files = flattenFiles(vault.children)
    const matchName = title.endsWith('.md') ? title : `${title}.md`
    const currentDir = selectedFile?.path.split('/').slice(0, -1).join('/') ?? ''
    const preferred = files.find(f => f.path === `${currentDir}/${matchName}`)
    const fallback = files.find(f => f.name === matchName)
    const found = preferred ?? fallback
    if (found) {
      found.handle.getFile()
        .then(f => f.text())
        .then(text => openTabRef.current(found, text))
        .catch(() => {})
    }
  }, [vault, selectedFile])

  // 에디터 내용 변경 시 (타이핑) — 탭 상태만 업데이트, 저장·rename·그래프는 Ctrl+S 시
  const handleEditorUpdate = useCallback((markdown: string) => {
    updateTabContent(activeIdxRef.current, markdown)
  }, [updateTabContent])

  // Ctrl+S 저장 (에디터 onSave에서 호출) — rename·그래프 리빌드도 이 시점에
  const handleSaveActive = useCallback(async (markdownFromEditor?: string) => {
    const tab = activeTabRef.current
    const idx = activeIdxRef.current
    if (!tab) return
    const content = markdownFromEditor ?? tab.content
    const ok = await save(tab.file, content)
    if (!ok) return
    markSaved(idx, content)

    // 그래프 리빌드
    if (showGraphRef.current || graphWindowOpenRef.current) {
      buildGraphRef.current()
    }

    // H1 기반 파일명 rename (vault 모드 전용)
    if (tab.file.dirHandle) {
      const match = content.match(/^# (.+)$/m)
      const newTitle = match ? match[1].trim() : ''
      const currentName = tab.file.name.replace(/\.md$/, '')
      if (newTitle && newTitle !== currentName) {
        const renamed = await rename(tab.file, content, newTitle)
        if (renamed) {
          await updateLinksForRename(currentName, newTitle)
          updateTabFile(idx, renamed)
          await refreshVault()
        }
      }
    }
  }, [save, markSaved, rename, updateLinksForRename, updateTabFile, refreshVault])

  // 파일을 읽어서 탭으로 열기
  async function loadAndOpenTab(file: FileNode) {
    try {
      const f = await file.handle.getFile()
      openTab(file, await f.text())
    } catch {}
  }

  // vault/파일 열기 — 미저장 탭 모두 버리고 초기화
  async function handleOpenVault() {
    clearTabs()
    await openVault()
  }

  async function handleOpenFile() {
    clearTabs()
    await openFile()
  }

  // 파일 삭제 확인 다이얼로그
  const [deleteConfirm, setDeleteConfirm] = useState<FileNode | null>(null)

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return
    const file = deleteConfirm
    setDeleteConfirm(null)
    const ok = await deleteFile(file)
    if (ok) {
      const tabIdx = tabs.findIndex(t => t.file.path === file.path)
      if (tabIdx >= 0) closeTab(tabIdx)
      groupLinks
        .filter(l => l.toType === 'node' && l.toId === file.path)
        .forEach(l => deleteGroupLink(l.id))
    }
  }

  // 탭 닫기 확인 다이얼로그 (인덱스 대신 path로 추적 — 다른 탭이 닫혀도 안전)
  const [closeConfirm, setCloseConfirm] = useState<{ path: string } | null>(null)

  function handleCloseTab(idx: number) {
    const tab = tabs[idx]
    if (tab.content !== tab.savedContent) {
      setCloseConfirm({ path: tab.file.path })
    } else {
      closeTab(idx)
    }
  }

  async function handleConfirmSave() {
    if (!closeConfirm) return
    const idx = tabs.findIndex(t => t.file.path === closeConfirm.path)
    if (idx < 0) { setCloseConfirm(null); return }
    const tab = tabs[idx]
    const ok = await save(tab.file, tab.content)
    if (ok) markSaved(idx, tab.content)
    closeTab(idx)
    setCloseConfirm(null)
  }

  function handleConfirmDiscard() {
    if (!closeConfirm) return
    const idx = tabs.findIndex(t => t.file.path === closeConfirm.path)
    if (idx >= 0) closeTab(idx)
    setCloseConfirm(null)
  }

  function handleConfirmCancel() {
    setCloseConfirm(null)
  }

  // displayContent: 첫 H1이 비어있으면 파일명으로 채움 (탭 전환 시 초기값)
  const displayContent = useMemo(() => {
    if (!activeTab) return ''
    const lines = activeTab.content.split('\n')
    if (/^# *$/.test(lines[0])) {
      lines[0] = `# ${activeTab.file.name.replace(/\.md$/, '')}`
      return lines.join('\n')
    }
    return activeTab.content
  }, [activeTab])

  const handleGraphFileSelect = useCallback(async (file: FileNode) => {
    try {
      const f = await file.handle.getFile()
      openTabRef.current(file, await f.text())
    } catch {}
  }, [])

  function handleSearchToggle() {
    if (sidebarMode === 'search') { clear(); setSidebarMode('tree') }
    else setSidebarMode('search')
  }

  function handleTagsToggle() {
    setSidebarMode(prev => prev === 'tags' ? 'tree' : 'tags')
  }

  async function handleFileSelect(file: FileNode) {
    await loadAndOpenTab(file)
    setSidebarMode('tree')
    clear()
  }

  async function handleCreateStart() {
    const file = await createFile()
    if (file) await loadAndOpenTab(file)
  }

  // Drag-and-drop state
  const [isFileDragging, setIsFileDragging] = useState(false)
  const [moveErrorMsg, setMoveErrorMsg] = useState<string | null>(null)
  const [isFileTreeDragOver, setIsFileTreeDragOver] = useState(false)
  const fileTreeDragCounterRef = useRef(0)

  function canFileTreeDrop() {
    return isFileDragging && !!vault && vault.name !== '열린 파일'
  }

  function handleFileTreeDragOver(e: React.DragEvent) {
    if (!canFileTreeDrop()) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleFileTreeDragEnter() {
    fileTreeDragCounterRef.current++
    if (isFileDragging) setIsFileTreeDragOver(true)
  }

  function handleFileTreeDragLeave() {
    fileTreeDragCounterRef.current--
    if (fileTreeDragCounterRef.current <= 0) {
      fileTreeDragCounterRef.current = 0
      setTimeout(() => {
        if (fileTreeDragCounterRef.current === 0) setIsFileTreeDragOver(false)
      }, 0)
    }
  }

  async function handleFileTreeDrop(e: React.DragEvent) {
    e.preventDefault()
    fileTreeDragCounterRef.current = 0
    setIsFileTreeDragOver(false)
    if (!vault || vault.name === '열린 파일') return
    const file = getDraggedFileNode()
    if (!file || !file.dirHandle) return
    if (file.dirHandle === vault.handle) return
    const moved = await moveFile(file, vault.handle, vault.path)
    if (moved) {
      const tabIdx = tabs.findIndex(t => t.file.path === file.path)
      if (tabIdx >= 0) updateTabFile(tabIdx, moved)
    } else {
      setMoveErrorMsg('이미 같은 이름의 파일이 있습니다')
      setTimeout(() => setMoveErrorMsg(null), 3000)
    }
  }

  const isElectron = !!window.electronAPI

  return (
    <div className="app">
      {isElectron && <TitleBar />}
      <div className="app-body">
        <aside
          className={`sidebar${isOpen ? '' : ' sidebar-closed'}${isResizing ? '' : ' sidebar-animated'}`}
          style={isOpen ? { width } : undefined}
        >
          <div className="sidebar-inner" style={{ width }}>
            <div className="sidebar-header">
              <div className="sidebar-title-row">
                <span className="app-name">Papyrus</span>
                <div className="sidebar-icon-btns">
                  <button
                    className={`search-toggle-btn${sidebarMode === 'search' ? ' active' : ''}`}
                    onClick={handleSearchToggle}
                    title="검색"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
                    </svg>
                  </button>
                  <button
                    className={`search-toggle-btn${sidebarMode === 'tags' ? ' active' : ''}`}
                    onClick={handleTagsToggle}
                    title="태그"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M2 2a1 1 0 0 1 1-1h4.586a1 1 0 0 1 .707.293l7 7a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 2 6.586V2zm3.5 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                    </svg>
                  </button>
                  <button
                    className={`search-toggle-btn${showGraph ? ' active' : ''}`}
                    onClick={() => setShowGraph(v => !v)}
                    title="그래프 뷰"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <circle cx="3" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="13" cy="3" r="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="13" cy="13" r="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                      <line x1="5" y1="7" x2="11" y2="4" stroke="currentColor" strokeWidth="1.2"/>
                      <line x1="5" y1="9" x2="11" y2="12" stroke="currentColor" strokeWidth="1.2"/>
                    </svg>
                  </button>
                </div>
              </div>
              {sidebarMode === 'tree' && (
                <div className="sidebar-actions">
                  <button className="open-vault-btn" onClick={handleOpenVault} disabled={loading}>
                    {loading ? '여는 중...' : '폴더 열기'}
                  </button>
                  <button className="open-file-btn" onClick={handleOpenFile} disabled={loading}>
                    파일 열기
                  </button>
                </div>
              )}
            </div>

            {sidebarMode === 'tree' ? (
              <div
                className={`file-tree${isFileTreeDragOver && canFileTreeDrop() ? ' file-tree-drag-over' : ''}`}
                onDragOver={handleFileTreeDragOver}
                onDragEnter={handleFileTreeDragEnter}
                onDragLeave={handleFileTreeDragLeave}
                onDrop={handleFileTreeDrop}
              >
                {moveErrorMsg && <div className="move-error-toast">{moveErrorMsg}</div>}
                {error && <p className="tree-error">{error}</p>}
                {vault ? (
                  <>
                    <div className="vault-header">
                      <p className="vault-name">{vault.name}</p>
                      <div className="vault-actions">
                        {vault.name !== '열린 파일' && (
                          <button className="refresh-btn" onClick={handleCreateStart} disabled={loading} title="새 파일">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
                            </svg>
                          </button>
                        )}
                        <button className="refresh-btn" onClick={refreshVault} disabled={loading} title="새로고침">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.418A6 6 0 1 1 8 2v1z"/>
                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <FileTree
                      nodes={vault.children}
                      selectedPath={selectedFile?.path ?? null}
                      onFileSelect={handleFileSelect}
                      onRenameFolder={async (folder, newName) => {
                        const oldPath = folder.path
                        const ok = await renameFolder(folder, newName)
                        if (ok) {
                          closePaths(new Set(tabs.filter(t => t.file.path.startsWith(oldPath + '/')).map(t => t.file.path)))
                        } else {
                          setMoveErrorMsg('폴더 이름 변경 실패 (최신 Chrome 필요)')
                          setTimeout(() => setMoveErrorMsg(null), 3000)
                        }
                      }}
                      onFileDelete={file => setDeleteConfirm(file)}
                      onMoveFile={async (file, targetDirHandle, targetPath) => {
                        const moved = await moveFile(file, targetDirHandle, targetPath)
                        if (moved) {
                          const tabIdx = tabs.findIndex(t => t.file.path === file.path)
                          if (tabIdx >= 0) updateTabFile(tabIdx, moved)
                        }
                      }}
                      onDragStateChange={setIsFileDragging}
                    />
                  </>
                ) : (
                  <p className="tree-empty">열린 Vault가 없습니다.</p>
                )}
              </div>
            ) : sidebarMode === 'search' ? (
              <Search
                query={query}
                results={results}
                searching={searching}
                selectedPath={selectedFile?.path ?? null}
                onQueryChange={setQuery}
                onFileSelect={handleFileSelect}
              />
            ) : (
              <TagPanel
                tagMap={tagMap}
                indexing={indexing}
                selectedPath={selectedFile?.path ?? null}
                onBuildIndex={buildIndex}
                onFileSelect={file => { loadAndOpenTab(file); setSidebarMode('tree') }}
              />
            )}

            <div className="sidebar-footer">
              <button
                className="theme-icon-btn"
                onClick={toggleTheme}
                title={theme === 'dark' ? (locale === 'ko' ? '라이트 모드' : 'Light mode') : (locale === 'ko' ? '다크 모드' : 'Dark mode')}
              >
                {theme === 'dark' ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>

              <div className="lang-selector" ref={langMenuRef}>
                {langMenuOpen && (
                  <div className="lang-dropdown">
                    {(['ko', 'en'] as Locale[]).map(l => (
                      <button
                        key={l}
                        className={`lang-option${locale === l ? ' active' : ''}`}
                        onClick={() => { setLocale(l); setLangMenuOpen(false) }}
                      >
                        {l === 'ko' ? '한국어' : 'English'}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="lang-btn"
                  onClick={() => setLangMenuOpen(v => !v)}
                  title={locale === 'ko' ? '언어 설정' : 'Language'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  <span>{locale === 'ko' ? 'KO' : 'EN'}</span>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" style={{ opacity: 0.5 }}>
                    <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {isOpen && <div className="resizer" onMouseDown={onResizerMouseDown} />}
        </aside>

        <button
          className="sidebar-toggle"
          onClick={toggle}
          style={{ left: isOpen ? width : 0 }}
          title={isOpen ? '사이드바 닫기' : '사이드바 열기'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            {isOpen
              ? <path d="M11 8L7 4l-.7.7L9.6 8l-3.3 3.3.7.7L11 8z" transform="rotate(180 8 8)" />
              : <path d="M11 8L7 4l-.7.7L9.6 8l-3.3 3.3.7.7L11 8z" />
            }
          </svg>
        </button>

        <div className="main-area">
          <main className="editor-area">
            <TabBar
              tabs={tabs}
              activeIdx={activeIdx}
              onSwitch={switchTab}
              onClose={handleCloseTab}
            />
            {activeTab ? (
              <Editor
                key={activeTab.file.path}
                content={displayContent}
                saving={saving}
                isDirty={activeTab.content !== activeTab.savedContent}
                onUpdate={handleEditorUpdate}
                onSave={handleSaveActive}
                onWikilinkClick={handleWikilinkClick}
              />
            ) : (
              <p className="placeholder">파일을 선택해 편집을 시작하세요.</p>
            )}
          </main>

          {showGraph && (
            <GraphView
              ref={graphViewRef}
              graphData={graphData}
              building={buildingGraph}
              selectedPath={selectedFile?.path ?? null}
              onFileSelect={handleGraphFileSelect}
              onBuild={buildGraph}
              width={graphWidth}
              onResizerMouseDown={onGraphResizerMouseDown}
              onOpenInWindow={openGraphWindow}
              onPositionsChange={positions => {
                const posObj: Record<string, { x: number; y: number }> = {}
                positions.forEach((pos, id) => { posObj[id] = pos })
                graphChannelRef.current?.postMessage({ type: 'nodePositions', data: posObj })
              }}
              groups={groups}
              onCreateGroup={createGroup}
              onDeleteGroup={id => {
                groupLinks
                  .filter(l => l.fromId === id || (l.toType === 'group' && l.toId === id))
                  .forEach(l => deleteGroupLink(l.id))
                deleteGroup(id)
              }}
              groupLinks={groupLinks}
              onCreateGroupLink={createGroupLink}
              onDeleteGroupLink={deleteGroupLink}
            />
          )}
        </div>
      </div>

      {deleteConfirm !== null && (
        <div className="dialog-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <p className="dialog-message">
              "{deleteConfirm.name.replace(/\.md$/, '')}" 파일을 삭제하시겠습니까?<br />
              <span style={{ fontSize: '0.85em', opacity: 0.7 }}>이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="dialog-actions">
              <button className="dialog-btn dialog-discard" onClick={handleDeleteConfirm}>삭제</button>
              <button className="dialog-btn dialog-cancel" onClick={() => setDeleteConfirm(null)}>취소</button>
            </div>
          </div>
        </div>
      )}

      {closeConfirm !== null && (
        <div className="dialog-overlay" onClick={handleConfirmCancel}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <p className="dialog-message">
              "{tabs.find(t => t.file.path === closeConfirm.path)?.file.name.replace(/\.md$/, '') ?? '파일'}"의 변경사항을 저장하시겠습니까?
            </p>
            <div className="dialog-actions">
              <button className="dialog-btn dialog-save" onClick={handleConfirmSave}>저장</button>
              <button className="dialog-btn dialog-discard" onClick={handleConfirmDiscard}>저장 안 함</button>
              <button className="dialog-btn dialog-cancel" onClick={handleConfirmCancel}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
