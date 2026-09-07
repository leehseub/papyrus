import type { Editor } from '@tiptap/core'

export interface SlashCommand {
  title: string
  description: string
  keywords: string[]
  action: (editor: Editor) => void
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    title: '제목 1',
    description: '큰 제목',
    keywords: ['h1', 'heading', '제목'],
    action: editor => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: '제목 2',
    description: '중간 제목',
    keywords: ['h2', 'heading', '제목'],
    action: editor => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: '제목 3',
    description: '작은 제목',
    keywords: ['h3', 'heading', '제목'],
    action: editor => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: '텍스트',
    description: '일반 단락',
    keywords: ['p', 'paragraph', '텍스트'],
    action: editor => editor.chain().focus().setParagraph().run(),
  },
  {
    title: '글머리 목록',
    description: '순서 없는 목록',
    keywords: ['ul', 'bullet', 'list', '목록'],
    action: editor => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: '번호 목록',
    description: '순서 있는 목록',
    keywords: ['ol', 'ordered', 'number', '번호'],
    action: editor => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: '인용',
    description: '인용 블록',
    keywords: ['quote', 'blockquote', '인용'],
    action: editor => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: '코드 블록',
    description: '코드 블록',
    keywords: ['code', 'codeblock', '코드'],
    action: editor => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: '구분선',
    description: '가로 구분선',
    keywords: ['hr', 'divider', 'rule', '구분선'],
    action: editor => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: '토글',
    description: '접힘/펼침 블록',
    keywords: ['toggle', 'collapsible', 'details', '토글', '접힘'],
    action: editor => editor.chain().focus().insertCollapsible().run(),
  },
  {
    title: '체크리스트',
    description: '할 일 목록',
    keywords: ['todo', 'task', 'checklist', 'checkbox', '체크', '할일'],
    action: editor => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: '테이블',
    description: '3×3 표 삽입',
    keywords: ['table', '표', '테이블'],
    action: editor => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
]

export function filterCommands(query: string): SlashCommand[] {
  if (!query) return SLASH_COMMANDS
  const lower = query.toLowerCase()
  return SLASH_COMMANDS.filter(
    cmd =>
      cmd.title.toLowerCase().includes(lower) ||
      cmd.keywords.some(k => k.includes(lower))
  )
}
