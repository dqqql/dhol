import { MAP_SIZE, MAP_STROKE_POINTS, mapTokenSize, type MapPoint, type MapToken } from '@dhgc/shared/desktop'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function nearestFreeTokenCell(center: MapPoint, tokens: Iterable<MapToken>): MapPoint | null {
  const occupied = [...tokens]
  let nearest: MapPoint | null = null
  let distance = Infinity
  for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
    if (occupied.some(token => x < token.x + mapTokenSize(token) && x + 1 > token.x && y < token.y + mapTokenSize(token) && y + 1 > token.y)) continue
    const next = (x + 0.5 - center[0]) ** 2 + (y + 0.5 - center[1]) ** 2
    if (next < distance) { nearest = [x, y]; distance = next }
  }
  return nearest
}

export function mapPoint([x, y]: MapPoint): MapPoint {
  return [x, y].map(value => Math.round(clamp(value, 0, MAP_SIZE) * 100) / 100) as MapPoint
}

function segmentDistanceSquared(point: MapPoint, start: MapPoint, end: MapPoint): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const length = dx * dx + dy * dy
  const t = length ? clamp(((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / length, 0, 1) : 0
  return (point[0] - start[0] - t * dx) ** 2 + (point[1] - start[1] - t * dy) ** 2
}

function simplify(points: MapPoint[], tolerance: number): MapPoint[] {
  const last = points.length - 1
  const keep = new Set([0, last])
  const segments = [[0, last]]
  while (segments.length) {
    const [start, end] = segments.pop()!
    let furthest = start
    let distance = tolerance ** 2
    for (let index = start + 1; index < end; index++) {
      const candidate = segmentDistanceSquared(points[index], points[start], points[end])
      if (candidate > distance) { furthest = index; distance = candidate }
    }
    if (furthest === start) continue
    keep.add(furthest)
    segments.push([start, furthest], [furthest, end])
  }
  return points.filter((_, index) => keep.has(index))
}

export function simplifyStroke(points: MapPoint[], width: number): MapPoint[] {
  const end = points.at(-1)
  if (!end || points.length <= 1) return points
  if (points.every(point => point[0] === end[0] && point[1] === end[1])) return [end]
  let tolerance = Math.min(0.04, width / 4)
  let result = simplify(points, tolerance)
  while (result.length > MAP_STROKE_POINTS) {
    tolerance *= 1.5
    result = simplify(points, tolerance)
  }
  return result
}

export const MAP_RANGES = [
  { label: '近战', radius: 1, color: '#DC2626' },
  { label: '邻近', radius: 3, color: '#EA580C' },
  { label: '近距离', radius: 6, color: '#CA8A04' },
  { label: '远距离', radius: 12, color: '#16A34A' },
] as const

// Extend the occupied cell-center hull by the requested grid distance. Testing
// against the target's full footprint counts partial/corner hits in its favor.
export function tokenTouchesRange(source: Pick<MapToken, 'x' | 'y' | 'size'>, radius: number, target: Pick<MapToken, 'x' | 'y' | 'size'>): boolean {
  const sourceSize = mapTokenSize(source)
  const targetSize = mapTokenSize(target)
  const dx = Math.max(0, target.x - (source.x + sourceSize - 0.5), source.x + 0.5 - (target.x + targetSize))
  const dy = Math.max(0, target.y - (source.y + sourceSize - 0.5), source.y + 0.5 - (target.y + targetSize))
  return dx ** 2 + dy ** 2 <= radius ** 2 + 1e-9
}
