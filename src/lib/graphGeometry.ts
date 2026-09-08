import { polygonHull } from 'd3'

/** 각 노드를 작은 원으로 확장해 convex hull 경로 생성 */
export function hullPath(points: [number, number][], r: number): string {
  if (points.length === 0) return ''
  const expanded: [number, number][] = []
  for (const [x, y] of points) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      expanded.push([x + Math.cos(a) * r, y + Math.sin(a) * r])
    }
  }
  const hull = polygonHull(expanded)
  if (!hull) return ''
  return 'M' + hull.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z'
}

