import { buildNoteLabels, resolveWikilink } from '../lib/wikilinks'
import { flattenFiles } from '../lib/fileTree'
import { useState, useCallback } from 'react'
import type { FSNode, FileNode } from '../types'


export interface GraphNode {
  id: string
  name: string
  context: string
  relativePath: string
  fileNode: FileNode
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphEdge {
  source: string | GraphNode
  target: string | GraphNode
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}


export function useGraphData(nodes: FSNode[]) {
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [building, setBuilding] = useState(false)

  const buildGraph = useCallback(async () => {
    setBuilding(true)
    const files = flattenFiles(nodes)
    const labels = buildNoteLabels(files)
    const graphNodes: GraphNode[] = files.map(f => ({
      id: f.path,
      name: labels.get(f.path)!.title,
      context: labels.get(f.path)!.context,
      relativePath: labels.get(f.path)!.relativePath,
      fileNode: f,
    }))

    const edgeSet = new Set<string>()
    const edges: GraphEdge[] = []

    await Promise.all(
      files.map(async file => {
        try {
          const f = await file.handle.getFile()
          // tiptap-markdown이 [ ] 를 \[ \] 로 이스케이프하므로 원복 후 매칭
          const text = (await f.text()).replace(/\\([\[\]])/g, '$1')
          const re = /\[\[([^\]]+)\]\]/g
          let match
          while ((match = re.exec(text)) !== null) {
            const title = match[1]
            const target = resolveWikilink(files, title, file.path)
            if (!target || target.path === file.path) continue
            const key = [file.path, target.path].sort().join('→')
            if (edgeSet.has(key)) continue
            edgeSet.add(key)
            edges.push({ source: file.path, target: target.path })
          }
        } catch { /* 무시 */ }
      })
    )

    setGraphData({ nodes: graphNodes, edges })
    setBuilding(false)
  }, [nodes])

  return { graphData, building, buildGraph }
}
