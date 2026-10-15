import { describe, expect, it } from 'vitest'
import { clearRoomBrowserState, loadLegacyCountdowns } from '../desktop/room-browser-state'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length(): number { return this.data.size }
  clear(): void { this.data.clear() }
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null }
  removeItem(key: string): void { this.data.delete(key) }
  setItem(key: string, value: string): void { this.data.set(key, value) }
}

describe('room-local browser state', () => {
  it('loads valid legacy countdowns and ignores malformed entries', () => {
    const storage = new MemoryStorage()
    storage.setItem('dhol-countdowns-room-a', JSON.stringify([
      { id: 'c123', name: '援军抵达', value: 3, max: 6 },
      { id: '../bad', name: '无效', value: 0, max: 6 },
    ]))
    expect(loadLegacyCountdowns(storage, 'room-a')).toEqual([{ id: 'c123', name: '援军抵达', value: 3, max: 6 }])
  })
  it('removes every local artifact for only the deleted room', () => {
    const storage = new MemoryStorage()
    storage.setItem('dhol-countdowns-room-a', '[]')
    storage.setItem('dhol-roomlog-room-a', '[]')
    storage.setItem('dhol:desktop:v2:outbox:room-a:player-a', '[]')
    storage.setItem('dhol:desktop:v2:outbox:room-a:player-b', '[]')
    storage.setItem('dhol-countdowns-room-b', '[]')

    clearRoomBrowserState(storage, 'room-a')

    expect(storage.getItem('dhol-countdowns-room-a')).toBeNull()
    expect(storage.getItem('dhol-roomlog-room-a')).toBeNull()
    expect(storage.getItem('dhol:desktop:v2:outbox:room-a:player-a')).toBeNull()
    expect(storage.getItem('dhol:desktop:v2:outbox:room-a:player-b')).toBeNull()
    expect(storage.getItem('dhol-countdowns-room-b')).toBe('[]')
  })
})
