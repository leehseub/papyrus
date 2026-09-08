import { useT } from '../../contexts/LocaleContext'
import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import './TitleBar.css'

export function TitleBar({ title = "Papyrus", trailing }: { title?: string; trailing?: ReactNode }) {
  const t = useT()
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    api.onMaximizeChange(setIsMaximized)
    return () => api.removeMaximizeListener()
  }, [])

  function handleMinimize() { window.electronAPI?.minimize() }
  function handleMaximize() { window.electronAPI?.maximize() }
  function handleClose() { window.electronAPI?.close() }

  return (
    <div className="title-bar">
      <span className="title-bar-name">{title}</span>
      <div className="title-bar-drag" />
      {trailing && <div className="title-bar-info">{trailing}</div>}
      <div className="title-bar-controls">
        <button className="titlebar-btn titlebar-min" onClick={handleMinimize} aria-label={t.minimize} data-tooltip={t.minimize}>
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
            <rect width="10" height="1.2" y="0" fill="currentColor" />
          </svg>
        </button>
        <button className="titlebar-btn titlebar-max" onClick={handleMaximize} aria-label={isMaximized ? t.restore : t.maximize} data-tooltip={isMaximized ? t.restore : t.maximize}>
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.1" />
              <path d="M2 2V0h8v8H8" stroke="currentColor" strokeWidth="1.1" fill="none" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.6" y="0.6" width="8.8" height="8.8" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          )}
        </button>
        <button className="titlebar-btn titlebar-close" onClick={handleClose} aria-label={t.close} data-tooltip={t.close}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
