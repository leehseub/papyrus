import { flattenFiles } from '../lib/fileTree'
import { useState, useEffect, useCallback } from 'react'
import type { FSNode, SearchResult } from '../types'


function buildExcerpt(text: string, index: number, queryLen: number): string {
  const CONTEXT = 60
  const start = Math.max(0, index - CONTEXT)
  const end = Math.min(text.length, index + queryLen + CONTEXT)
  const excerpt = text.slice(start, end)
  return (start > 0 ? '...' : '') + excerpt + (end < text.length ? '...' : '')
}

export function useSearch(nodes: FSNode[]) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }

    setSearching(true)
    const files = flattenFiles(nodes)
    const lower = q.toLowerCase()
    const found: SearchResult[] = []

    await Promise.all(
      files.map(async file => {
        try {
          const f = await file.handle.getFile()
          const text = await f.text()
          const index = text.toLowerCase().indexOf(lower)
          if (index !== -1) {
            found.push({
              file,
              excerpt: buildExcerpt(text, index, q.length),
              matchStart: index,
              matchEnd: index + q.length,
            })
          }
        } catch {
          // 읽기 실패한 파일은 건너뜀
        }
      })
    )

    found.sort((a, b) => a.file.name.localeCompare(b.file.name))
    setResults(found)
    setSearching(false)
  }, [nodes])

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, runSearch])

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
  }, [])

  return { query, setQuery, results, searching, clear }
}
