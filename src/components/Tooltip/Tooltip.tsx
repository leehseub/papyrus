import { useState, useEffect, useLayoutEffect, useRef, useId, cloneElement } from 'react'
import { createPortal } from 'react-dom'
import './Tooltip.css'

interface TooltipProps {
  content: string
  children: React.ReactElement
}

// Markers also work on DOM menus and D3 SVG nodes; child handlers stay intact.
export function Tooltip({ content, children }: TooltipProps) {
  return cloneElement(children, { 'data-tooltip': content, title: undefined } as React.HTMLAttributes<HTMLElement>)
}

export function TooltipLayer() {
  const id = useId()
  const [target, setTarget] = useState<{ element: Element; content: string } | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number; arrow: number; placement: 'top' | 'bottom' } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const find = (node: EventTarget | null) => node instanceof Element ? node.closest('[data-tooltip]') : null
    const show = (element: Element | null) => {
      const content = element?.getAttribute('data-tooltip')
      setTarget(previous => {
        if (!element || !content) return null
        if (previous?.element === element && previous.content === content) return previous
        return { element, content }
      })
    }
    const track = (element: Element | null, event: PointerEvent) => {
      setPointer(element?.getAttribute('data-tooltip-anchor') === 'pointer' ? { x: event.clientX, y: event.clientY } : null)
    }
    const over = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.buttons) return
      const element = find(event.target)
      if (element === find(event.relatedTarget)) return
      track(element, event)
      show(element)
    }
    const out = (event: PointerEvent) => {
      const element = find(event.relatedTarget)
      if (element === find(event.target)) return
      track(element, event)
      show(element)
    }
    const focus = (event: FocusEvent) => { setPointer(null); show(find(event.target)) }
    const blur = (event: FocusEvent) => show(find(event.relatedTarget))
    const hide = () => setTarget(null)
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') hide() }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', blur)
    document.addEventListener('pointerdown', hide, true)
    document.addEventListener('click', hide, true)
    document.addEventListener('dragstart', hide, true)
    document.addEventListener('scroll', hide, true)
    document.addEventListener('keydown', key)
    window.addEventListener('blur', hide)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', blur)
      document.removeEventListener('pointerdown', hide, true)
      document.removeEventListener('click', hide, true)
      document.removeEventListener('dragstart', hide, true)
      document.removeEventListener('scroll', hide, true)
      document.removeEventListener('keydown', key)
      window.removeEventListener('blur', hide)
      window.removeEventListener('resize', hide)
    }
  }, [])

  useLayoutEffect(() => {
    if (!target || !ref.current) return
    const { element } = target
    const rect = element.getBoundingClientRect()
    const { offsetWidth: width, offsetHeight: height } = ref.current
    const center = pointer?.x ?? rect.left + rect.width / 2
    const anchorTop = pointer?.y ?? rect.top
    const anchorBottom = pointer?.y ?? rect.bottom
    const left = Math.min(Math.max(center, width / 2 + 8), window.innerWidth - width / 2 - 8)
    const placement = anchorTop - height - 8 >= 8 ? 'top' : 'bottom'
    const top = placement === 'top' ? Math.min(anchorTop, window.innerHeight) : Math.max(0, Math.min(anchorBottom, window.innerHeight - height - 16))
    setPosition({ left, top, placement, arrow: Math.max(8, Math.min(width - 8, center - left + width / 2)) })
  }, [target, pointer])

  useLayoutEffect(() => {
    if (!target) return
    const { element, content } = target
    const describedBy = element.getAttribute('aria-describedby')
    element.setAttribute('aria-describedby', [describedBy, id].filter(Boolean).join(' '))
    const observer = new MutationObserver(() => {
      if (!element.isConnected) setTarget(null)
      else if (element.getAttribute('data-tooltip') !== content) {
        const next = element.getAttribute('data-tooltip')
        setTarget(next ? { element, content: next } : null)
      }
    })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-tooltip'] })
    return () => {
      observer.disconnect()
      const remaining = element.getAttribute('aria-describedby')?.split(/\s+/).filter(value => value !== id).join(' ')
      if (remaining) element.setAttribute('aria-describedby', remaining)
      else element.removeAttribute('aria-describedby')
    }
  }, [target, id])

  return target && createPortal(
    <div ref={ref} id={id} role="tooltip" className={`tooltip tooltip--${position?.placement ?? 'top'}`}
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden', '--arrow-left': `${position?.arrow ?? 8}px` } as React.CSSProperties}>
      {target.content}
    </div>, document.body,
  )
}
