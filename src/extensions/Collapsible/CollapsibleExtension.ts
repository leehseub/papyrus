import { Node, mergeAttributes } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    collapsible: {
      insertCollapsible: () => ReturnType
    }
  }
}

// ─── CollapsibleSummary ───────────────────────────────────────────────────────

export const CollapsibleSummary = Node.create({
  name: 'collapsibleSummary',
  content: 'inline*',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'summary' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ({ getPos, editor }) => {
      const dom = document.createElement('div')
      dom.className = 'collapsible-summary-row'

      const toggle = document.createElement('button')
      toggle.className = 'collapsible-toggle'
      toggle.contentEditable = 'false'
      toggle.tabIndex = -1
      toggle.setAttribute('aria-label', '토글')
      toggle.innerHTML =
        '<svg viewBox="0 0 8 8" width="8" height="8" fill="currentColor"><path d="M1.5 2.5l2.5 3 2.5-3z"/></svg>'

      toggle.addEventListener('mousedown', (e) => {
        e.preventDefault()
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (pos === undefined) return
        const $pos = editor.state.doc.resolve(pos)
        for (let d = $pos.depth; d > 0; d--) {
          const n = $pos.node(d)
          if (n.type.name === 'collapsible') {
            const before = $pos.before(d)
            editor.view.dispatch(
              editor.view.state.tr.setNodeMarkup(before, undefined, {
                ...n.attrs,
                open: !n.attrs.open,
              })
            )
            return
          }
        }
      })

      const deleteBtn = document.createElement('button')
      deleteBtn.className = 'collapsible-delete'
      deleteBtn.contentEditable = 'false'
      deleteBtn.tabIndex = -1
      deleteBtn.setAttribute('aria-label', '토글 블록 삭제')
      deleteBtn.textContent = '×'

      deleteBtn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (pos === undefined) return
        const $pos = editor.state.doc.resolve(pos)
        for (let d = $pos.depth; d > 0; d--) {
          const n = $pos.node(d)
          if (n.type.name === 'collapsible') {
            const before = $pos.before(d)
            const after = before + n.nodeSize
            const { state } = editor
            const tr = state.tr.delete(before, after)
            // If doc is now empty, insert a paragraph
            if (tr.doc.content.size === 0) {
              tr.insert(0, state.schema.nodes.paragraph.create())
            }
            editor.view.dispatch(tr)
            return
          }
        }
      })

      const text = document.createElement('div')
      text.className = 'collapsible-summary-text'

      dom.appendChild(toggle)
      dom.appendChild(text)
      dom.appendChild(deleteBtn)

      return { dom, contentDOM: text }
    }
  },
})

// ─── CollapsibleContent ───────────────────────────────────────────────────────

export const CollapsibleContent = Node.create({
  name: 'collapsibleContent',
  content: 'block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-collapsible-content]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-collapsible-content': '' }), 0]
  },
})

// ─── Collapsible ──────────────────────────────────────────────────────────────

