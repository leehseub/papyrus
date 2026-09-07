export interface FileNode {
  name: string
  path: string
  kind: 'file'
  handle: FileSystemFileHandle
  dirHandle: FileSystemDirectoryHandle | null
}

export interface FolderNode {
  name: string
  path: string
  kind: 'directory'
  handle: FileSystemDirectoryHandle
  children: (FileNode | FolderNode)[]
}

export type FSNode = FileNode | FolderNode

export interface SearchResult {
  file: FileNode
  excerpt: string
  matchStart: number
  matchEnd: number
}
