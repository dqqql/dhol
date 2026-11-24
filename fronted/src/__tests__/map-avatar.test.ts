import { describe, expect, it } from 'vitest'
import { nearestFreeTokenCell } from '../desktop/map/map-geometry'
import type { MapToken } from '@dhgc/shared/desktop'

const token: MapToken = { id: 'occupied', image: 'dragon', name: '巨龙', labelColor: '#263950', x: 12, y: 15, size: 3 }

describe('avatar placement at the current viewport center', () => {
  it('places an avatar in the centered cell when free', () => {
    expect(nearestFreeTokenCell([12.5, 15.5], [])).toEqual([12, 15])
  })
  it('finds the nearest free cell and avoids the whole large token footprint', () => {
    expect(nearestFreeTokenCell([13.5, 16.5], [token])).toEqual([13, 14])
  })
  it('keeps off-map viewport centers within the map', () => {
    expect(nearestFreeTokenCell([-10, 60], [])).toEqual([0, 39])
  })
  it('reports a full map', () => {
    const tokens = Array.from({ length: 1600 }, (_, index) => ({ ...token, size: 1 as const, x: index % 40, y: Math.floor(index / 40) }))
    expect(nearestFreeTokenCell([20, 20], tokens)).toBeNull()
  })
})