export const Collapsible = Node.create({
  name: 'collapsible',
  group: 'block',
  content: 'collapsibleSummary collapsibleContent',
  defining: true,
  // Higher priority ensures Enter/Backspace handlers run before ClearMarksOnEnter
  priority: 200,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (el) => el.getAttribute('data-open') !== 'false',
        renderHTML: (attrs) => ({ 'data-open': String(attrs.open) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'details' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, { 'data-open': String(node.attrs.open) }),
      0,
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'collapsible-block'
      dom.setAttribute('data-open', String(node.attrs.open))

      const inner = document.createElement('div')
      inner.className = 'collapsible-inner'
      dom.appendChild(inner)

      return {
        dom,
        contentDOM: inner,
        update(updatedNode) {
          if (updatedNode.type.name !== 'collapsible') return false
          dom.setAttribute('data-open', String(updatedNode.attrs.open))
          return true
        },
      }
    }
  },

  addCommands() {
    return {
      insertCollapsible: () => ({ commands }) =>
        commands.insertContent({
          type: this.name,
          attrs: { open: true },
          content: [
            { type: 'collapsibleSummary', content: [] },
            { type: 'collapsibleContent', content: [{ type: 'paragraph' }] },
          ],
        }),
    }
  },

  addKeyboardShortcuts() {
    return {
      // Enter in summary → jump into content
      // Enter in last empty content block → exit collapsible (insert paragraph after)
      Enter: ({ editor }) => {
        const { state } = editor
        const { $from, empty } = state.selection
        if (!empty) return false

        // In summary → jump to content
        if ($from.parent.type.name === 'collapsibleSummary') {
          const afterSummary = $from.after($from.depth)
          try {
            const $target = state.doc.resolve(afterSummary + 1)
            editor.view.dispatch(state.tr.setSelection(TextSelection.near($target)))
          } catch { /* out of range */ }
          return true
        }

        // In empty last block of collapsibleContent → exit to paragraph after collapsible
        if ($from.depth >= 3 && $from.parent.content.size === 0) {
          const enclosing = $from.node($from.depth - 1)
          if (enclosing.type.name === 'collapsibleContent') {
            // Check this is the last block
            const contentEnd = $from.start($from.depth - 1) + enclosing.content.size
            if ($from.after($from.depth) === contentEnd) {
              const collapsible = $from.node($from.depth - 2)
              if (collapsible.type.name === 'collapsible') {
                const collapsibleStart = $from.before($from.depth - 2)
                const collapsibleEnd = collapsibleStart + collapsible.nodeSize
                const emptyParaSize = $from.after($from.depth) - $from.before($from.depth)
                const tr = state.tr.delete($from.before($from.depth), $from.after($from.depth))
                const insertPos = collapsibleEnd - emptyParaSize
                const para = state.schema.nodes.paragraph.create()
                tr.insert(insertPos, para)
                tr.setSelection(TextSelection.create(tr.doc, insertPos + 1))
                editor.view.dispatch(tr)
                return true
              }
            }
          }
        }

        return false
      },

      // Shift+Enter anywhere in collapsible → exit to paragraph after collapsible
      'Shift-Enter': ({ editor }) => {
        const { state } = editor
        const { $from } = state.selection
        let depth = $from.depth
        while (depth > 0 && $from.node(depth).type.name !== 'collapsible') depth--
        if ($from.node(depth).type.name !== 'collapsible') return false
        const collapsibleEnd = $from.after(depth)
        const para = state.schema.nodes.paragraph.create()
        const tr = state.tr.insert(collapsibleEnd, para)
        tr.setSelection(TextSelection.create(tr.doc, collapsibleEnd + 1))
        editor.view.dispatch(tr)
        return true
      },

      // Backspace in empty summary → delete entire collapsible
      // Backspace at start of first content block → back to summary
      Backspace: ({ editor }) => {
        const { state } = editor
        const { $from, empty } = state.selection
        if (!empty || $from.parentOffset !== 0) return false
        if ($from.depth < 2) return false

        // Empty summary → delete entire collapsible, replace with empty paragraph
        if ($from.parent.type.name === 'collapsibleSummary' && $from.parent.content.size === 0) {
          const collapsible = $from.node($from.depth - 1)
          if (collapsible.type.name !== 'collapsible') return false
          const collapsibleStart = $from.before($from.depth - 1)
          const para = state.schema.nodes.paragraph.create()
          const tr = state.tr.replaceWith(collapsibleStart, collapsibleStart + collapsible.nodeSize, para)
          tr.setSelection(TextSelection.create(tr.doc, collapsibleStart + 1))
          editor.view.dispatch(tr)
          return true
        }

        // Start of first block in collapsibleContent → move to end of summary
        const enclosingNode = $from.node($from.depth - 1)
        if (enclosingNode.type.name !== 'collapsibleContent') return false
        if ($from.before($from.depth) !== $from.start($from.depth - 1)) return false
        const beforeContent = $from.before($from.depth - 1)
        try {
          const $target = state.doc.resolve(beforeContent - 1)
          editor.view.dispatch(state.tr.setSelection(TextSelection.near($target, -1)))
        } catch { /* ignore */ }
        return true
      },
    }
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          // Preserve open/closed state via data-open attribute
          const openAttr = node.attrs.open ? '' : ' data-open="false"'
          state.write(`<details${openAttr}>\n<summary>`)
          if (node.firstChild) state.renderInline(node.firstChild)
          state.write('</summary>\n<div data-collapsible-content>\n\n')
          if (node.lastChild) state.renderContent(node.lastChild)
          state.write('\n</div>\n</details>\n\n')
        },
      },
    }
  },
})
