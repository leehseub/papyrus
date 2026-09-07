import { useState, useCallback, useLayoutEffect, useRef, cloneElement } from 'react'
import { createPortal } from 'react-dom'
import './Tooltip.css'

const MARGIN = 8

interface TooltipProps {
  content: string
  children: React.ReactElement
}

export function Tooltip({ content, children }: TooltipProps) {
  const [anchor, setAnchor] = useState<{ x: number; top: number; bottom: number } | null>(null)
  const [style, setStyle] = useState<{ left: number; top: number; placement: 'top' | 'bottom'; arrowLeft: number } | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setAnchor({ x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setAnchor(null)
    setStyle(null)
  }, [])

  // 렌더 후 실제 크기 측정 → x 보정 + top/bottom 결정
  useLayoutEffect(() => {
    if (!anchor || !tooltipRef.current) return
    const { offsetWidth: w, offsetHeight: h } = tooltipRef.current
    const half = w / 2
    const x = Math.min(Math.max(anchor.x, half + MARGIN), window.innerWidth - half - MARGIN)
    const placement = anchor.top - h - 8 >= MARGIN ? 'top' : 'bottom'
    const y = placement === 'top' ? anchor.top : anchor.bottom
    // arrow should point at the original trigger x, not the clamped tooltip center
    const arrowLeft = anchor.x - (x - half)
    setStyle({ left: x, top: y, placement, arrowLeft })
  }, [anchor, content])

  return (
    <>
      {cloneElement(children, {
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        title: undefined,
      } as React.HTMLAttributes<HTMLElement>)}
      {anchor && createPortal(
        <div
          ref={tooltipRef}
          className={`tooltip${style ? ` tooltip--${style.placement}` : ''}`}
          style={{
            left: style?.left ?? anchor.x,
            top: style?.top ?? anchor.top,
            visibility: style ? 'visible' : 'hidden',
            '--arrow-left': `${style?.arrowLeft ?? '50%'}`,
          } as React.CSSProperties}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  )
}
