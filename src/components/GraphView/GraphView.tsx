import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react'
import { useT } from '../../contexts/LocaleContext'
import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge } from '../../hooks/useGraphData'
import type { NodeGroup } from '../../hooks/useGroups'
import { hullPath } from '../../hooks/useGroups'
import type { GroupLink } from '../../hooks/useGroupLinks'
import { Tooltip } from '../Tooltip/Tooltip'
import type { FileNode } from '../../types'
import './GraphView.css'

export type NodePositions = Map<string, { x: number; y: number }>

export interface GraphViewHandle {
  applyPositions: (positions: NodePositions) => void
}

interface GraphViewProps {
  graphData: GraphData | null
  building: boolean
  selectedPath: string | null
  onFileSelect: (file: FileNode) => void
  onBuild: () => void
  width: number
  onResizerMouseDown: (e: React.MouseEvent) => void
  onOpenInWindow: () => void
  groups: NodeGroup[]
  onCreateGroup: (name: string, paths: string[]) => void
  onDeleteGroup: (id: string) => void
  groupLinks: GroupLink[]
  onCreateGroupLink: (fromId: string, toType: 'group' | 'node', toId: string) => void
  onDeleteGroupLink: (id: string) => void
  onPositionsChange?: (positions: NodePositions) => void
}

