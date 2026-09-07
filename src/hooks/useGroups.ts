import { useState, useCallback, useEffect } from 'react'
import * as d3 from 'd3'

/** 각 노드를 작은 원으로 확장해 convex hull 경로 생성 */
export function hullPath(points: [number, number][], r: number): string {
  if (points.length === 0) return ''
  const expanded: [number, number][] = []
  for (const [x, y] of points) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      expanded.push([x + Math.cos(a) * r, y + Math.sin(a) * r])
    }
  }
  const hull = d3.polygonHull(expanded)
  if (!hull) return ''
  return 'M' + hull.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z'
}

export interface NodeGroup {
  id: string
  name: string
  color: string
  paths: string[]
}

export const GROUP_COLORS = [
  '#818cf8', '#f59e0b', '#34d399', '#f87171', '#a78bfa',
  '#f472b6', '#2dd4bf', '#fb923c', '#38bdf8', '#a3e635',
]

const KEY = 'papyrus-node-groups'

function load(): NodeGroup[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function persist(groups: NodeGroup[]) {
  localStorage.setItem(KEY, JSON.stringify(groups))
}

export function useGroups() {
  const [groups, setGroups] = useState<NodeGroup[]>(load)

  // 다른 창(팝업 ↔ 메인)에서 localStorage가 변경되면 동기화
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setGroups(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const createGroup = useCallback((name: string, paths: string[], color?: string): NodeGroup => {
    const current = load()
    const usedColors = new Set(current.map(g => g.color))
    const autoColor = color ?? GROUP_COLORS.find(c => !usedColors.has(c)) ?? GROUP_COLORS[current.length % GROUP_COLORS.length]
    const group: NodeGroup = { id: `${Date.now()}`, name, color: autoColor, paths }
    const updated = [...current, group]
    persist(updated)
    setGroups(updated)
    return group
  }, [])

  const deleteGroup = useCallback((id: string) => {
    const updated = load().filter(g => g.id !== id)
    persist(updated)
    setGroups(updated)
  }, [])

  return { groups, createGroup, deleteGroup }
}
