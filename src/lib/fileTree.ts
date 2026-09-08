import type { FSNode, FileNode } from '../types'

/** Preserve file-tree order without allocating an array for every folder. */
export function flattenFiles(nodes: FSNode[]): FileNode[] {
  const files: FileNode[] = []
  const pending = [...nodes].reverse()
  while (pending.length > 0) {
    const node = pending.pop()!
    if (node.kind === 'file') files.push(node)
    else {
      for (let i = node.children.length - 1; i >= 0; i--) {
        pending.push(node.children[i])
      }
    }
  }
  return files
}
