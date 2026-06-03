import { describe, it, expect } from 'vitest'
import { assertDhRoomBackup, safeJsonParse } from '../validators'

describe('assertDhRoomBackup', () => {
  const validBackup = {
    format: 'dhroom',
    version: 1,
    room: { name: '测试房间' },
    players: [],
  }

  it('接受有效的房间备份', () => {
    expect(() => assertDhRoomBackup(validBackup)).not.toThrow()
  })

  it('拒绝 null 和非对象', () => {
    expect(() => assertDhRoomBackup(null)).toThrow()
    expect(() => assertDhRoomBackup('string')).toThrow()
  })

  it('拒绝错误的 format', () => {
    expect(() => assertDhRoomBackup({ ...validBackup, format: 'wrong' })).toThrow('format')
  })

  it('拒绝错误的 version', () => {
    expect(() => assertDhRoomBackup({ ...validBackup, version: 2 })).toThrow('version')
  })

  it('拒绝缺少 room 字段', () => {
    const { room: _, ...rest } = validBackup
    expect(() => assertDhRoomBackup(rest)).toThrow('room')
  })

  it('拒绝缺少 players 字段', () => {
    const { players: _, ...rest } = validBackup
    expect(() => assertDhRoomBackup(rest)).toThrow('players')
  })
})

describe('safeJsonParse', () => {
  it('解析有效 JSON', () => {
    expect(safeJsonParse('{"key":"value"}')).toEqual({ key: 'value' })
    expect(safeJsonParse('[1,2,3]')).toEqual([1, 2, 3])
    expect(safeJsonParse('"string"')).toBe('string')
    expect(safeJsonParse('42')).toBe(42)
    expect(safeJsonParse('null')).toBeNull()
  })

  it('拒绝无效 JSON', () => {
    expect(() => safeJsonParse('not json')).toThrow('Invalid JSON')
    expect(() => safeJsonParse('{broken')).toThrow('Invalid JSON')
    expect(() => safeJsonParse('')).toThrow('Invalid JSON')
  })
})