export const GraphView = forwardRef<GraphViewHandle, GraphViewProps>(function GraphView({
  graphData, building, selectedPath, onFileSelect, onBuild,
  width, onResizerMouseDown, onOpenInWindow,
  groups, onCreateGroup, onDeleteGroup,
  groupLinks, onCreateGroupLink, onDeleteGroupLink,
  onPositionsChange,
}: GraphViewProps, ref) {
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const selRectDivRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const didDragRef = useRef(false)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const savedTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)
  const savedPositionsRef = useRef<NodePositions>(new Map())
  const nodeGroupRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null)
  const linkSelRef = useRef<d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown> | null>(null)
  const hullGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const nodesDataRef = useRef<GraphNode[]>([])
  const selectedPathRef = useRef(selectedPath)
  const groupsRef = useRef(groups)
  const groupLinksRef = useRef(groupLinks)
  const groupLinkGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const selectedNodesRef = useRef(new Set<string>())
  const updateHullsRef = useRef<(() => void) | null>(null)
  const linkSourceRef = useRef<{ id: string; name: string } | null>(null)
  const onPositionsChangeRef = useRef(onPositionsChange)
  onPositionsChangeRef.current = onPositionsChange

  useImperativeHandle(ref, () => ({
    applyPositions(positions: NodePositions) {
      positions.forEach((pos, id) => {
        savedPositionsRef.current.set(id, pos)
        const node = nodesDataRef.current.find(n => n.id === id)
        if (node) { node.x = pos.x; node.y = pos.y; node.fx = pos.x; node.fy = pos.y }
      })
      nodeGroupRef.current?.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
      linkSelRef.current
        ?.attr('x1', d => (d.source as GraphNode).x ?? 0)
        .attr('y1', d => (d.source as GraphNode).y ?? 0)
        .attr('x2', d => (d.target as GraphNode).x ?? 0)
        .attr('y2', d => (d.target as GraphNode).y ?? 0)
      updateHullsRef.current?.()
    },
  }), [])

  const t = useT()
  const [selectionMode, setSelectionMode] = useState(false)
  const selectionModeRef = useRef(false)
  const [selectedNodes, setSelectedNodes] = useState(new Set<string>())
  const [newGroupName, setNewGroupName] = useState('')
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [highlightGroupId, setHighlightGroupId] = useState<string | null>(null)
  const [linkSource, setLinkSource] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => { selectedPathRef.current = selectedPath }, [selectedPath])
  useEffect(() => { selectionModeRef.current = selectionMode }, [selectionMode])
  // S키: 선택 모드 토글 / Escape: 선택 모드 종료
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (e.key === 's' || e.key === 'S') setSelectionMode(v => !v)
      else if (e.key === 'Escape') setSelectionMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { selectedNodesRef.current = selectedNodes }, [selectedNodes])
  useEffect(() => { linkSourceRef.current = linkSource }, [linkSource])
  groupsRef.current = groups
  groupLinksRef.current = groupLinks

  const draw = useCallback(() => {
    const svg = svgRef.current
    if (!svg || !graphData) return

    const { width: w, height: h } = svg.getBoundingClientRect()
    const { nodes, edges } = graphData

    // Restore saved positions before simulation
    nodes.forEach(node => {
      const saved = savedPositionsRef.current.get(node.id)
      if (saved) {
        node.x = saved.x; node.y = saved.y
        node.fx = saved.x; node.fy = saved.y
      }
    })

    d3.select(svg).selectAll('*').remove()

    // 화살촉 마커
    const defs = d3.select(svg).append('defs')
    defs.append('marker')
      .attr('id', 'glink-arrow')
      .attr('viewBox', '0 -4 8 8').attr('refX', 7).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4Z').attr('fill', 'var(--accent)')

    const root = d3.select(svg).append('g')

    // 선택 모드일 때 드래그 패닝 비활성화 (휠 줌은 유지)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .filter(event => {
        if (selectionModeRef.current && event.type === 'mousedown') return false
        return !event.button
      })
      .on('zoom', e => {
        root.attr('transform', e.transform)
        savedTransformRef.current = e.transform
      })
    d3.select(svg).call(zoom)
    // Restore previous zoom/pan
    if (savedTransformRef.current !== d3.zoomIdentity) {
      d3.select(svg).call(zoom.transform, savedTransformRef.current)
    }
    zoomRef.current = zoom

    const hullGroup = root.append('g').attr('class', 'hull-layer')
    hullGroupRef.current = hullGroup
    const groupLinkGroup = root.append('g').attr('class', 'group-link-layer')
    groupLinkGroupRef.current = groupLinkGroup

    const link = root.append('g').selectAll<SVGLineElement, GraphEdge>('line')
      .data(edges).join('line').attr('class', 'graph-edge')
    linkSelRef.current = link

    const nodeGroup = root.append('g').selectAll<SVGGElement, GraphNode>('g')
      .data(nodes).join('g')
      .attr('class', d => nodeClass(d.id))
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation()
        // 링크 연결 모드: 클릭한 노드를 대상으로 설정
        if (linkSourceRef.current) {
          onCreateGroupLink(linkSourceRef.current.id, 'node', d.id)
          setLinkSource(null)
          return
        }
        if (selectionModeRef.current) {
          if (event.ctrlKey || event.metaKey) {
            // Ctrl+클릭: 기존 선택에 추가/제거 토글
            setSelectedNodes(prev => {
              const next = new Set(prev)
              next.has(d.id) ? next.delete(d.id) : next.add(d.id)
              return next
            })
          } else {
            // 일반 클릭: 해당 노드 하나만 선택
            setSelectedNodes(new Set([d.id]))
          }
          return
        }
        // 일반 모드: 파일 열기 + 선택 해제
        setSelectedNodes(new Set())
        onFileSelect(d.fileNode)
        const svgEl = svgRef.current
        if (!svgEl || !zoomRef.current) return
        const { width: sw, height: sh } = svgEl.getBoundingClientRect()
        const t = d3.zoomTransform(svgEl)
        d3.select(svgEl).transition().duration(500).call(
          zoomRef.current.transform,
          d3.zoomIdentity.translate(sw / 2 - (d.x ?? 0) * t.k, sh / 2 - (d.y ?? 0) * t.k).scale(t.k)
        )
      })

    nodeGroupRef.current = nodeGroup
    nodesDataRef.current = nodes
    nodeGroup.append('circle').attr('r', d => d.id === selectedPathRef.current ? 8 : 5)
    nodeGroup.append('text').attr('dy', -10).attr('text-anchor', 'middle')
      .attr('class', 'graph-label').text(d => d.name)

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    let coNodes: { node: GraphNode; dx: number; dy: number }[] = []

    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (e, d) => {
        if (!e.active) simulation.alphaTarget(0.1).restart()
        d.fx = d.x; d.fy = d.y
        coNodes = []
        const sel = selectedNodesRef.current
        const movedIds = new Set([d.id])
        if (sel.has(d.id) && sel.size > 1) {
          ;[...sel].filter(id => id !== d.id).forEach(id => {
            const n = nodeMap.get(id)
            if (n) {
              n.fx = n.x; n.fy = n.y
              coNodes.push({ node: n, dx: (n.x ?? 0) - (d.x ?? 0), dy: (n.y ?? 0) - (d.y ?? 0) })
              movedIds.add(id)
            }
          })
        }
        // 움직이지 않는 노드 모두 고정
        for (const node of nodes) {
          if (!movedIds.has(node.id)) { node.fx = node.x; node.fy = node.y }
        }
      })
      .on('drag', (e, d) => {
        d.fx = e.x; d.fy = e.y
        for (const { node, dx, dy } of coNodes) { node.fx = e.x + dx; node.fy = e.y + dy }
      })
      .on('end', (e, d) => {
        if (!e.active) simulation.alphaTarget(0)
        coNodes = []
        resolveCollisions()
      })
    nodeGroup.call(drag)

    // ─── Hull ────────────────────────────────────────────
    // 그룹 요소 생성/삭제 + 레이블 드래그 등록 (그룹 변경 시 호출)
    function syncHullElements() {
      const hg = hullGroupRef.current
      if (!hg) return
      hg.selectAll<SVGPathElement, NodeGroup>('.group-hull')
        .data(groupsRef.current, g => g.id).join('path')
        .attr('class', 'group-hull')
        .attr('fill', g => `${g.color}28`)
        .attr('stroke', g => g.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '6 3')
        .attr('pointer-events', 'none')

      const labelSel = hg.selectAll<SVGGElement, NodeGroup>('.group-label-wrap')
        .data(groupsRef.current, g => g.id)
        .join(
          enter => {
            const g = enter.append('g').attr('class', 'group-label-wrap')
            g.append('rect').attr('class', 'group-label-bg').attr('rx', 4).attr('fill', 'transparent')
            g.append('text').attr('class', 'group-label').attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
            return g
          },
          update => update,
          exit => exit.remove()
        )
        .attr('pointer-events', 'all')
        .style('cursor', 'grab')

      labelSel.select<SVGTextElement>('text')
        .attr('fill', g => g.color)
        .attr('font-size', 11)
        .text(g => g.name)

      labelSel.select<SVGRectElement>('rect')
        .attr('width', g => Math.max(g.name.length * 7 + 20, 52))
        .attr('height', 22)
        .attr('x', g => -(Math.max(g.name.length * 7 + 20, 52) / 2))
        .attr('y', -11)
        .attr('fill', g => `${g.color}28`)
        .attr('stroke', g => `${g.color}99`)
        .attr('stroke-width', 1)

      // 그룹 레이블 드래그 → 그룹 전체 노드 이동
      const groupDrag = d3.drag<SVGGElement, NodeGroup>()
        .on('start', (ev, g) => {
          if (!ev.active) simulation.alphaTarget(0.1).restart()
          const groupIds = new Set(g.paths)
          g.paths.forEach(id => { const n = nodeMap.get(id); if (n) { n.fx = n.x; n.fy = n.y } })
          // 그룹 외 노드 고정
          for (const node of nodes) {
            if (!groupIds.has(node.id)) { node.fx = node.x; node.fy = node.y }
          }
        })
        .on('drag', (ev, g) => {
          g.paths.forEach(id => {
            const n = nodeMap.get(id)
            if (n) { n.fx = (n.fx ?? n.x ?? 0) + ev.dx; n.fy = (n.fy ?? n.y ?? 0) + ev.dy }
          })
        })
        .on('end', (ev, g) => {
          if (!ev.active) simulation.alphaTarget(0)
          resolveCollisions()
        })
      labelSel.call(groupDrag)
    }

    // 위치만 업데이트 (tick마다 호출)
    function updateHullPositions() {
      const hg = hullGroupRef.current
      if (!hg) return
      const positions = new Map<string, [number, number]>()
      nodeGroupRef.current?.each(d => positions.set(d.id, [d.x ?? 0, d.y ?? 0]))

      hg.selectAll<SVGPathElement, NodeGroup>('.group-hull')
        .attr('d', g => hullPath(
          g.paths.flatMap(id => { const p = positions.get(id); return p ? [p] : [] }), 22
        ))

      hg.selectAll<SVGGElement, NodeGroup>('.group-label-wrap')
        .attr('transform', g => {
          const xs = g.paths.flatMap(id => { const p = positions.get(id); return p ? [p[0]] : [] })
          const ys = g.paths.flatMap(id => { const p = positions.get(id); return p ? [p[1]] : [] })
          const x = xs.length ? d3.mean(xs)! : 0
          const y = ys.length ? Math.min(...ys) - 26 : 0
          return `translate(${x},${y})`
        })

      // 그룹 링크 화살표 위치 업데이트
      function getCentroid(type: 'group' | 'node', id: string): [number, number] | null {
        if (type === 'node') return positions.get(id) ?? null
        const grp = groupsRef.current.find(g => g.id === id)
        if (!grp) return null
        const pts = grp.paths.flatMap(pid => { const p = positions.get(pid); return p ? [p] : [] })
        if (!pts.length) return null
        return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
      }

      const glg = groupLinkGroupRef.current
      if (glg) {
        glg.selectAll<SVGLineElement, GroupLink>('.group-link-line')
          .data(groupLinksRef.current, l => l.id)
          .join('line')
          .attr('class', 'group-link-line')
          .attr('stroke', 'var(--accent)')
          .attr('stroke-width', 1.5)
          .attr('stroke-opacity', 0.55)
          .attr('stroke-dasharray', '6 3')
          .attr('marker-end', 'url(#glink-arrow)')
          .attr('pointer-events', 'none')
          .each(function(l) {
            const from = getCentroid('group', l.fromId)
            const to = getCentroid(l.toType, l.toId)
            d3.select(this)
              .attr('visibility', from && to ? 'visible' : 'hidden')
              .attr('x1', from?.[0] ?? 0).attr('y1', from?.[1] ?? 0)
              .attr('x2', to?.[0] ?? 0).attr('y2', to?.[1] ?? 0)
          })
      }
    }

    function updateHulls() { syncHullElements(); updateHullPositions() }
    updateHullsRef.current = updateHulls
    syncHullElements()

    // 기하학적 겹침 해소 (물리 시뮬레이션 없음 → 진동 없음)
    function resolveCollisions() {
      const R = 12
      for (let pass = 0; pass < 5; pass++) {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j]
            const dx = (b.x ?? 0) - (a.x ?? 0)
            const dy = (b.y ?? 0) - (a.y ?? 0)
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
            if (dist >= R * 2) continue
            const push = (R * 2 - dist) / 2
            const nx = dx / dist, ny = dy / dist
            a.x = (a.x ?? 0) - nx * push; a.y = (a.y ?? 0) - ny * push
            b.x = (b.x ?? 0) + nx * push; b.y = (b.y ?? 0) + ny * push
          }
        }
      }
      for (const node of nodes) { node.fx = node.x; node.fy = node.y }
      link
        .attr('x1', d => (d.source as GraphNode).x ?? 0).attr('y1', d => (d.source as GraphNode).y ?? 0)
        .attr('x2', d => (d.target as GraphNode).x ?? 0).attr('y2', d => (d.target as GraphNode).y ?? 0)
      nodeGroup.attr('transform', n => `translate(${n.x ?? 0},${n.y ?? 0})`)
      updateHullPositions()
      // 드래그 완료 후 PiP 창과 좌표 동기화
      const positions: NodePositions = new Map()
      for (const n of nodes) {
        if (n.x !== undefined && n.y !== undefined) positions.set(n.id, { x: n.x, y: n.y })
      }
      onPositionsChangeRef.current?.(positions)
    }

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges).id(d => d.id).distance(240))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .on('tick', () => {
        // Save positions every tick so rebuild preserves layout
        nodes.forEach(n => {
          if (n.x !== undefined && n.y !== undefined) {
            savedPositionsRef.current.set(n.id, { x: n.x, y: n.y })
          }
        })
        link
          .attr('x1', d => (d.source as GraphNode).x ?? 0)
          .attr('y1', d => (d.source as GraphNode).y ?? 0)
          .attr('x2', d => (d.target as GraphNode).x ?? 0)
          .attr('y2', d => (d.target as GraphNode).y ?? 0)
        nodeGroup.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
        updateHullPositions()
      })

    function nodeClass(id: string) {
      const cls = ['graph-node']
      if (id === selectedPathRef.current) cls.push('current')
      if (selectedNodesRef.current.has(id)) cls.push('multi-selected')
      return cls.join(' ')
    }
  }, [graphData, onFileSelect])

  useEffect(() => { if (graphData) draw() }, [draw, graphData])


  useEffect(() => {
    const ng = nodeGroupRef.current
    if (!ng) return
    ng.attr('class', d => {
      const cls = ['graph-node']
      if (d.id === selectedPath) cls.push('current')
      if (selectedNodes.has(d.id)) cls.push('multi-selected')
      return cls.join(' ')
    })
    ng.selectAll<SVGCircleElement, GraphNode>('circle')
      .attr('r', d => d.id === selectedPath ? 8 : 5)
  }, [selectedPath, selectedNodes])

  useEffect(() => { updateHullsRef.current?.() }, [groups])
  useEffect(() => { updateHullsRef.current?.() }, [groupLinks])

  // ─── 고무밴드 선택: window 레벨 이벤트 ─────────────────
  useEffect(() => {
    if (!selectionMode) return

    function showSelRect(x0: number, y0: number, x1: number, y1: number) {
      const el = selRectDivRef.current
      const wrap = canvasWrapRef.current
      if (!el || !wrap) return
      const wr = wrap.getBoundingClientRect()
      el.style.display = 'block'
      el.style.left = `${Math.min(x0, x1) - wr.left}px`
      el.style.top = `${Math.min(y0, y1) - wr.top}px`
      el.style.width = `${Math.abs(x1 - x0)}px`
      el.style.height = `${Math.abs(y1 - y0)}px`
    }
    function hideSelRect() {
      if (selRectDivRef.current) selRectDivRef.current.style.display = 'none'
    }

    function onMouseMove(e: MouseEvent) {
      const start = dragStartRef.current
      if (!start) return
      showSelRect(start.x, start.y, e.clientX, e.clientY)
    }

    function onMouseUp(e: MouseEvent) {
      const start = dragStartRef.current
      if (!start) return
      dragStartRef.current = null
      didDragRef.current = true
      hideSelRect()

      const svg = svgRef.current
      if (!svg) return
      const t = d3.zoomTransform(svg)
      const svgRect = svg.getBoundingClientRect()

      const toGraph = (cx: number, cy: number) => ({
        gx: ((cx - svgRect.left) - t.x) / t.k,
        gy: ((cy - svgRect.top) - t.y) / t.k,
      })
      const a = toGraph(start.x, start.y)
      const b = toGraph(e.clientX, e.clientY)
      const x0 = Math.min(a.gx, b.gx), x1 = Math.max(a.gx, b.gx)
      const y0 = Math.min(a.gy, b.gy), y1 = Math.max(a.gy, b.gy)

      if (x1 - x0 > 4 || y1 - y0 > 4) {
        const inRect = nodesDataRef.current.filter(n =>
          (n.x ?? 0) >= x0 && (n.x ?? 0) <= x1 &&
          (n.y ?? 0) >= y0 && (n.y ?? 0) <= y1
        )
        if (inRect.length > 0) {
          // 드래그 선택은 기존 선택을 대체 (클릭은 토글 추가)
          setSelectedNodes(new Set(inRect.map(n => n.id)))
        }
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      if (selRectDivRef.current) selRectDivRef.current.style.display = 'none'
      dragStartRef.current = null
    }
  }, [selectionMode])

  useEffect(() => {
    const ng = nodeGroupRef.current
    if (!ng) return
    const hp = highlightGroupId
      ? new Set(groups.find(g => g.id === highlightGroupId)?.paths ?? [])
      : null
    ng.attr('class', d => {
      const cls = ['graph-node']
      if (d.id === selectedPath) cls.push('current')
      if (selectedNodes.has(d.id)) cls.push('multi-selected')
      if (hp?.has(d.id)) cls.push('group-highlighted')
      return cls.join(' ')
    })
  }, [highlightGroupId, groups, selectedPath, selectedNodes])

  function handleCreateGroup() {
    const name = newGroupName.trim() || `${t.groups} ${groups.length + 1}`
    onCreateGroup(name, [...selectedNodes])
    setSelectedNodes(new Set()); setNewGroupName(''); setShowGroupForm(false)
  }

  return (
    <aside className="graph-panel" style={{ width, minWidth: width }}>
      <div className="graph-resizer" onMouseDown={onResizerMouseDown} />

      <div className="graph-header">
        <span className="graph-title">{t.graphView}</span>
        <div className="graph-header-actions">
          <button className="graph-build-btn" onClick={onBuild} disabled={building}>
            {building ? t.analyzing : t.analyze}
          </button>
          <Tooltip content={selectionMode ? t.selectionModeOn : t.selectionModeOff}>
            <button
              className={`graph-float-btn${selectionMode ? ' active' : ''}`}
              onClick={() => setSelectionMode(v => !v)}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" strokeDasharray="4 2.5"/>
                <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
            </button>
          </Tooltip>
          <Tooltip content={t.openInWindow}>
            <button className="graph-float-btn" onClick={onOpenInWindow}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.5 1h6v1.5h-4v11h11v-4H16V14a1.5 1.5 0 0 1-1.5 1.5H1.5A1.5 1.5 0 0 1 0 14V2.5A1.5 1.5 0 0 1 1.5 1z"/>
                <path d="M9 1h6v6l-2-2-4 4-1.5-1.5 4-4L9 1z"/>
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>

      <div
        className="graph-canvas-wrap"
        ref={canvasWrapRef}
        onMouseDown={e => {
          if (!selectionMode) return
          if ((e.target as Element).closest('.graph-node')) return
          e.preventDefault()
          dragStartRef.current = { x: e.clientX, y: e.clientY }
        }}
        onClick={e => {
          if (!selectionMode) return
          if ((e.target as Element).closest('.graph-node')) return
          if (didDragRef.current) { didDragRef.current = false; return }
          setSelectedNodes(new Set())
        }}
      >
        {building && <p className="graph-status">{t.buildingGraph}</p>}
        {!building && !graphData && <p className="graph-status">{t.emptyGraph}</p>}
        {!building && graphData?.nodes.length === 0 && <p className="graph-status">{t.noFiles}</p>}
        <div ref={selRectDivRef} className="sel-rect-overlay" style={{ display: 'none' }} />
        <svg ref={svgRef} className={`graph-svg${selectionMode ? ' selection-mode' : ''}`} />
      </div>

      {selectedNodes.size > 0 && (
        <div className="graph-selection-bar">
          <span className="selection-count">{t.selectedCount(selectedNodes.size)}</span>
          <div className="selection-actions">
            {showGroupForm ? (
              <>
                <input
                  className="group-name-input"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') setShowGroupForm(false) }}
                  placeholder={t.groupNamePlaceholder}
                  autoFocus
                />
                <button className="graph-build-btn" onClick={handleCreateGroup}>{t.confirm}</button>
                <button className="graph-float-btn" onClick={() => setShowGroupForm(false)}>{t.cancel}</button>
              </>
            ) : (
              <>
                <button className="graph-build-btn" onClick={() => setShowGroupForm(true)}>{t.createGroup}</button>
                <button className="graph-float-btn" onClick={() => setSelectedNodes(new Set())}>{t.deselect}</button>
              </>
            )}
          </div>
        </div>
      )}

      {groups.length > 0 && (
        <div className="graph-groups">
          <p className="graph-groups-title">
            {linkSource ? <span className="link-mode-label">{t.connectTarget(linkSource.name)}</span> : t.groups}
            {linkSource && (
              <button className="group-link-cancel-btn" onClick={() => setLinkSource(null)}>{t.cancel}</button>
            )}
          </p>
          {linkSource && (
            <p className="link-mode-hint">{t.linkModeHint}</p>
          )}
          <ul className="group-list">
            {groups.map(g => (
              <li
                key={g.id}
                className={`group-item${highlightGroupId === g.id ? ' active' : ''}${linkSource && linkSource.id !== g.id ? ' link-target' : ''}`}
                onMouseEnter={() => setHighlightGroupId(g.id)}
                onMouseLeave={() => setHighlightGroupId(null)}
                onClick={linkSource && linkSource.id !== g.id ? () => {
                  onCreateGroupLink(linkSource.id, 'group', g.id)
                  setLinkSource(null)
                } : undefined}
              >
                <span className="group-dot" style={{ background: g.color }} />
                <span className="group-name">{g.name}</span>
                {!linkSource && <span className="group-count">{t.nodeCount(g.paths.length)}</span>}
                {linkSource ? (
                  linkSource.id !== g.id && <span className="group-connect-hint">{t.connect}</span>
                ) : (
                  <>
                    <Tooltip content={t.createLink}>
                      <button
                        className="group-link-btn"
                        onClick={e => { e.stopPropagation(); setLinkSource({ id: g.id, name: g.name }) }}
                      >→</button>
                    </Tooltip>
                    <Tooltip content={t.deleteGroup}>
                      <button className="group-delete-btn" onClick={() => onDeleteGroup(g.id)}>×</button>
                    </Tooltip>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {groupLinks.length > 0 && (
        <div className="graph-groups">
          <p className="graph-groups-title">{t.connections}</p>
          <ul className="group-list">
            {groupLinks.map(l => {
              const fromName = groups.find(g => g.id === l.fromId)?.name ?? '?'
              const toName = l.toType === 'group'
                ? groups.find(g => g.id === l.toId)?.name ?? '?'
                : graphData?.nodes.find(n => n.id === l.toId)?.name ?? '?'
              return (
                <li key={l.id} className="group-item">
                  <span className="group-link-label">{fromName} → {toName}</span>
                  <Tooltip content={t.deleteConnection}>
                    <button className="group-delete-btn" onClick={() => onDeleteGroupLink(l.id)}>×</button>
                  </Tooltip>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="graph-legend">
        <span className="legend-item legend-current">{t.currentFile}</span>
        <span className="legend-item legend-normal">{t.note}</span>
        <span className="legend-item legend-edge">링크</span>
        <span className="legend-item legend-selected">선택</span>
      </div>
    </aside>
  )
})
