import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { GRAPH_DRAG_TYPE, GRAPH_LAYOUT_CHANNEL, GRAPH_LAYOUT_KEY, graphDropSide, readGraphLayout } from '../lib/graphLayout'
import type { DockSide } from '../lib/graphLayout'

export function useGraphDocking(receivePositions: (positions: Record<string, { x: number; y: number }>) => void) {
  const [layout, setLayout] = useState(readGraphLayout)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<DockSide | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<Window | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)

  const clearDrag = useCallback(() => { setDragging(false); setPreview(null) }, [])
  const dock = useCallback((side: DockSide) => {
    setLayout(old => ({ ...old, side, mode: side }))
    clearDrag()
    channelRef.current?.postMessage({ type: 'docked' })
  }, [clearDrag])
  const onWindowClosed = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) return
    popupRef.current = null
    setLayout(old => old.mode === 'floating' ? { ...old, mode: 'hidden' } : old)
  }, [])

  const openGraphWindow = useCallback((point?: { x: number; y: number }) => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus()
      setLayout(old => ({ ...old, mode: 'floating' }))
      return
    }
    const url = new URL(window.location.href)
    url.search = '?graphview=1'
    const position = point ? `,left=${Math.round(point.x - 80)},top=${Math.round(point.y - 20)}` : ''
    const win = window.open(url.href, 'papyrus-graph', `width=800,height=600,menubar=no,toolbar=no${position}`)
    if (win) {
      popupRef.current = win
      setLayout(old => ({ ...old, mode: 'floating' }))
    } else {
      setLayout(old => ({ ...old, mode: old.side }))
    }
  }, [])

  useEffect(() => {
    const channel = new BroadcastChannel(GRAPH_LAYOUT_CHANNEL)
    channelRef.current = channel
    channel.onmessage = ({ data }) => {
      if (data.type === 'drag-start') setDragging(true)
      if (data.type === 'drag-end') clearDrag()
      if (data.type === 'dock' && (data.side === 'left' || data.side === 'right')) {
        if (data.positions) receivePositions(data.positions)
        dock(data.side)
      }
    }
    return () => { channel.close(); channelRef.current = null }
  }, [dock, clearDrag, receivePositions])

  useEffect(() => {
    if (layout.mode !== 'floating') return
    const timer = window.setInterval(() => {
      if (popupRef.current?.closed) onWindowClosed()
    }, 500)
    return () => window.clearInterval(timer)
  }, [layout.mode, onWindowClosed])

  const restoreFloating = useRef(layout.mode === 'floating')
  useEffect(() => {
    if (restoreFloating.current) { restoreFloating.current = false; openGraphWindow() }
  }, [openGraphWindow])
  useEffect(() => {
    const onPageHide = () => popupRef.current?.close()
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [])
  useEffect(() => { localStorage.setItem(GRAPH_LAYOUT_KEY, JSON.stringify(layout)) }, [layout])

  const toggleGraph = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) { popupRef.current.focus(); return }
    setLayout(old => ({ ...old, mode: old.mode === 'hidden' ? old.side : 'hidden' }))
  }, [])
  const setGraphWidth = useCallback((width: number) => {
    setLayout(old => ({ ...old, width }))
  }, [])

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes(GRAPH_DRAG_TYPE)) return
    const rect = areaRef.current?.getBoundingClientRect()
    const side = rect ? graphDropSide(event.clientX, event.clientY, rect) : null
    setDragging(true)
    setPreview(side)
    event.preventDefault()
    event.dataTransfer.dropEffect = side ? 'move' : 'none'
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes(GRAPH_DRAG_TYPE)) return
    event.preventDefault()
    const rect = areaRef.current?.getBoundingClientRect()
    const side = rect ? graphDropSide(event.clientX, event.clientY, rect) : null
    if (side) dock(side)
    else clearDrag()
  }

  return {
    side: layout.side, graphWidth: layout.width, setGraphWidth,
    showGraph: layout.mode === 'left' || layout.mode === 'right',
    graphWindowOpen: layout.mode === 'floating',
    openGraphWindow, toggleGraph, onWindowClosed, dock,
    dragging, preview, areaRef, onDragOver, onDrop,
    startDrag: () => setDragging(true), clearDrag,
  }
}
