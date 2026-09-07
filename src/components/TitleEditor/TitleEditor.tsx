import { useState, useEffect, useRef } from 'react'
import './TitleEditor.css'

interface TitleEditorProps {
  name: string
  canRename: boolean
  autoFocus?: boolean
  onRename: (newTitle: string) => Promise<void>
}

export function TitleEditor({ name, canRename, autoFocus, onRename }: TitleEditorProps) {
  const displayName = name.replace(/\.md$/, '')
  const [value, setValue] = useState(displayName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(name.replace(/\.md$/, ''))
  }, [name])

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [autoFocus])

  async function handleBlur() {
    const trimmed = value.trim()
    if (!trimmed) { setValue(displayName); return }
    if (trimmed === displayName) return
    await onRename(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur() }
    if (e.key === 'Escape') { setValue(displayName); inputRef.current?.blur() }
  }

  if (!canRename) {
    return <h1 className="title-editor title-editor-readonly">{displayName}</h1>
  }

  return (
    <input
      ref={inputRef}
      className="title-editor"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="제목 없음"
      spellCheck={false}
    />
  )
}
