import type { SearchResult, FileNode } from '../../types'
import './Search.css'

interface SearchProps {
  query: string
  results: SearchResult[]
  searching: boolean
  selectedPath: string | null
  onQueryChange: (q: string) => void
  onFileSelect: (file: FileNode) => void
}

function HighlightedExcerpt({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function Search({ query, results, searching, selectedPath, onQueryChange, onFileSelect }: SearchProps) {
  return (
    <div className="search-panel">
      <div className="search-input-wrap">
        <svg className="search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
        </svg>
        <input
          className="search-input"
          type="text"
          placeholder="검색..."
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          autoFocus
        />
        {query && (
          <button className="search-clear" onClick={() => onQueryChange('')}>×</button>
        )}
      </div>

      <div className="search-results">
        {searching && <p className="search-status">검색 중...</p>}
        {!searching && query && results.length === 0 && (
          <p className="search-status">결과 없음</p>
        )}
        {results.map(result => (
          <div
            key={result.file.path}
            className={`search-result-item${selectedPath === result.file.path ? ' selected' : ''}`}
            onClick={() => onFileSelect(result.file)}
          >
            <p className="search-result-name">{result.file.name.replace(/\.md$/, '')}</p>
            <p className="search-result-excerpt">
              <HighlightedExcerpt text={result.excerpt} query={query} />
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
