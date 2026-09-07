import { useState, useEffect } from 'react'
import './TitleBar.css'

export function TitleBar({ title = "Papyrus" }: { title?: string }) {
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
      <div className="title-bar-controls">
        <button className="titlebar-btn titlebar-min" onClick={handleMinimize} title="최소화">
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
            <rect width="10" height="1.2" y="0" fill="currentColor" />
          </svg>
        </button>
        <button className="titlebar-btn titlebar-max" onClick={handleMaximize} title={isMaximized ? '이전 크기로' : '최대화'}>
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
        <button className="titlebar-btn titlebar-close" onClick={handleClose} title="닫기">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
