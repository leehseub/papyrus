import { useState, useEffect, useRef } from 'react'

const KEY = 'papyrus-selection-shortcut'

export function formatShortcut(s: string): string {
  if (!s) return ''
  const labels: Record<string, string> = {
    ' ': 'Space', escape: 'Esc', backspace: '⌫',
    arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
  }
  return s.split('+').map(k =>
    labels[k] ?? (k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1))
  ).join('+')
}

export function useGraphShortcut(onTrigger: () => void) {
  const [shortcut, setShortcutState] = useState<string>(() => localStorage.getItem(KEY) ?? '')
  const [capturing, setCapturing] = useState(false)
  const triggerRef = useRef(onTrigger)
  triggerRef.current = onTrigger

  function applyShortcut(s: string) {
    setShortcutState(s)
    localStorage.setItem(KEY, s)
  }

  // 다른 창에서 단축키 변경 시 동기화
  useEffect(() => {
    const fn = (e: StorageEvent) => {
      if (e.key === KEY) setShortcutState(e.newValue ?? '')
    }
    window.addEventListener('storage', fn)
    return () => window.removeEventListener('storage', fn)
  }, [])

  // 단축키 발동 (input/textarea/contenteditable 포커스 중 제외)
  useEffect(() => {
    if (!shortcut) return
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      const parts: string[] = []
      if (e.ctrlKey) parts.push('ctrl')
      if (e.altKey) parts.push('alt')
      if (e.shiftKey) parts.push('shift')
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) parts.push(e.key.toLowerCase())
      if (parts.join('+') === shortcut) {
        e.preventDefault()
        triggerRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcut])

  // 단축키 캡처 모드
  // - Escape: 취소
  // - Backspace: 단축키 삭제
  // - 그 외 키: 단축키 저장
  useEffect(() => {
    if (!capturing) return
    function onKey(e: KeyboardEvent) {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') { setCapturing(false); return }
      if (e.key === 'Backspace') { applyShortcut(''); setCapturing(false); return }
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
      const parts: string[] = []
      if (e.ctrlKey) parts.push('ctrl')
      if (e.altKey) parts.push('alt')
      if (e.shiftKey) parts.push('shift')
      parts.push(e.key.toLowerCase())
      applyShortcut(parts.join('+'))
      setCapturing(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [capturing])

  return {
    shortcut,
    capturing,
    startCapture: () => setCapturing(true),
  }
}
