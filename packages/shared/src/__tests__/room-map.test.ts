import { describe, expect, it } from 'vitest'
import { fitMapToken, mapTokenSize, parseMapOperation, parseRoomMap, MAP_AVATAR_MAX_LENGTH, type MapToken } from '../room-map'

const token: MapToken = { id: 'token-1', image: 'dragon', name: '巨龙', labelColor: '#263950', x: 39, y: 39 }

describe('custom map avatars', () => {
  it.each(['square', 'circle'])('preserves a %s avatar in commands and backups', shape => {
    const image = `avatar-${shape}:data:image/webp;base64,UklGRg==`
    const avatar = { ...token, image }
    expect(parseMapOperation({ type: 'map.token.create', token: avatar })).toEqual({ type: 'map.token.create', token: avatar })
    expect(parseRoomMap({ tokens: [avatar], strokes: [] }).tokens[0]).toEqual(avatar)
    expect(parseMapOperation({ type: 'map.token.update', id: token.id, patch: { image } })).toEqual({ type: 'map.token.update', id: token.id, patch: { image } })
  })
  it.each([
    'avatar-circle:data:image/svg+xml;base64,PHN2Zz4=',
    'avatar-square:https://example.com/avatar.png',
    'avatar-triangle:data:image/png;base64,YQ==',
    `avatar-circle:data:image/webp;base64,${'A'.repeat(MAP_AVATAR_MAX_LENGTH)}`,
  ])('rejects unsupported or oversized avatar data', image => {
    expect(() => parseMapOperation({ type: 'map.token.create', token: { ...token, image } })).toThrow()
  })
})

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
