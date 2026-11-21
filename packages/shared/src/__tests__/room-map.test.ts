import { describe, expect, it } from 'vitest'
import { fitMapToken, mapTokenSize, parseMapOperation, parseRoomMap, type MapToken } from '../room-map'

const token: MapToken = { id: 'token-1', image: 'dragon', name: '巨龙', labelColor: '#263950', x: 39, y: 39 }

describe('map token footprints', () => {
  it('keeps legacy tokens compatible as 1×1 without changing their saved shape', () => {
    expect(parseRoomMap({ tokens: [token], strokes: [] }).tokens[0]).toEqual(token)
    expect(mapTokenSize(token)).toBe(1)
  })
  it.each([1, 2, 3] as const)('preserves size %i across create and backup parsing and keeps it within the map', size => {
    const expected = { ...token, size, x: 40 - size, y: 40 - size }
    expect(parseMapOperation({ type: 'map.token.create', token: { ...token, size } })).toEqual({ type: 'map.token.create', token: expected })
    expect(parseRoomMap({ tokens: [{ ...token, size }], strokes: [] }).tokens[0]).toEqual(expected)
    expect(fitMapToken({ ...token, size })).toEqual(expected)
    expect(parseMapOperation({ type: 'map.token.update', id: token.id, patch: { size } })).toEqual({ type: 'map.token.update', id: token.id, patch: { size } })
  })
  it.each([0, 4, -1, 1.5, '2', null, NaN, Infinity])('rejects invalid footprint %s on create and update', size => {
    expect(() => parseMapOperation({ type: 'map.token.create', token: { ...token, size } })).toThrow()
    expect(() => parseMapOperation({ type: 'map.token.update', id: token.id, patch: { size } })).toThrow()
  })
})
