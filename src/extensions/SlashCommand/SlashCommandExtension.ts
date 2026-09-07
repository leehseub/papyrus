import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { SlashMenu } from './SlashMenu'
import type { SlashMenuRef } from './SlashMenu'
import { filterCommands, getCommands } from './commands'
import type { SlashCommand } from './commands'
import type { Locale } from '../../hooks/useLocale'

export function createSlashCommandExtension(locale: Locale) {
  return Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        startOfLine: false,

        items({ query }) {
          return filterCommands(query, locale)
        },

        render() {
          let container: HTMLDivElement | null = null
          let root: ReturnType<typeof createRoot> | null = null
          let menuRef: SlashMenuRef | null = null

          function applyPosition(rect: DOMRect, el: HTMLDivElement) {
            const OFFSET = 4
            const left = Math.max(0, Math.min(rect.left, window.innerWidth - 244))
            el.style.left = `${left}px`
            el.style.top = `${rect.bottom + OFFSET}px`
            el.style.opacity = '0'

            requestAnimationFrame(() => {
              const menuEl = el.firstElementChild as HTMLElement | null
              const actualH = menuEl ? menuEl.offsetHeight : 320
              const spaceBelow = window.innerHeight - rect.bottom - OFFSET
              const spaceAbove = rect.top - OFFSET

              if (spaceBelow >= actualH) {
                el.style.top = `${rect.bottom + OFFSET}px`
              } else if (spaceAbove >= actualH) {
                el.style.top = `${rect.top - actualH - OFFSET}px`
              } else {
                // 위아래 모두 부족 — 뷰포트 하단에 클램핑
                el.style.top = `${Math.max(OFFSET, window.innerHeight - actualH - OFFSET)}px`
              }
              el.style.opacity = ''
            })
          }

          return {
            onStart(props) {
              container = document.createElement('div')
              container.style.position = 'fixed'
              container.style.zIndex = '9999'
              document.body.appendChild(container)

              root = createRoot(container)
              root.render(
                createElement(SlashMenu, {
                  ref: (el: SlashMenuRef | null) => { menuRef = el },
                  items: props.items as SlashCommand[],
                  command: (item: SlashCommand) => {
                    props.command({ id: item.title })
                  },
                })
              )

              if (props.clientRect) {
                const rect = props.clientRect()
                if (rect && container) applyPosition(rect, container)
              }
            },

            onUpdate(props) {
              if (!root || !container) return

              root.render(
                createElement(SlashMenu, {
                  ref: (el: SlashMenuRef | null) => { menuRef = el },
                  items: props.items as SlashCommand[],
                  command: (item: SlashCommand) => {
                    props.command({ id: item.title })
                  },
                })
              )

              if (props.clientRect) {
                const rect = props.clientRect()
                if (rect && container) applyPosition(rect, container)
              }
            },

            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                props.event.preventDefault()
                return true
              }
              return menuRef?.onKeyDown(props.event) ?? false
            },

            onExit() {
              if (root) {
                root.unmount()
                root = null
              }
              if (container) {
                container.remove()
                container = null
              }
              menuRef = null
            },
          }
        },

        command({ editor, range, props }) {
          const item = getCommands(locale).find(c => c.title === props.id)
          if (!item) return
          editor.chain().focus().deleteRange(range).run()
          item.action(editor)
        },
      }),
    ]
  },
})
}
