import { describe, it, expect } from 'vitest'
import {
  snapToGrid,
  getCardGridSize,
  normalizeCardDimensions,
  createLocationTerritory,
  normalizeTerritoryRect,
  GRID_SIZE,
  MIN_CARD_GRID_COLS,
  MIN_CARD_GRID_ROWS,
} from '../grid'

describe('snapToGrid', () => {
  it('对齐到最近的网格', () => {
    expect(snapToGrid(0)).toBe(0)
    expect(snapToGrid(24)).toBe(24)
    expect(snapToGrid(12)).toBe(24)
    expect(snapToGrid(11)).toBe(0)
    expect(snapToGrid(36)).toBe(48)
    expect(snapToGrid(48)).toBe(48)
  })

  it('处理负数', () => {
    expect(snapToGrid(-12)).toBe(0)
    expect(snapToGrid(-13)).toBe(-24)
  })

  it('GRID_SIZE 为 24', () => {
    expect(GRID_SIZE).toBe(24)
  })
})

describe('getCardGridSize', () => {
  it('返回 Location 卡的默认尺寸', () => {
    const size = getCardGridSize('Location')
    expect(size.grid_cols).toBe(9)
    expect(size.grid_rows).toBe(6)
    expect(size.grid_scale).toBe(1)
    expect(size.width).toBe(9 * 1 * 24)
    expect(size.height).toBe(6 * 1 * 24)
  })

  it('scale 参数影响宽高', () => {
    const size = getCardGridSize('Location', 2)
    expect(size.grid_scale).toBe(2)
    expect(size.width).toBe(9 * 2 * 24)
    expect(size.height).toBe(6 * 2 * 24)
  })

  it('处理各种卡牌类型', () => {
    expect(getCardGridSize('Feature').grid_cols).toBe(8)
    expect(getCardGridSize('Hook').grid_cols).toBe(8)
    expect(getCardGridSize('Custom').grid_cols).toBe(8)
    expect(getCardGridSize('Role').grid_cols).toBe(8)
  })
})

describe('normalizeCardDimensions', () => {
  it('将像素尺寸转换为网格单位', () => {
    const result = normalizeCardDimensions('Location', 216, 144)
    expect(result.grid_cols).toBe(9)
    expect(result.grid_rows).toBe(6)
    expect(result.width).toBe(216)
    expect(result.height).toBe(144)
  })

  it('强制最小列数', () => {
    const result = normalizeCardDimensions('Location', 1, 1)
    expect(result.grid_cols).toBeGreaterThanOrEqual(MIN_CARD_GRID_COLS)
    expect(result.grid_rows).toBeGreaterThanOrEqual(MIN_CARD_GRID_ROWS)
  })

  it('宽高对齐到网格', () => {
    const result = normalizeCardDimensions('Feature', 200, 130)
    expect(result.width % GRID_SIZE).toBe(0)
    expect(result.height % GRID_SIZE).toBe(0)
  })
})

describe('createLocationTerritory', () => {
  it('以卡牌位置和尺寸创建领地矩形', () => {
    const territory = createLocationTerritory(100, 200, 216, 144)
    expect(territory.x).toBe(100)
    expect(territory.y).toBe(200)
    expect(territory.width).toBe(216 * 2)
    expect(territory.height).toBe(144 * 2)
  })
})

describe('normalizeTerritoryRect', () => {
  it('对齐到网格', () => {
    const rect = normalizeTerritoryRect({ x: 10, y: 15, width: 200, height: 100 }, 48, 48)
    expect(rect.x % GRID_SIZE).toBe(0)
    expect(rect.y % GRID_SIZE).toBe(0)
    expect(rect.width % GRID_SIZE).toBe(0)
    expect(rect.height % GRID_SIZE).toBe(0)
  })

  it('强制最小宽高', () => {
    const rect = normalizeTerritoryRect({ x: 0, y: 0, width: 10, height: 10 }, 240, 144)
    expect(rect.width).toBeGreaterThanOrEqual(240)
    expect(rect.height).toBeGreaterThanOrEqual(144)
  })
})
