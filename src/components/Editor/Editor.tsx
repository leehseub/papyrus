import { useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { TextSelection } from '@tiptap/pm/state'
import { WikilinkDecorator } from '../../extensions/WikilinkDecorator'
import { TagDecorator } from '../../extensions/TagDecorator'
import { SlashCommandExtension } from '../../extensions/SlashCommand/SlashCommandExtension'
import { AutoPair } from '../../extensions/AutoPair'
import { Collapsible, CollapsibleSummary, CollapsibleContent } from '../../extensions/Collapsible/CollapsibleExtension'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import '../../extensions/Collapsible/Collapsible.css'
import './Editor.css'

interface TableMenuPos { top: number; left: number }

// Enter 키 입력 시 storedMarks 초기화 (리스트/인용구/코드블럭 내부는 제외)
const ClearMarksOnEnter = Extension.create({
  name: 'clearMarksOnEnter',
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        if (editor.isActive('listItem') || editor.isActive('blockquote') || editor.isActive('codeBlock')) {
          return false
        }
        const result = editor.commands.splitBlock()
        if (result) {
          editor.view.dispatch(editor.state.tr.setStoredMarks([]))
        }
        return result
      },
    }
  },
})

// 코드블럭·인용 블럭 안에서 Shift+Enter → 블럭 바깥에 단락 삽입
const ShiftEnterExit = Extension.create({
  name: 'shiftEnterExit',
  priority: 150,
  addKeyboardShortcuts() {
    return {
      'Shift-Enter': ({ editor }) => {
        const { state } = editor
        const { $from } = state.selection
        const exitableTypes = ['codeBlock', 'blockquote']
        let depth = $from.depth
        while (depth > 0 && !exitableTypes.includes($from.node(depth).type.name)) depth--
        if (!exitableTypes.includes($from.node(depth).type.name)) return false
        const blockEnd = $from.after(depth)
        const para = state.schema.nodes.paragraph.create()
        const tr = state.tr.insert(blockEnd, para)
        tr.setSelection(TextSelection.create(tr.doc, blockEnd + 1))
        editor.view.dispatch(tr)
        return true
      },
    }
  },
})

// 첫 번째 H1(제목)에서 Enter → 본문 단락 생성, 본문 첫 빈 단락에서 Backspace → 제목으로 이동
const TitleKeyboardBehavior = Extension.create({
  name: 'titleKeyboardBehavior',
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor
        const { $from } = state.selection
        const firstNode = state.doc.firstChild
        if (
          !firstNode ||
          $from.parent.type.name !== 'heading' ||
          $from.parent.attrs.level !== 1 ||
          $from.before() !== 0
        ) return false

        const headingSize = firstNode.nodeSize
        const para = state.schema.nodes.paragraph.create()
        const tr = state.tr.insert(headingSize, para)
        tr.setSelection(TextSelection.create(tr.doc, headingSize + 1))
        editor.view.dispatch(tr)
        return true
      },

      Backspace: ({ editor }) => {
        const { state } = editor
        const { $from, empty } = state.selection
        if (!empty) return false

        const firstNode = state.doc.firstChild
        if (!firstNode || firstNode.type.name !== 'heading') return false

        // 첫 번째 H1 안에서 맨 앞에 있을 때: heading 삭제/변환 방지
        if (
          $from.parent.type.name === 'heading' &&
          $from.parent.attrs.level === 1 &&
          $from.before() === 0 &&
          $from.parentOffset === 0
        ) return true  // 이벤트 소비 → heading 보호

        // 첫 번째 H1 바로 다음 빈 단락에서: 제목으로 이동
        if (
          $from.parent.type.name !== 'paragraph' ||
          $from.parent.content.size !== 0 ||
          $from.depth !== 1 ||
          $from.before() !== firstNode.nodeSize
        ) return false

        const tr = state.tr.delete($from.before(), $from.after())
        tr.setSelection(TextSelection.create(tr.doc, firstNode.nodeSize - 1))
        editor.view.dispatch(tr)
        return true
      },
    }
  },
})

interface EditorProps {
  content: string
  saving: boolean
  isDirty: boolean
  onUpdate: (markdown: string) => void
  onSave: (markdown: string) => void
  onWikilinkClick: (title: string) => void
}

