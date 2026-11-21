export const MAP_SIZE = 40
export const MAP_MESSAGE_BYTES = 16 * 1024
export const MAP_DATA_BYTES = 512 * 1024
export const MAP_STROKE_POINTS = 512
export const MAP_TOKEN_LIMIT = 128
export const MAP_STROKE_LIMIT = 256
export const MAP_IMAGES = ['hero', 'beast', 'skull', 'marker'] as const

export type MapPoint = [number, number]
export interface MapToken { id: string; image: string; name: string; labelColor: string; x: number; y: number }
export interface MapStroke { id: string; color: string; width: number; points: MapPoint[] }
export interface RoomMap { tokens: MapToken[]; strokes: MapStroke[] }
export const EMPTY_MAP: RoomMap = { tokens: [], strokes: [] }

export type MapOperation =
  | { type: 'map.token.create'; token: MapToken }
  | { type: 'map.token.update'; id: string; patch: Partial<Omit<MapToken, 'id'>> }
  | { type: 'map.token.delete'; id: string }
  | { type: 'map.stroke.add'; stroke: MapStroke }
  | { type: 'map.stroke.delete'; id: string }

export type MapChange =
  | { type: 'map.token.changed'; token: MapToken }
  | { type: 'map.token.deleted'; id: string }
  | { type: 'map.stroke.added'; stroke: MapStroke }
  | { type: 'map.stroke.deleted'; id: string }

const encoder = new TextEncoder()
export function utf8Bytes(text: string): number { return encoder.encode(text).byteLength }

function invalid(): never { throw new Error('地图操作数据无效') }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  return value as Record<string, unknown>
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[\w-]{1,128}$/.test(value)) invalid()
  return value
}
function color(value: unknown): string {
  if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) invalid()
  return value
}
function number(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) invalid()
  return value
}
function cell(value: unknown): number {
  const index = number(value, 0, MAP_SIZE - 1)
  if (!Number.isInteger(index)) invalid()
  return index
}
function name(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 48) invalid()
  return value.trim()
}
function image(value: unknown): string {
  if (typeof value !== 'string' || !/^[\w-]{1,32}$/.test(value)) invalid()
  return value
}
function token(value: unknown): MapToken {
  const item = record(value)
  return { id: identifier(item.id), image: image(item.image), name: name(item.name), labelColor: color(item.labelColor), x: cell(item.x), y: cell(item.y) }
}
function stroke(value: unknown): MapStroke {
  const item = record(value)
  if (!Array.isArray(item.points) || item.points.length < 1 || item.points.length > MAP_STROKE_POINTS) invalid()
  const points = item.points.map((point): MapPoint => {
    if (!Array.isArray(point) || point.length !== 2) invalid()
    return [number(point[0], 0, MAP_SIZE), number(point[1], 0, MAP_SIZE)]
  })
  const parsed = { id: identifier(item.id), color: color(item.color), width: number(item.width, 0.05, 0.5), points }
  if (utf8Bytes(JSON.stringify(parsed)) > MAP_MESSAGE_BYTES - 512) invalid()
  return parsed
}

export function parseMapOperation(input: Record<string, unknown>): MapOperation {
  switch (input.type) {
    case 'map.token.create': return { type: input.type, token: token(input.token) }
    case 'map.token.update': {
      const inputPatch = record(input.patch)
      const patch: Partial<MapToken> = {}
      if (inputPatch.x !== undefined) patch.x = cell(inputPatch.x)
      if (inputPatch.y !== undefined) patch.y = cell(inputPatch.y)
      if (inputPatch.name !== undefined) patch.name = name(inputPatch.name)
      if (inputPatch.labelColor !== undefined) patch.labelColor = color(inputPatch.labelColor)
      if (inputPatch.image !== undefined) patch.image = image(inputPatch.image)
      if (!Object.keys(patch).length) invalid()
      return { type: input.type, id: identifier(input.id), patch }
    }
    case 'map.stroke.add': return { type: input.type, stroke: stroke(input.stroke) }
    case 'map.token.delete':
    case 'map.stroke.delete': return { type: input.type, id: identifier(input.id) }
    default: return invalid()
  }
}

export function parseRoomMap(value: unknown): RoomMap {
  if (value === undefined) return EMPTY_MAP
  const data = record(value)
  if (!Array.isArray(data.tokens) || !Array.isArray(data.strokes) || data.tokens.length > MAP_TOKEN_LIMIT || data.strokes.length > MAP_STROKE_LIMIT) invalid()
  const tokens = data.tokens.map(token)
  const strokes = data.strokes.map(stroke)
  if (new Set(tokens.map(item => item.id)).size !== tokens.length || new Set(strokes.map(item => item.id)).size !== strokes.length) invalid()
  const bytes = [...tokens, ...strokes].reduce((total, item) => total + utf8Bytes(JSON.stringify(item)), 0)
  if (bytes > MAP_DATA_BYTES) invalid()
  return { tokens, strokes }
}
