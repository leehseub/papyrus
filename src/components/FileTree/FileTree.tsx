import { useState, useRef } from 'react'
import type { FSNode, FileNode, FolderNode } from '../../types'
import './FileTree.css'

// Module-level: track currently dragged file node (exported for sidebar-level drop)
let draggedFileNode: FileNode | null = null
export function getDraggedFileNode() { return draggedFileNode }

interface FileTreeProps {
  nodes: FSNode[]
  selectedPath: string | null
  onFileSelect: (node: FileNode) => void
  onFileDelete?: (node: FileNode) => void
  onRenameFolder?: (folder: FolderNode, newName: string) => Promise<void>
  onMoveFile?: (file: FileNode, targetDirHandle: FileSystemDirectoryHandle, targetPath: string) => Promise<void>
  onDragStateChange?: (dragging: boolean) => void
}

interface TreeNodeProps {
  node: FSNode
  selectedPath: string | null
  onFileSelect: (node: FileNode) => void
  onFileDelete?: (node: FileNode) => void
  onRenameFolder?: (folder: FolderNode, newName: string) => Promise<void>
  onMoveFile?: (file: FileNode, targetDirHandle: FileSystemDirectoryHandle, targetPath: string) => Promise<void>
  onDragStateChange?: (dragging: boolean) => void
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      {open ? (
        <path d="M1 3.5A1.5 1.5 0 012.5 2h3.586a1 1 0 01.707.293L7.5 3.5H14A1.5 1.5 0 0115 5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12V3.5z" />
      ) : (
        <path d="M2.5 2A1.5 1.5 0 001 3.5v9A1.5 1.5 0 002.5 14h11A1.5 1.5 0 0015 12.5V5A1.5 1.5 0 0013.5 3.5H7.793L6.5 2.207A1 1 0 005.793 2H2.5z" />
      )}
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 1.5A1.5 1.5 0 012.5 3v10A1.5 1.5 0 004 14.5h8A1.5 1.5 0 0013.5 13V5.621a1.5 1.5 0 00-.44-1.06L10.439 1.94A1.5 1.5 0 009.378 1.5H4zm5.5 0v3a.5.5 0 00.5.5h3" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
      <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
    </svg>
  )
}

function TreeNode({ node, selectedPath, onFileSelect, onFileDelete, onRenameFolder, onMoveFile, onDragStateChange }: TreeNodeProps) {
  const [open, setOpen] = useState(true)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  if (node.kind === 'file') {
    const label = node.name.replace(/\.md$/, '')
    const canDelete = !!node.dirHandle && !!onFileDelete
    const canDrag = !!node.dirHandle && !!onMoveFile

    function handleDelete(e: React.MouseEvent) {
      e.stopPropagation()
      if (!canDelete) return
      onFileDelete!(node as FileNode)
    }

    return (
      <div className="tree-node">
        <div
          className={`tree-node-row${selectedPath === node.path ? ' selected' : ''}`}
          onClick={() => onFileSelect(node)}
          draggable={canDrag}
          onDragStart={e => {
            draggedFileNode = node
            e.dataTransfer.setData('text/papyrus-file', label)
            e.dataTransfer.effectAllowed = 'all'
            onDragStateChange?.(true)
          }}
          onDragEnd={() => {
            draggedFileNode = null
            onDragStateChange?.(false)
          }}
        >
          <span className="tree-chevron" style={{ visibility: 'hidden' }} />
          <span className="tree-icon file"><FileIcon /></span>
          <span className="tree-label" title={node.name}>{label}</span>
          {canDelete && (
            <button
              className="tree-delete-btn"
              onClick={handleDelete}
              onDragStart={e => e.stopPropagation()}
              title="파일 삭제"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
    )
  }

  const folder = node as FolderNode

  function startRename(e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!onRenameFolder) return
    setRenameValue(folder.name)
    setIsRenaming(true)
    setTimeout(() => { renameInputRef.current?.select() }, 0)
  }

  async function commitRename() {
    setIsRenaming(false)
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== folder.name) {
      await onRenameFolder?.(folder, trimmed)
    }
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitRename() }
    if (e.key === 'Escape') { setIsRenaming(false) }
  }

  function canDrop() {
    if (!draggedFileNode || !onMoveFile) return false
    if (draggedFileNode.dirHandle === folder.handle) return false
    return true
  }

  // Drag handlers on outer tree-node: entire folder section (name + children) is the drop zone.
  // stopPropagation prevents parent folders / sidebar from also reacting.
  function handleDragOver(e: React.DragEvent) {
    if (!canDrop()) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDragEnter(e: React.DragEvent) {
    e.stopPropagation()
    dragCounterRef.current++
    if (canDrop()) setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setTimeout(() => {
        if (dragCounterRef.current === 0) setIsDragOver(false)
      }, 0)
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragOver(false)
    const file = draggedFileNode
    if (!file || !onMoveFile) return
    if (file.dirHandle === folder.handle) return
    setOpen(true)
    await onMoveFile(file, folder.handle, folder.path)
  }

  return (
    <div
      className={`tree-node${isDragOver ? ' folder-drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="tree-node-row"
        tabIndex={onRenameFolder ? 0 : undefined}
        onClick={() => !isRenaming && setOpen(prev => !prev)}
        onKeyDown={e => {
          if (e.key === 'F2' && onRenameFolder) { e.preventDefault(); startRename() }
        }}
      >
        <span className={`tree-chevron${open ? ' open' : ''}`}>
          <ChevronIcon />
        </span>
        <span className="tree-icon folder"><FolderIcon open={open || isDragOver} /></span>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="tree-rename-input"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="tree-label" title={folder.name} onDoubleClick={onRenameFolder ? () => startRename() : undefined}>
            {folder.name}
          </span>
        )}
      </div>
      {open && folder.children.length > 0 && (
        <div className="tree-children">
          {folder.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onFileSelect={onFileSelect}
              onFileDelete={onFileDelete}
              onRenameFolder={onRenameFolder}
              onMoveFile={onMoveFile}
              onDragStateChange={onDragStateChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ nodes, selectedPath, onFileSelect, onFileDelete, onRenameFolder, onMoveFile, onDragStateChange }: FileTreeProps) {
  if (nodes.length === 0) {
    return <p className="tree-empty">.md 파일이 없습니다.</p>
  }

  return (
    <div className="file-tree-root">
      {nodes.map(node => (
        <TreeNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onFileSelect={onFileSelect}
          onFileDelete={onFileDelete}
          onRenameFolder={onRenameFolder}
          onMoveFile={onMoveFile}
          onDragStateChange={onDragStateChange}
        />
      ))}
    </div>
  )
}