export function Editor({ content, saving, isDirty, onUpdate, onSave, onWikilinkClick }: EditorProps) {
  const [tableMenuPos, setTableMenuPos] = useState<TableMenuPos | null>(null)
  const hoveredTableRef = useRef<HTMLElement | null>(null)
  const hideTableMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHideTimer = () => {
    if (hideTableMenuTimer.current) {
      clearTimeout(hideTableMenuTimer.current)
      hideTableMenuTimer.current = null
    }
  }

  const scheduleHideTableMenu = () => {
    clearHideTimer()
    hideTableMenuTimer.current = setTimeout(() => {
      setTableMenuPos(null)
      hoveredTableRef.current = null
    }, 200)
  }

  const handleWrapperMouseMove = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const tableWrapper = target.closest?.('.tableWrapper') as HTMLElement | null
    if (tableWrapper) {
      clearHideTimer()
      if (hoveredTableRef.current !== tableWrapper) {
        hoveredTableRef.current = tableWrapper
        const rect = tableWrapper.getBoundingClientRect()
        setTableMenuPos({ top: rect.top - 36, left: rect.left })
      }
    } else {
      scheduleHideTableMenu()
    }
  }, [])

  const handleWrapperMouseLeave = useCallback(() => {
    scheduleHideTableMenu()
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({ linkify: false }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading' && node.attrs.level === 1) return '제목 없음'
          return ''
        },
        showOnlyCurrent: true,
      }),
      ClearMarksOnEnter,
      ShiftEnterExit,
      TitleKeyboardBehavior,
      AutoPair,
      Collapsible,
      CollapsibleSummary,
      CollapsibleContent,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      WikilinkDecorator,
      TagDecorator,
      SlashCommandExtension,
    ],
    content,
    editorProps: {
      attributes: { class: 'tiptap-editor' },
      handleClick(_view, _pos, event) {
        const target = event.target as HTMLElement
        const wikilink = target.closest?.('.wikilink') as HTMLElement | null
        if (wikilink) {
          event.preventDefault()
          const title = wikilink.getAttribute('data-title')
          if (title) onWikilinkClick(title)
          return true
        }
        return false
      },
      handleDrop(view, event) {
        const fileName = event.dataTransfer?.getData('text/papyrus-file')
        if (!fileName) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (!pos) return false
        view.dispatch(view.state.tr.insertText(`[[${fileName}]]`, pos.pos))
        return true
      },
    },
    onUpdate({ editor }) {
      const markdown = editor.storage.markdown.getMarkdown()
      onUpdate(markdown)
    },
  })

  // Ctrl+S 즉시 저장
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (editor) onSave(editor.storage.markdown.getMarkdown())
      }
    },
    [editor, onSave]
  )

  const tableActions: { label: string; action: () => void; danger?: boolean }[] = [
    { label: '행 추가', action: () => editor?.chain().focus().addRowAfter().run() },
    { label: '열 추가', action: () => editor?.chain().focus().addColumnAfter().run() },
    { label: '행 삭제', action: () => editor?.chain().focus().deleteRow().run() },
    { label: '열 삭제', action: () => editor?.chain().focus().deleteColumn().run() },
    { label: '테이블 삭제', action: () => { editor?.chain().focus().deleteTable().run(); setTableMenuPos(null) }, danger: true },
  ]

  return (
    <div
      className="editor-wrap"
      onKeyDown={handleKeyDown}
      onMouseMove={handleWrapperMouseMove}
      onMouseLeave={handleWrapperMouseLeave}
    >
      <EditorContent editor={editor} style={{ width: '100%', maxWidth: 720 }} />
      <div className={`editor-statusbar${saving ? ' saving' : ''}`}>
        {saving ? '저장 중...' : isDirty ? '● 저장되지 않음' : '저장됨'}
      </div>
      {tableMenuPos && (
        <div
          className="table-toolbar"
          style={{ top: tableMenuPos.top, left: tableMenuPos.left }}
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHideTableMenu}
        >
          {tableActions.map(({ label, action, danger }) => (
            <button
              key={label}
              className={`table-toolbar-btn${danger ? ' danger' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); action() }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
