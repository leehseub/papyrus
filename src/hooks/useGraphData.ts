import { useState, useCallback } from 'react'
import type { FSNode, FileNode, FolderNode } from '../types'


export interface GraphNode {
  id: string
  name: string
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

function flattenFiles(nodes: FSNode[]): FileNode[] {
  const files: FileNode[] = []
  for (const node of nodes) {
    if (node.kind === 'file') files.push(node)
    else files.push(...flattenFiles((node as FolderNode).children))
  }
  return files
}

export function useGraphData(nodes: FSNode[]) {
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [building, setBuilding] = useState(false)

  const buildGraph = useCallback(async () => {
    setBuilding(true)
    const files = flattenFiles(nodes)
    const nameToNode = new Map<string, FileNode>()

    for (const f of files) {
      nameToNode.set(f.name, f)
      nameToNode.set(f.name.replace(/\.md$/, ''), f)
    }

    const graphNodes: GraphNode[] = files.map(f => ({
      id: f.path,
      name: f.name.replace(/\.md$/, ''),
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
            const target = nameToNode.get(title) ?? nameToNode.get(`${title}.md`)
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
