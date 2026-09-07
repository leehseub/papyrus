import { useState, useCallback } from 'react'
import type { FSNode, FileNode, FolderNode } from '../types'

const TAG_RE = /(?<![&\w])#([a-zA-Z가-힣0-9_/-]+)/g

function flattenFiles(nodes: FSNode[]): FileNode[] {
  const files: FileNode[] = []
  for (const node of nodes) {
    if (node.kind === 'file') files.push(node)
    else files.push(...flattenFiles((node as FolderNode).children))
  }
  return files
}

export type TagMap = Map<string, FileNode[]>

export function useTagIndex(nodes: FSNode[]) {
  const [tagMap, setTagMap] = useState<TagMap>(new Map())
  const [indexing, setIndexing] = useState(false)

  const buildIndex = useCallback(async () => {
    setIndexing(true)
    const files = flattenFiles(nodes)
    const map: TagMap = new Map()

    await Promise.all(
      files.map(async file => {
        try {
          const f = await file.handle.getFile()
          const text = await f.text()
          TAG_RE.lastIndex = 0
          const found = new Set<string>()
          let match
          while ((match = TAG_RE.exec(text)) !== null) {
            found.add(match[1])
          }
          for (const tag of found) {
            if (!map.has(tag)) map.set(tag, [])
            map.get(tag)!.push(file)
          }
        } catch { /* 읽기 실패 무시 */ }
      })
    )

    // 알파벳 순 정렬
    const sorted = new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)))
    setTagMap(sorted)
    setIndexing(false)
  }, [nodes])

  return { tagMap, indexing, buildIndex }
}
