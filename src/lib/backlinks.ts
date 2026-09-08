import type { FileNode } from '../types'
import { resolveWikilink } from './wikilinks'

export interface BacklinkExcerpt { line: number; text: string; before: string; after: string }

/** Ignore code examples while retaining source line numbers for context. */
export function findBacklinkExcerpts(text: string, files: FileNode[], source: string, target: string): BacklinkExcerpt[] {
  if (source === target) return []
  let fence = ''
  const lines = text.split(/\r?\n/)
  const contextLine = (index: number, direction: number) => {
    while (index >= 0 && index < lines.length && !lines[index].trim()) index += direction
    const line = lines[index]?.trim() ?? ''
    if (/^(`{3,}|~{3,})/.test(line)) return ''
    return line.replace(/\\([[\]])/g, '$1')
  }
  return lines.flatMap((raw, index) => {
    const marker = raw.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (marker) {
      if (!fence) fence = marker[1]
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = ''
      return []
    }
    if (fence || /^(?: {4}|\t)/.test(raw)) return []
    const line = raw.replace(/(`+).*?\1/g, '').replace(/\\([[\]])/g, '$1')
    const matches = [...line.matchAll(/\[\[([^\]\n]+)\]\]/g)]
    const match = matches.find(m => resolveWikilink(files, m[1], source)?.path === target)
    if (!match) return []
    const start = Math.max(0, match.index! - 70)
    const end = Math.min(line.length, match.index! + match[0].length + 100)
    return [{ line: index + 1, text: (start ? '…' : '') + line.slice(start, end).trim() + (end < line.length ? '…' : ''), before: contextLine(index - 1, -1), after: contextLine(index + 1, 1) }]
  })
}
