import type { CardType, Rect } from './types'

export const GRID_SIZE = 24
export const MIN_CARD_GRID_COLS = 6
export const MIN_CARD_GRID_ROWS = 4
export const LOCATION_TERRITORY_SCALE = 2

export const CARD_GRID_SIZE: Record<CardType, { cols: number; rows: number }> = {
  Location: { cols: 9, rows: 6 },
  Feature: { cols: 8, rows: 5 },
  Hook: { cols: 8, rows: 5 },
  Custom: { cols: 8, rows: 5 },
  Role: { cols: 8, rows: 6 },
}

export function snapToGrid(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE
}

export function getCardGridSize(type: CardType, scale = 1) {
  const base = CARD_GRID_SIZE[type]
  const gridScale = Math.max(1, Math.round(scale))

  return {
    grid_cols: base.cols,
    grid_rows: base.rows,
    grid_scale: gridScale,
    width: base.cols * gridScale * GRID_SIZE,
    height: base.rows * gridScale * GRID_SIZE,
  }
}

export function normalizeCardDimensions(type: CardType, width: number, height: number) {
  const base = CARD_GRID_SIZE[type]
  const gridCols = Math.max(MIN_CARD_GRID_COLS, Math.round(width / GRID_SIZE))
  const gridRows = Math.max(MIN_CARD_GRID_ROWS, Math.round(height / GRID_SIZE))
  const snappedWidth = gridCols * GRID_SIZE
  const snappedHeight = gridRows * GRID_SIZE
  const widthScale = snappedWidth / (base.cols * GRID_SIZE)
  const heightScale = snappedHeight / (base.rows * GRID_SIZE)
  const gridScale = Math.max(1, Math.round(Math.max(widthScale, heightScale)))

  return {
    grid_cols: gridCols,
    grid_rows: gridRows,
    grid_scale: gridScale,
    width: snappedWidth,
    height: snappedHeight,
  }
}

export function createLocationTerritory(x: number, y: number, width: number, height: number) {
  return {
    x,
    y,
    width: width * LOCATION_TERRITORY_SCALE,
    height: height * LOCATION_TERRITORY_SCALE,
  }
}

export function normalizeTerritoryRect(territory: Rect, minWidth: number, minHeight: number): Rect {
  return {
    x: snapToGrid(territory.x),
    y: snapToGrid(territory.y),
    width: Math.max(minWidth, snapToGrid(territory.width)),
    height: Math.max(minHeight, snapToGrid(territory.height)),
  }
}
