import type { Editor } from '@tiptap/core'
import type { Locale } from '../../hooks/useLocale'

export interface SlashCommand {
  title: string
  description: string
  keywords: string[]
  action: (editor: Editor) => void
}

type CommandDef = {
  ko: { title: string; description: string }
  en: { title: string; description: string }
  keywords: string[]
  action: (editor: Editor) => void
}

const COMMAND_DEFS: CommandDef[] = [
  {
    ko: { title: '제목 1', description: '큰 제목' },
    en: { title: 'Heading 1', description: 'Large heading' },
    keywords: ['h1', 'heading', '제목'],
    action: editor => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    ko: { title: '제목 2', description: '중간 제목' },
    en: { title: 'Heading 2', description: 'Medium heading' },
    keywords: ['h2', 'heading', '제목'],
    action: editor => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    ko: { title: '제목 3', description: '작은 제목' },
    en: { title: 'Heading 3', description: 'Small heading' },
    keywords: ['h3', 'heading', '제목'],
    action: editor => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    ko: { title: '텍스트', description: '일반 단락' },
    en: { title: 'Text', description: 'Plain paragraph' },
    keywords: ['p', 'paragraph', 'text', '텍스트'],
    action: editor => editor.chain().focus().setParagraph().run(),
  },
  {
    ko: { title: '글머리 목록', description: '순서 없는 목록' },
    en: { title: 'Bullet List', description: 'Unordered list' },
    keywords: ['ul', 'bullet', 'list', '목록'],
    action: editor => editor.chain().focus().toggleBulletList().run(),
  },
  {
    ko: { title: '번호 목록', description: '순서 있는 목록' },
    en: { title: 'Numbered List', description: 'Ordered list' },
    keywords: ['ol', 'ordered', 'number', '번호'],
    action: editor => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    ko: { title: '인용', description: '인용 블록' },
    en: { title: 'Quote', description: 'Blockquote' },
    keywords: ['quote', 'blockquote', '인용'],
    action: editor => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    ko: { title: '코드 블록', description: '코드 블록' },
    en: { title: 'Code Block', description: 'Code block' },
    keywords: ['code', 'codeblock', '코드'],
    action: editor => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    ko: { title: '구분선', description: '가로 구분선' },
    en: { title: 'Divider', description: 'Horizontal rule' },
    keywords: ['hr', 'divider', 'rule', '구분선'],
    action: editor => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    ko: { title: '토글', description: '접힘/펼침 블록' },
    en: { title: 'Toggle', description: 'Collapsible block' },
    keywords: ['toggle', 'collapsible', 'details', '토글', '접힘'],
    action: editor => editor.chain().focus().insertCollapsible().run(),
  },
  {
    ko: { title: '체크리스트', description: '할 일 목록' },
    en: { title: 'Checklist', description: 'To-do list' },
    keywords: ['todo', 'task', 'checklist', 'checkbox', '체크', '할일'],
    action: editor => editor.chain().focus().toggleTaskList().run(),
  },
  {
    ko: { title: '테이블', description: '3×3 표 삽입' },
    en: { title: 'Table', description: 'Insert 3×3 table' },
    keywords: ['table', '표', '테이블'],
    action: editor => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
]

export function getCommands(locale: Locale): SlashCommand[] {
  return COMMAND_DEFS.map(def => ({
    title: def[locale].title,
    description: def[locale].description,
    keywords: def.keywords,
    action: def.action,
  }))
}

export function filterCommands(query: string, locale: Locale): SlashCommand[] {
  const commands = getCommands(locale)
  if (!query) return commands
  const lower = query.toLowerCase()
  return commands.filter(
    cmd =>
      cmd.title.toLowerCase().includes(lower) ||
      cmd.keywords.some(k => k.includes(lower))
  )
}
