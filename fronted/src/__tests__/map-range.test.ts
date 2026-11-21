import { describe, expect, it } from 'vitest'
import { MAP_RANGES, tokenTouchesRange } from '../desktop/map/map-geometry'

describe('map range measured from the occupied footprint', () => {
  it('keeps the four requested distances', () => {
    expect(MAP_RANGES.map(range => [range.label, range.radius])).toEqual([
      ['近战', 1], ['邻近', 3], ['近距离', 6], ['远距离', 12],
    ])
    expect(new Set(MAP_RANGES.map(r => r.color)).size).toBe(4)
  })
  it.each([[1, 8], [2, 12], [3, 16]] as const)('covers the size-%i surrounding melee ring with exactly %i cells', (size, count) => {
    const source = { x: 10, y: 10, size }
    const hits: string[] = []
    const expected: string[] = []
    for (let x = 6; x <= 17; x++) for (let y = 6; y <= 17; y++) {
      if (x >= 10 && x < 10 + size && y >= 10 && y < 10 + size) continue
      if (tokenTouchesRange(source, 1, { x, y })) hits.push(`${x},${y}`)
      if (x >= 9 && x <= 10 + size && y >= 9 && y <= 10 + size) expected.push(`${x},${y}`)
    }
    expect(hits).toEqual(expected)
    expect(hits).toHaveLength(count)
  })
  it.each([1, 2, 3] as const)('extends all distances beyond each side of size %i', size => {
    const source = { x: 15, y: 15, size }
    for (const { radius } of MAP_RANGES) {
      for (const target of [
        { x: 15 + size + radius - 1, y: 15 }, { x: 15 - radius, y: 15 },
        { x: 15, y: 15 + size + radius - 1 }, { x: 15, y: 15 - radius },
      ]) expect(tokenTouchesRange(source, radius, target)).toBe(true)
      expect(tokenTouchesRange(source, radius, { x: 15 + size + radius, y: 15 })).toBe(false)
    }
  })
  it('counts a partial hit on a large target even when its center is outside', () => {
    const source = { x: 10, y: 10, size: 2 as const }
    expect(tokenTouchesRange(source, 1, { x: 7, y: 9, size: 3 })).toBe(true)
    expect(tokenTouchesRange(source, 1, { x: 7, y: 9, size: 1 })).toBe(false)
  })
  it('includes a precise corner contact and excludes a small gap', () => {
    const source = { x: 0, y: 0 }
    expect(tokenTouchesRange(source, 5, { x: 3.5, y: 4.5 })).toBe(true)
    expect(tokenTouchesRange(source, 5, { x: 3.501, y: 4.5 })).toBe(false)
  })
  it('uses the moving footprint while dragging and defaults old tokens to 1×1', () => {
    const target = { x: 14, y: 10 }
    expect(tokenTouchesRange({ x: 10, y: 10, size: 2 }, 1, target)).toBe(false)
    expect(tokenTouchesRange({ x: 12, y: 10, size: 2 }, 1, target)).toBe(true)
    expect(tokenTouchesRange({ x: 10, y: 10 }, 1, { x: 11, y: 11 })).toBe(true)
  })
})
