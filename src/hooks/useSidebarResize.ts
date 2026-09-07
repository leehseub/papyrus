import { useState, useRef, useCallback } from 'react'

const MIN_WIDTH = 150
const MAX_WIDTH = 480

export function useSidebarResize(initialWidth = 260) {
  const [width, setWidth] = useState(initialWidth)
  const [isOpen, setIsOpen] = useState(true)
  const [isResizing, setIsResizing] = useState(false)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(initialWidth)

  const onResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    setIsResizing(true)

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      setWidth(next)
    }

    const onMouseUp = () => {
      dragging.current = false
      setIsResizing(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [width])

  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  return { width, isOpen, isResizing, toggle, onResizerMouseDown }
}
