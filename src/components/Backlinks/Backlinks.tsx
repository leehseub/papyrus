import { useEffect, useMemo, useState } from 'react'
import type { FileNode } from '../../types'
import type { Tab } from '../../hooks/useTabs'
import type { NoteLabel } from '../../lib/wikilinks'
import { resolveWikilink } from '../../lib/wikilinks'
import { findBacklinkExcerpts, type BacklinkExcerpt } from '../../lib/backlinks'
import { useT } from '../../contexts/LocaleContext'
import './Backlinks.css'

interface Props {
  files: FileNode[]
  tabs: Tab[]
  selectedPath: string | null
  labels: Map<string, NoteLabel>
  onSelect: (file: FileNode) => void
}

export function Backlinks({ files, tabs, selectedPath, labels, onSelect }: Props) {
  const t = useT()
  const [revision, setRevision] = useState(0)
  const [snapshot, setSnapshot] = useState<{ files: FileNode[]; revision: number; texts: Map<string, string>; errors: number } | null>(null)
  useEffect(() => {
    let cancelled = false
    async function scan() {
      const texts = new Map<string, string>()
      let errors = 0
      // Read sequentially to avoid flooding IPC for large vaults.
      for (const file of files) {
        if (cancelled) return
        try { texts.set(file.path, await (await file.handle.getFile()).text()) }
        catch { errors++ }
      }
      if (!cancelled) setSnapshot({ files, revision, texts, errors })
    }
    void scan()
    return () => { cancelled = true }
  }, [files, revision, tabs.length])
  const ready = snapshot?.files === files && snapshot.revision === revision
  const results = useMemo(() => {
    if (!ready || !selectedPath) return []
    const contents = new Map(snapshot.texts)
    // Open tabs are the current source of truth, including unsaved edits.
    for (const tab of tabs) contents.set(tab.file.path, tab.content)
    return files.flatMap(file => {
      const excerpts = findBacklinkExcerpts(contents.get(file.path) ?? '', files, file.path, selectedPath)
      return excerpts.length ? [{ file, excerpts }] : []
    }).sort((a, b) => a.file.path.localeCompare(b.file.path))
  }, [files, tabs, selectedPath, ready, snapshot])
  function excerptContent(text: string, source: string) {
    return text.split(/(\[\[[^\]]+\]\])/g).map((part, index) => {
      if (!part.startsWith('[[') || !part.endsWith(']]')) return part
      const link = part.slice(2, -2)
      const target = resolveWikilink(files, link, source)
      const label = target ? labels.get(target.path)?.title ?? link : link
      return target?.path === selectedPath ? <mark key={index}>{label}</mark> : <span key={index}>{label}</span>
    })
  }
  function renderExcerpt(excerpt: BacklinkExcerpt, source: string) {
    return <div key={excerpt.line} className="backlink-excerpt">
      {excerpt.before && <p className="backlink-surrounding">{excerptContent(excerpt.before, source)}</p>}
      <p className="backlink-matched">{excerptContent(excerpt.text, source)}</p>
      {excerpt.after && <p className="backlink-surrounding">{excerptContent(excerpt.after, source)}</p>}
    </div>
  }
  return <section className="backlinks-panel" aria-label={t.backlinks}>
    <div className="backlinks-header">
      <strong>{t.backlinks}</strong>
      <button className="refresh-btn" onClick={() => setRevision(v => v + 1)} disabled={!ready} aria-label={t.refresh} data-tooltip={t.refresh}>↻</button>
    </div>
    {selectedPath && <div className="backlinks-target" data-tooltip={labels.get(selectedPath)?.relativePath}>
      <span className="backlinks-eyebrow">{t.backlinksCurrent}</span>
      <strong>{labels.get(selectedPath)?.title}</strong>
      {labels.get(selectedPath)?.context && <span className="backlink-context">{labels.get(selectedPath)!.context}</span>}
      <span className="backlinks-summary">{ready ? t.backlinksSources(results.length) : t.loading}</span>
    </div>}
    <div className="backlinks-list" aria-busy={!ready}>
      {!selectedPath ? <p className="backlinks-status">{t.backlinksSelect}</p> : !ready ? <p className="backlinks-status" role="status">{t.loading}</p> : <>
        {snapshot.errors > 0 && <p className="backlinks-status" role="status">{t.backlinksReadError}</p>}
        {!results.length && <p className="backlinks-status">{t.backlinksEmpty}</p>}
        {results.map(({ file, excerpts }) => <article key={file.path} className="backlink-card">
          <button className="backlink-result" data-path={file.path} data-tooltip={labels.get(file.path)?.relativePath} onClick={() => onSelect(file)}>
            <span className="backlink-source">
              <span className="backlink-name">{labels.get(file.path)?.title ?? file.name}</span>
              {labels.get(file.path)?.context && <span className="backlink-context">{labels.get(file.path)!.context}</span>}
            </span>
            <span className="backlink-open" aria-hidden="true">↗</span>
          </button>
          {excerpts.slice(0, 2).map(excerpt => renderExcerpt(excerpt, file.path))}
          {excerpts.length > 2 && <details className="backlink-more">
            <summary>{t.backlinksMore(excerpts.length - 2)}</summary>
            {excerpts.slice(2).map(excerpt => renderExcerpt(excerpt, file.path))}
          </details>}
        </article>)}
      </>}
    </div>
  </section>
}
