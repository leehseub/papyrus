import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

export const WikilinkDecorator = Extension.create({
  name: 'wikilinkDecorator',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wikilinkDecorator'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = []

            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return
              WIKILINK_RE.lastIndex = 0
              let match
              while ((match = WIKILINK_RE.exec(node.text)) !== null) {
                const from = pos + match.index
                const to = from + match[0].length
                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'wikilink',
                    'data-title': match[1],
                  })
                )
              }
            })

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
