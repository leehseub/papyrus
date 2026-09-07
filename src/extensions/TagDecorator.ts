import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// 줄 시작 # (헤딩)은 TipTap이 이미 heading 노드로 처리하므로
// 텍스트 노드에서 #태그 패턴만 탐색
const TAG_RE = /(?<![&\w])#([a-zA-Z가-힣0-9_/-]+)/g

export const TagDecorator = Extension.create({
  name: 'tagDecorator',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tagDecorator'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = []

            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return
              TAG_RE.lastIndex = 0
              let match
              while ((match = TAG_RE.exec(node.text)) !== null) {
                const from = pos + match.index
                const to = from + match[0].length
                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'tag-inline',
                    'data-tag': match[1],
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
