import { useState } from 'react'
import type { TagMap } from '../../hooks/useTagIndex'
import type { FileNode } from '../../types'
import { Tooltip } from '../Tooltip/Tooltip'
import './TagPanel.css'

interface TagPanelProps {
  tagMap: TagMap
  indexing: boolean
  selectedPath: string | null
  onBuildIndex: () => void
  onFileSelect: (file: FileNode) => void
}

export function TagPanel({ tagMap, indexing, selectedPath, onBuildIndex, onFileSelect }: TagPanelProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const files = activeTag ? (tagMap.get(activeTag) ?? []) : []

  return (
    <div className="tag-panel">
      {/* 태그 목록 헤더 */}
      <div className="tag-panel-header">
        <span className="tag-panel-title">태그</span>
        <button
          className="tag-refresh-btn"
          onClick={onBuildIndex}
          disabled={indexing}
          title="태그 인덱스 갱신"
        >
          {indexing ? '스캔 중...' : '스캔'}
        </button>
      </div>

      {tagMap.size === 0 && !indexing && (
        <p className="tag-empty">"스캔" 버튼으로 태그를 불러오세요.</p>
      )}

      {/* 태그 목록 */}
      <div className="tag-list">
        {[...tagMap.entries()].map(([tag, tagFiles]) => (
          <Tooltip key={tag} content={`#${tag}`}>
            <button
              className={`tag-item${activeTag === tag ? ' active' : ''}`}
              onClick={() => setActiveTag(prev => prev === tag ? null : tag)}
            >
              <span className="tag-name">#{tag}</span>
              <span className="tag-count">{tagFiles.length}</span>
            </button>
          </Tooltip>
        ))}
      </div>

      {/* 선택된 태그의 파일 목록 */}
      {activeTag && (
        <div className="tag-file-list">
          <p className="tag-file-list-label">#{activeTag} ({files.length})</p>
          {files.map(file => (
            <div
              key={file.path}
              className={`tag-file-item${selectedPath === file.path ? ' selected' : ''}`}
              onClick={() => onFileSelect(file)}
            >
              {file.name.replace(/\.md$/, '')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
