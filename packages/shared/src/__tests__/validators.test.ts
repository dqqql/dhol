import { describe, it, expect } from 'vitest'
import { assertDhPack, assertDhRoomBackup, safeJsonParse } from '../validators'

const validCard = { type: 'Location' as const, title: '测试地点', content: '描述内容', style: '#ff0000' }

describe('assertDhPack', () => {
  it('接受有效的卡包', () => {
    const pack = { format: 'dhpack', version: 1, pack_name: '测试包', cards: [validCard] }
    expect(() => assertDhPack(pack)).not.toThrow()
  })

  it('接受空卡牌数组', () => {
    const pack = { format: 'dhpack', version: 1, pack_name: '空包', cards: [] }
    expect(() => assertDhPack(pack)).not.toThrow()
  })

  it('接受带可选字段的卡包', () => {
    const pack = { format: 'dhpack', version: 1, id: 'test-id', pack_name: '带 ID 的包', description: '描述', cards: [] }
    expect(() => assertDhPack(pack)).not.toThrow()
  })

  it('拒绝 null 和非对象', () => {
    expect(() => assertDhPack(null)).toThrow()
    expect(() => assertDhPack('string')).toThrow()
    expect(() => assertDhPack(42)).toThrow()
  })

  it('拒绝错误的 format', () => {
    expect(() => assertDhPack({ format: 'wrong', version: 1, pack_name: 'x', cards: [] })).toThrow('format')
  })

  it('拒绝错误的 version', () => {
    expect(() => assertDhPack({ format: 'dhpack', version: 2, pack_name: 'x', cards: [] })).toThrow('version')
  })

  it('拒绝缺少 pack_name', () => {
    expect(() => assertDhPack({ format: 'dhpack', version: 1, cards: [] })).toThrow()
  })

  it('拒绝无效的 card type', () => {
    const pack = { format: 'dhpack', version: 1, pack_name: 'x', cards: [{ ...validCard, type: 'InvalidType' }] }
    expect(() => assertDhPack(pack)).toThrow()
  })

  it('拒绝缺少 title 的卡牌', () => {
    const pack = { format: 'dhpack', version: 1, pack_name: 'x', cards: [{ type: 'Location', content: 'c', style: '#000000' }] }
    expect(() => assertDhPack(pack)).toThrow('title')
  })

  it('拒绝样式不是 hex 颜色', () => {
    const pack = { format: 'dhpack', version: 1, pack_name: 'x', cards: [{ type: 'Location', title: 't', content: 'c', style: 'red' }] }
    expect(() => assertDhPack(pack)).toThrow('style')
  })

  it('拒绝 Custom 卡牌缺少 custom_type_name', () => {
    const pack = { format: 'dhpack', version: 1, pack_name: 'x', cards: [{ type: 'Custom', title: 't', content: 'c', style: '#000000' }] }
    expect(() => assertDhPack(pack)).toThrow('custom_type_name')
  })

  it('接受 Custom 卡牌带有 custom_type_name', () => {
    const pack = {
      format: 'dhpack', version: 1, pack_name: 'x',
      cards: [{ type: 'Custom', custom_type_name: '自定义类型', title: 't', content: 'c', style: '#000000' }],
    }
    expect(() => assertDhPack(pack)).not.toThrow()
  })

  it('拒绝超过最大卡牌数量', () => {
    const cards = Array.from({ length: 201 }, () => validCard)
    const pack = { format: 'dhpack', version: 1, pack_name: 'x', cards }
    expect(() => assertDhPack(pack)).toThrow()
  })

  it('拒绝 pack_name 超长', () => {
    const pack = { format: 'dhpack', version: 1, pack_name: 'a'.repeat(101), cards: [] }
    expect(() => assertDhPack(pack)).toThrow()
  })

  it('将 NPC 卡类型转换为 Hook', () => {
    const pack = { format: 'dhpack', version: 1, pack_name: 'x', cards: [{ type: 'NPC', title: 't', content: 'c', style: '#000000' }] }
    const result = assertDhPack(pack)
    expect(result.cards[0].type).toBe('Hook')
  })
})

describe('assertDhRoomBackup', () => {
  const validBackup = {
    format: 'dhroom',
    version: 1,
    room: { name: '测试房间' },
    session: { turn_order: [], hands: [], deck: [] },
    map: { cards: [], connections: [], annotations: [] },
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

  it('拒绝缺少 session 字段', () => {
    const { session: _, ...rest } = validBackup
    expect(() => assertDhRoomBackup(rest)).toThrow('session')
  })

  it('拒绝缺少 map 字段', () => {
    const { map: _, ...rest } = validBackup
    expect(() => assertDhRoomBackup(rest)).toThrow('map')
  })

  it('拒绝 map.cards 超过最大数量', () => {
    const manyCards = Array.from({ length: 501 }, (_, i) => ({
      id: `card-${i}`, type: 'Location', title: '卡牌', content: '', style: '#000000',
      x: 0, y: 0, width: 144, height: 96, grid_cols: 6, grid_rows: 4, grid_scale: 1, is_expanded: false,
    }))
    const backup = { ...validBackup, map: { ...validBackup.map, cards: manyCards } }
    expect(() => assertDhRoomBackup(backup)).toThrow()
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
