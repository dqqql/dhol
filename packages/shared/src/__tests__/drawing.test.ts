import { describe, expect, it } from 'vitest'
import {
  DRAWING_BOARD_COLORS,
  MAX_DRAWING_BOARD_SHAPES,
  normalizeDrawingBoard,
} from '../drawing'

describe('normalizeDrawingBoard', () => {
  it('keeps supported shapes and clamps coordinates to the board', () => {
    const board = normalizeDrawingBoard({
      shapes: [
        {
          id: 'shape-1',
          kind: 'rectangle',
          color: DRAWING_BOARD_COLORS[0],
          x: -20,
          y: 12,
          width: 1200,
          height: 720,
        },
        {
          id: 'shape-2',
          kind: 'freehand',
          color: '#not-real',
          points: [
            { x: -10, y: 20 },
            { x: 1200, y: 640 },
          ],
        },
      ],
    })

    expect(board.shapes).toHaveLength(2)
    expect(board.shapes[0]).toMatchObject({
      id: 'shape-1',
      kind: 'rectangle',
      color: DRAWING_BOARD_COLORS[0],
      x: 0,
      y: 12,
      width: 1000,
      height: 588,
    })
    expect(board.shapes[1]).toMatchObject({
      kind: 'freehand',
      color: DRAWING_BOARD_COLORS[0],
      x: 0,
      y: 20,
      width: 1000,
      height: 580,
      points: [
        { x: 0, y: 20 },
        { x: 1000, y: 600 },
      ],
    })
  })

  it('drops unsupported shape kinds', () => {
    const shapes = Array.from({ length: 8 }, (_, index) => ({
      id: `shape-${index}`,
      kind: index % 2 === 0 ? 'circle' : 'triangle',
      color: DRAWING_BOARD_COLORS[1],
      x: 10,
      y: 10,
      width: 40,
      height: 40,
    }))

    const board = normalizeDrawingBoard({ shapes })

    expect(board.shapes).toHaveLength(4)
    expect(board.shapes.every((shape) => shape.kind === 'circle')).toBe(true)
  })

  it('caps the submitted shape count', () => {
    const shapes = Array.from({ length: MAX_DRAWING_BOARD_SHAPES + 8 }, (_, index) => ({
      id: `shape-${index}`,
      kind: 'rectangle',
      color: DRAWING_BOARD_COLORS[1],
      x: 10,
      y: 10,
      width: 40,
      height: 40,
    }))

    const board = normalizeDrawingBoard({ shapes })

    expect(board.shapes).toHaveLength(MAX_DRAWING_BOARD_SHAPES)
  })
})
