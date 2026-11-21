import { describe, expect, it } from 'vitest'
import { MAP_RANGES, tokenTouchesRange } from '../desktop/map/map-geometry'

describe('map range intersection', () => {
  it('uses the requested four radii in order', () => {
    expect(MAP_RANGES.map(range => [range.label, range.radius])).toEqual([
      ['近战', 1], ['邻近', 3], ['近距离', 6], ['远距离', 12],
    ])
  })
  it('includes a target touching at exactly one corner, even when its center is outside', () => {
    expect(tokenTouchesRange([0, 0], 5, { x: 3, y: 4 })).toBe(true)
    expect(tokenTouchesRange([0, 0], 5, { x: 3.001, y: 4 })).toBe(false)
  })
  it('includes tangency along an edge and rejects a small gap', () => {
    expect(tokenTouchesRange([0.5, 0.5], 1, { x: 1.5, y: 0 })).toBe(true)
    expect(tokenTouchesRange([0.5, 0.5], 1, { x: 1.501, y: 0 })).toBe(false)
  })
  it('uses the entire footprint of a large target rather than its center or top-left cell', () => {
    expect(tokenTouchesRange([6, 6], 2, { x: 1, y: 4, size: 3 })).toBe(true)
    expect(tokenTouchesRange([6, 6], 2, { x: 1, y: 4, size: 1 })).toBe(false)
  })
  it('handles overlap, diagonal cells, and legacy tokens without a size', () => {
    expect(tokenTouchesRange([10.5, 10.5], 1, { x: 10, y: 10 })).toBe(true)
    expect(tokenTouchesRange([10.5, 10.5], 1, { x: 11, y: 11 })).toBe(true)
    expect(tokenTouchesRange([10.5, 10.5], 1, { x: 12, y: 11 })).toBe(false)
  })
  it('accepts a center moved during dragging and handles floating-point tangency', () => {
    const target = { x: 4, y: 5, size: 2 as const }
    expect(tokenTouchesRange([2, 6], 1, target)).toBe(false)
    expect(tokenTouchesRange([3, 6], 1, target)).toBe(true)
    expect(tokenTouchesRange([0, 0], Math.sqrt(2), { x: 1, y: 1 })).toBe(true)
  })
})
