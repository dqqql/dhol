import { describe, expect, it } from 'vitest'
import {
  getRoomHistory,
  getSavedNickname,
  saveRoomHistoryItem,
  saveSavedNickname,
  getRoomOwnerKey,
  saveRoomOwnerKey,
  clearRoomOwnerKey,
} from '../desktop/room-history'

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length(): number {
    return this.data.size
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  clear(): void {
    this.data.clear()
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null
  }
}

describe('room history & nickname persistence', () => {
  it('keeps the room owner key separate from public history and clears it after deletion', () => {
    const storage = new MemoryStorage()
    const key = 'a'.repeat(64)
    saveRoomOwnerKey('room-1', key, storage)
    saveRoomHistoryItem('甲', 'ABC123', '测试', storage)
    expect(getRoomOwnerKey('room-1', storage)).toBe(key)
    expect(getRoomOwnerKey('room-2', storage)).toBeNull()
    expect(JSON.stringify(getRoomHistory('甲', storage))).not.toContain(key)
    clearRoomOwnerKey('room-1', storage)
    expect(getRoomOwnerKey('room-1', storage)).toBeNull()
  })
  it('saves and reads nickname from storage', () => {
    const storage = new MemoryStorage()
    expect(getSavedNickname(storage)).toBe('')

    saveSavedNickname('不冻港', storage)
    expect(getSavedNickname(storage)).toBe('不冻港')

    // Trims whitespace
    saveSavedNickname('  夜行者  ', storage)
    expect(getSavedNickname(storage)).toBe('夜行者')
  })

  it('falls back to active session nickname if direct nickname is not set', () => {
    const storage = new MemoryStorage()
    storage.setItem('dhol:desktop:v2:session', JSON.stringify({ nickname: '探险者' }))
    expect(getSavedNickname(storage)).toBe('探险者')

    // Direct nickname has priority
    storage.setItem('dhol:desktop:v2:nickname', '游侠')
    expect(getSavedNickname(storage)).toBe('游侠')
  })

  it('saves room history per nickname and orders most recent first', () => {
    const storage = new MemoryStorage()

    saveRoomHistoryItem('不冻港', 'NEB4F8', '不冻港酒馆', storage)
    saveRoomHistoryItem('不冻港', 'ABC123', '迷雾森林', storage)

    const list = getRoomHistory('不冻港', storage)
    expect(list).toHaveLength(2)
    expect(list[0].code).toBe('ABC123')
    expect(list[0].name).toBe('迷雾森林')
    expect(list[1].code).toBe('NEB4F8')
    expect(list[1].name).toBe('不冻港酒馆')
  })

  it('deduplicates room by code and updates name and timestamp', () => {
    const storage = new MemoryStorage()

    saveRoomHistoryItem('不冻港', 'NEB4F8', '初始房间名', storage)
    saveRoomHistoryItem('不冻港', 'XYZ789', '另一房间', storage)
    saveRoomHistoryItem('不冻港', 'neb4f8', '更新后的房间名', storage)

    const list = getRoomHistory('不冻港', storage)
    expect(list).toHaveLength(2)
    expect(list[0].code).toBe('NEB4F8')
    expect(list[0].name).toBe('更新后的房间名')
    expect(list[1].code).toBe('XYZ789')
  })

  it('isolates room history by nickname', () => {
    const storage = new MemoryStorage()

    saveRoomHistoryItem('玩家甲', 'ROOM01', '甲的房间', storage)
    saveRoomHistoryItem('玩家乙', 'ROOM02', '乙的房间', storage)

    const listA = getRoomHistory('玩家甲', storage)
    const listB = getRoomHistory('玩家乙', storage)
    const listC = getRoomHistory('新玩家', storage)

    expect(listA).toHaveLength(1)
    expect(listA[0].code).toBe('ROOM01')

    expect(listB).toHaveLength(1)
    expect(listB[0].code).toBe('ROOM02')

    expect(listC).toHaveLength(0)
  })

  it('rejects invalid room codes or empty nicknames safely', () => {
    const storage = new MemoryStorage()

    saveRoomHistoryItem('', 'NEB4F8', '测试', storage)
    saveRoomHistoryItem('不冻港', 'INVALID_CODE', '测试', storage)
    saveRoomHistoryItem('不冻港', '123', '测试', storage)

    expect(getRoomHistory('不冻港', storage)).toHaveLength(0)
  })
})
