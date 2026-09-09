import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { exitSuggestion } from '@tiptap/suggestion'
import type { SuggestionProps } from '@tiptap/suggestion'
import { filterWikilinkOptions, vaultRelativePath, validNewNoteName } from '../../lib/wikilinks'
import type { WikilinkOption } from '../../lib/wikilinks'
import './WikilinkSuggestion.css'

interface Options {
  notes: WikilinkOption[]
  currentPath: string
  label: string
  empty: string
  create?: (name: string) => Promise<WikilinkOption>
  createLabel: (name: string) => string
  createError: string
}
const key = new PluginKey('wikilinkSuggestion')

export function createWikilinkSuggestion(getOptions: () => Options) {
  return Extension.create({
    name: 'wikilinkSuggestion',
    priority: 200,
    addProseMirrorPlugins() {
      return [Suggestion<WikilinkOption, WikilinkOption>({
        editor: this.editor,
        pluginKey: key,
        char: '[[',
        allowSpaces: true,
        allowedPrefixes: null,
        allow: ({ state }) => !state.selection.$from.parent.type.spec.code
          && !(state.storedMarks ?? state.selection.$from.marks()).some(mark => mark.type.spec.code),
        findSuggestionMatch: ({ $position }) => {
          const before = $position.parent.textBetween(0, $position.parentOffset, '\ufffc', '\ufffc')
          const match = /\[\[([^[\]\n\ufffc]*)$/.exec(before)
          if (!match || (match.index > 0 && before[match.index - 1] === '\\')) return null
          return { range: { from: $position.pos - match[0].length, to: $position.pos }, query: match[1], text: match[0] }
        },
        items: ({ query }) => {
          const options = getOptions()
          const items = filterWikilinkOptions(options.notes, query, options.currentPath)
          const name = validNewNoteName(query)
          if (options.create && !items.length && name && !options.notes.some(note => note.title.normalize('NFC').toLocaleLowerCase() === name.normalize('NFC').toLocaleLowerCase())) {
            items.push({ title: name, target: name, path: `${options.currentPath.slice(0, options.currentPath.lastIndexOf('/'))}/${name}.md`, context: '', create: true })
          }
          return items
        },
        command: ({ editor, range, props }) => {
          const $to = editor.state.doc.resolve(range.to)
          const after = $to.parent.textBetween($to.parentOffset, $to.parent.content.size, '\ufffc', '\ufffc')
          // Replace the rest of an existing link, including AutoPair's closing brackets.
          const suffix = /^(?:[^[\]\n\ufffc]*\]\]|\]{1,2})/.exec(after)?.[0] ?? ''
          editor.chain().focus().insertContentAt({ from: range.from, to: range.to + suffix.length }, { type: 'text', text: `[[${props.target}]]` }).run()
        },
        render: () => {
          let menu: HTMLDivElement | null = null
          let unmount: (() => void) | null = null
          let current: SuggestionProps<WikilinkOption, WikilinkOption> | null = null
          let selected = 0
          let previousQuery = ''
          let pending = false
          const dismiss = () => { if (current) exitSuggestion(current.editor.view, key) }

          async function choose(props: SuggestionProps<WikilinkOption, WikilinkOption>, item: WikilinkOption) {
            if (pending) return
            if (!item.create) { props.command(item); return }
            const create = getOptions().create
            if (!create) return
            pending = true
            menu?.setAttribute('aria-busy', 'true')
            const doc = props.editor.state.doc
            try {
              const note = await create(item.title)
              if (!props.editor.isDestroyed && current?.query === props.query && current.range.from === props.range.from && props.editor.state.doc.eq(doc)) props.command(note)
            } catch {
              if (menu) {
                const error = document.createElement('p')
                error.className = 'wikilink-empty'
                error.setAttribute('role', 'alert')
                error.textContent = getOptions().createError
                menu.append(error)
              }
            } finally {
              pending = false
              menu?.removeAttribute('aria-busy')
            }
          }

          function highlight() {
            menu?.querySelectorAll<HTMLButtonElement>('.wikilink-option').forEach((button, index) => {
              button.classList.toggle('selected', index === selected)
              button.setAttribute('aria-selected', String(index === selected))
              if (index === selected) button.scrollIntoView({ block: 'nearest' })
            })
          }
          function update(props: SuggestionProps<WikilinkOption, WikilinkOption>) {
            current = props
            if (previousQuery !== props.query) selected = 0
            previousQuery = props.query
            selected = Math.min(selected, Math.max(0, props.items.length - 1))
            if (!menu) return
            menu.replaceChildren()
            menu.setAttribute('aria-label', getOptions().label)
            if (!props.items.length) {
              const empty = document.createElement('p')
              empty.className = 'wikilink-empty'
              empty.textContent = getOptions().empty
              menu.append(empty)
            }
            props.items.forEach((item, index) => {
              const button = document.createElement('button')
              button.type = 'button'
              button.className = 'wikilink-option'
              button.setAttribute('role', 'option')
              const title = document.createElement('span')
              title.className = 'wikilink-option-title'
              title.textContent = item.create ? getOptions().createLabel(item.title) : item.title
              if (item.create) button.classList.add('wikilink-create')
              button.dataset.tooltip = vaultRelativePath(item.path)
              button.append(title)
              if (item.context) {
                const path = document.createElement('span')
                path.className = 'wikilink-option-path'
                path.textContent = item.context
                button.append(path)
              }
              button.onmousedown = event => event.preventDefault()
              button.onclick = () => { void choose(props, item) }
              button.onmouseenter = () => { selected = index; highlight() }
              menu!.append(button)
            })
            highlight()
          }
          return {
            onStart: props => {
              selected = 0
              menu = document.createElement('div')
              menu.className = 'wikilink-menu'
              menu.setAttribute('role', 'listbox')
              update(props)
              unmount = props.mount(menu)
              props.editor.on('blur', dismiss)
            },
            onUpdate: update,
            onKeyDown: ({ event, view }) => {
              if (event.isComposing || view.composing || event.keyCode === 229) return false
              if (!current?.items.length) return false
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + current.items.length) % current.items.length
                highlight()
                return true
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                void choose(current, current.items[selected])
                return true
              }
              return false
            },
            onExit: () => { current?.editor.off('blur', dismiss); unmount?.(); unmount = null; menu = null; current = null },
          }
        },
      })]
    },
  })
}
