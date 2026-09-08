import type { DragEvent } from 'react'
import { GRAPH_DRAG_TYPE, GRAPH_LAYOUT_CHANNEL } from '../../lib/graphLayout'

interface Props {
  label: string
  hint: string
  floating?: boolean
  onStart?: () => void
  onEnd?: () => void
  onDetach?: (point: { x: number; y: number }) => void
}

function announce(type: string) {
  const channel = new BroadcastChannel(GRAPH_LAYOUT_CHANNEL)
  channel.postMessage({ type })
  channel.close()
}

export function GraphDragHandle({ label, hint, floating, onStart, onEnd, onDetach }: Props) {
  function start(event: DragEvent<HTMLSpanElement>) {
    event.dataTransfer.setData(GRAPH_DRAG_TYPE, floating ? 'floating' : 'docked')
    event.dataTransfer.effectAllowed = 'move'
    onStart?.()
    announce('drag-start')
  }
  async function end(event: DragEvent<HTMLSpanElement>) {
    onEnd?.()
    announce('drag-end')
    // Chromium reports (0, 0) for a cancelled native drag.
    if (floating || event.dataTransfer.dropEffect !== 'none' || (!event.screenX && !event.screenY)) return
    const position = window.electronAPI?.getDragPosition
      ? await window.electronAPI.getDragPosition()
      : { point: { x: event.screenX, y: event.screenY }, bounds: { x: window.screenX, y: window.screenY, width: window.outerWidth, height: window.outerHeight } }
    const { point, bounds } = position
    if (point.x < bounds.x || point.x >= bounds.x + bounds.width || point.y < bounds.y || point.y >= bounds.y + bounds.height) onDetach?.(point)
  }
  return <span className="graph-title graph-drag-handle" draggable onDragStart={start} onDragEnd={end} data-tooltip={hint} data-tooltip-anchor="pointer">{label}</span>
}
