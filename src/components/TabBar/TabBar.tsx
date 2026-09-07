import { useEffect, useRef } from 'react'
import type { Tab } from '../../hooks/useTabs'
import './TabBar.css'

interface TabBarProps {
  tabs: Tab[]
  activeIdx: number
  onSwitch: (idx: number) => void
  onClose: (idx: number) => void
}

export function TabBar({ tabs, activeIdx, onSwitch, onClose }: TabBarProps) {
  const activeTabElRef = useRef<HTMLDivElement | null>(null)

  // Scroll active tab into view whenever it changes
  useEffect(() => {
    activeTabElRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeIdx])

  if (tabs.length === 0) return null

  return (
    <div className="tab-bar">
      {tabs.map((tab, idx) => {
        const label = tab.file.name.replace(/\.md$/, '')
        const isDirty = tab.content !== tab.savedContent
        const isActive = idx === activeIdx
        return (
          <div
            key={tab.file.path}
            ref={isActive ? activeTabElRef : null}
            className={`tab${isActive ? ' tab-active' : ''}`}
            onClick={() => onSwitch(idx)}
            title={tab.file.path}
          >
            <span className="tab-label">{label}</span>
            {isDirty && <span className="tab-dirty" title="저장되지 않은 변경사항">●</span>}
            <button
              className="tab-close"
              onClick={e => { e.stopPropagation(); onClose(idx) }}
              title="닫기"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
