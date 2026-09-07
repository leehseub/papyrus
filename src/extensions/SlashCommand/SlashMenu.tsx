import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { SlashCommand } from './commands'
import './SlashMenu.css'

interface SlashMenuProps {
  items: SlashCommand[]
  command: (item: SlashCommand) => void
}

export interface SlashMenuRef {
  onKeyDown: (event: KeyboardEvent) => boolean
}

export const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

    useEffect(() => setSelectedIndex(0), [items])

    // 선택 항목이 바뀌면 해당 아이템이 보이도록 스크롤
    useEffect(() => {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
    }, [selectedIndex])

    useImperativeHandle(ref, () => ({
      onKeyDown(event: KeyboardEvent) {
        if (event.key === 'ArrowUp') {
          setSelectedIndex(i => (i - 1 + items.length) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex(i => (i + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          if (items[selectedIndex]) command(items[selectedIndex])
          return true
        }
        return false
      },
    }))

    if (items.length === 0) return null

    return (
      <div className="slash-menu" ref={containerRef}>
        {items.map((item, index) => (
          <button
            key={item.title}
            ref={el => { itemRefs.current[index] = el }}
            className={`slash-menu-item${index === selectedIndex ? ' selected' : ''}`}
            onClick={() => command(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="slash-item-title">{item.title}</span>
            <span className="slash-item-desc">{item.description}</span>
          </button>
        ))}
      </div>
    )
  }
)

SlashMenu.displayName = 'SlashMenu'
