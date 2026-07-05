export const DRAWING_BOARD_WIDTH = 1000
export const DRAWING_BOARD_HEIGHT = 600
export const MAX_DRAWING_BOARD_SHAPES = 120
export const MAX_DRAWING_BOARD_POINTS = 300

export const DRAWING_BOARD_COLORS = [
  '#2A1C0A',
  '#C89030',
  '#F2D16B',
  '#2CC97A',
  '#2F80ED',
  '#8A5CF6',
  '#C42048',
  '#F97316',
  '#F8FAFC',
  '#111827',
] as const

export const DRAWING_BOARD_SHAPES = ['freehand', 'rectangle', 'circle'] as const

export type DrawingBoardColor = typeof DRAWING_BOARD_COLORS[number]
export type DrawingBoardShapeKind = typeof DRAWING_BOARD_SHAPES[number]

export interface DrawingBoardPoint {
  x: number
  y: number
}

export interface DrawingBoardShape {
  id: string
  kind: DrawingBoardShapeKind
  color: DrawingBoardColor
  x: number
  y: number
  width: number
  height: number
  points?: DrawingBoardPoint[]
}

export interface DrawingBoardState {
  shapes: DrawingBoardShape[]
  updated_at?: string
  updated_by_player_id?: string
  updated_by_name?: string
}

export interface DrawingBoardSubmitRequest {
  shapes: DrawingBoardShape[]
}

const SHAPE_SET = new Set<string>(DRAWING_BOARD_SHAPES)
const COLOR_SET = new Set<string>(DRAWING_BOARD_COLORS)

export function normalizeDrawingBoard(input: unknown): DrawingBoardState {
  const candidate = input && typeof input === 'object'
    ? input as Partial<DrawingBoardState>
    : {}
  const shapes = Array.isArray(candidate.shapes) ? candidate.shapes : []

  return {
    shapes: shapes
      .map((shape, index) => normalizeDrawingShape(shape, index))
      .filter((shape): shape is DrawingBoardShape => Boolean(shape))
      .slice(0, MAX_DRAWING_BOARD_SHAPES),
    updated_at: typeof candidate.updated_at === 'string' ? candidate.updated_at : undefined,
    updated_by_player_id: typeof candidate.updated_by_player_id === 'string' ? candidate.updated_by_player_id : undefined,
    updated_by_name: typeof candidate.updated_by_name === 'string' ? candidate.updated_by_name : undefined,
  }
}

function normalizeDrawingShape(input: unknown, index: number): DrawingBoardShape | null {
  if (!input || typeof input !== 'object') return null
  const candidate = input as Partial<DrawingBoardShape>
  if (!candidate.kind || !SHAPE_SET.has(candidate.kind)) return null

  const color = COLOR_SET.has(candidate.color ?? '') ? candidate.color as DrawingBoardColor : DRAWING_BOARD_COLORS[0]
  if (candidate.kind === 'freehand') {
    return normalizeFreehandShape(candidate, index, color)
  }

  const x = clampNumber(candidate.x, 0, DRAWING_BOARD_WIDTH)
  const y = clampNumber(candidate.y, 0, DRAWING_BOARD_HEIGHT)
  const maxWidth = DRAWING_BOARD_WIDTH - x
  const maxHeight = DRAWING_BOARD_HEIGHT - y

  return {
    id: normalizeShapeId(candidate.id, index),
    kind: candidate.kind as DrawingBoardShapeKind,
    color,
    x,
    y,
    width: clampNumber(candidate.width, 1, maxWidth || 1),
    height: clampNumber(candidate.height, 1, maxHeight || 1),
  }
}

function normalizeFreehandShape(
  candidate: Partial<DrawingBoardShape>,
  index: number,
  color: DrawingBoardColor,
): DrawingBoardShape | null {
  const points = Array.isArray(candidate.points)
    ? candidate.points
      .map(normalizePoint)
      .filter((point): point is DrawingBoardPoint => Boolean(point))
      .slice(0, MAX_DRAWING_BOARD_POINTS)
    : []

  if (points.length < 2) return null

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)

  return {
    id: normalizeShapeId(candidate.id, index),
    kind: 'freehand',
    color,
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
    points,
  }
}

function normalizePoint(input: unknown): DrawingBoardPoint | null {
  if (!input || typeof input !== 'object') return null
  const candidate = input as Partial<DrawingBoardPoint>
  return {
    x: clampNumber(candidate.x, 0, DRAWING_BOARD_WIDTH),
    y: clampNumber(candidate.y, 0, DRAWING_BOARD_HEIGHT),
  }
}

function normalizeShapeId(value: unknown, index: number) {
  if (typeof value !== 'string') return `shape-${index}`
  const cleaned = value.trim().slice(0, 64)
  return cleaned || `shape-${index}`
}

function clampNumber(value: unknown, min: number, max: number) {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : min
  return Math.max(min, Math.min(max, Math.round(number)))
}
