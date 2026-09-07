import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'

const PAIRS: Record<string, string> = {
  '[': ']',
  '(': ')',
  '{': '}',
  '"': '"',
}

const CLOSERS = new Set(Object.values(PAIRS))

export const AutoPair = Extension.create({
  name: 'autoPair',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('autoPair'),
        props: {
          handleKeyDown(view, event) {
            const { state, dispatch } = view
            const { from, to, empty } = state.selection

            // Backspace on empty pair → delete both brackets
            if (event.key === 'Backspace' && empty && from > 0) {
              const prevChar = state.doc.textBetween(from - 1, from)
              const nextChar = state.doc.textBetween(from, Math.min(from + 1, state.doc.content.size))
              if (PAIRS[prevChar] && PAIRS[prevChar] === nextChar) {
                dispatch(state.tr.delete(from - 1, from + 1))
                return true
              }
            }

            // Skip-over closing char if next char already matches
            if (CLOSERS.has(event.key)) {
              if (empty) {
                const nextChar = state.doc.textBetween(from, Math.min(from + 1, state.doc.content.size))
                if (nextChar === event.key) {
                  dispatch(state.tr.setSelection(TextSelection.create(state.doc, from + 1)))
                  return true
                }
              }
            }

            const close = PAIRS[event.key]
            if (!close) return false

            if (empty) {
              const tr = state.tr.insertText(event.key + close, from)
              tr.setSelection(TextSelection.create(tr.doc, from + 1))
              dispatch(tr)
              return true
            }

            // Wrap selected text with pair
            const tr = state.tr
              .insertText(close, to)
              .insertText(event.key, from)
            tr.setSelection(TextSelection.create(tr.doc, from + 1, to + 1))
            dispatch(tr)
            return true
          },
        },
      }),
    ]
  },
})
