export type DockSide = 'left' | 'right'
export type GraphMode = DockSide | 'floating' | 'hidden'
export const GRAPH_DRAG_TYPE = 'application/x-papyrus-graph'
export const GRAPH_LAYOUT_CHANNEL = 'papyrus-graph-layout'
export const GRAPH_LAYOUT_KEY = 'papyrus-graph-layout'

export function readGraphLayout(): { mode: GraphMode; side: DockSide; width: number } {
  try {
    const value = JSON.parse(localStorage.getItem(GRAPH_LAYOUT_KEY) ?? '{}')
    return {
      mode: ['left', 'right', 'floating', 'hidden'].includes(value.mode) ? value.mode : 'hidden',
      side: value.side === 'left' ? 'left' : 'right',
      width: Number.isFinite(value.width) ? Math.min(600, Math.max(180, value.width)) : 280,
    }
  } catch { return { mode: 'hidden', side: 'right', width: 280 } }
}

export function graphDropSide(x: number, y: number, rect: { left: number; top: number; width: number; height: number }): DockSide | null {
  if (x < rect.left || x > rect.left + rect.width || y < rect.top || y > rect.top + rect.height) return null
  const edge = Math.min(220, rect.width / 3)
  if (x <= rect.left + edge) return 'left'
  if (x >= rect.left + rect.width - edge) return 'right'
  return null
}
