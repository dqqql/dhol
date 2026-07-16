import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import {
  DRAWING_BOARD_COLORS,
  DRAWING_BOARD_HEIGHT,
  DRAWING_BOARD_SHAPES,
  DRAWING_BOARD_WIDTH,
  normalizeDrawingBoard,
  type DrawingBoardColor,
  type DrawingBoardShape,
  type DrawingBoardShapeKind,
} from '@dhgc/shared'
import { Brush, Send, Trash2, Undo2, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useShallow } from 'zustand/react/shallow'

const SHAPE_LABELS: Record<DrawingBoardShapeKind, string> = {
  freehand: '自由涂鸦',
  rectangle: '矩形',
  circle: '正圆',
}

type DraftShape = DrawingBoardShape | null

export function FloatingDrawingBoard() {
  const { sharedBoard, submitDrawingBoard } = useStore(
    useShallow((state) => ({
      sharedBoard: state.room?.drawing_board,
      submitDrawingBoard: state.submitDrawingBoard,
    })),
  )
  const [isOpen, setIsOpen] = useState(false)
  const [tool, setTool] = useState<DrawingBoardShapeKind>('freehand')
  const [color, setColor] = useState<DrawingBoardColor>(DRAWING_BOARD_COLORS[1])
  const [shapes, setShapes] = useState<DrawingBoardShape[]>([])
  const [draftShape, setDraftShape] = useState<DraftShape>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const boardRef = useRef<SVGSVGElement | null>(null)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)

  const visibleShapes = useMemo(() => (
    draftShape ? [...shapes, draftShape] : shapes
  ), [draftShape, shapes])

  useEffect(() => {
    if (!isOpen) return
    setShapes(normalizeDrawingBoard(sharedBoard).shapes)
    setDraftShape(null)
    setIsDrawing(false)
  }, [isOpen, sharedBoard])

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  function beginDraw(event: PointerEvent<SVGSVGElement>) {
    const point = getBoardPoint(event)
    startPointRef.current = point
    setIsDrawing(true)
    setDraftShape(tool === 'freehand'
      ? createFreehandShape(color, [point])
      : createShape(tool, color, point, point))
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function updateDraw(event: PointerEvent<SVGSVGElement>) {
    if (!isDrawing || !startPointRef.current) return
    const point = getBoardPoint(event)
    if (tool === 'freehand') {
      setDraftShape((current) => {
        const points = current?.points ?? [startPointRef.current as { x: number; y: number }]
        const lastPoint = points.at(-1)
        if (lastPoint && distance(lastPoint, point) < 5) return current
        return createFreehandShape(color, [...points, point])
      })
      return
    }
    setDraftShape(createShape(tool, color, startPointRef.current, point))
  }

  function finishDraw(event: PointerEvent<SVGSVGElement>) {
    if (!isDrawing || !startPointRef.current) return
    const point = getBoardPoint(event)
    const nextShape = tool === 'freehand'
      ? createFreehandShape(color, [...(draftShape?.points ?? [startPointRef.current]), point])
      : createShape(tool, color, startPointRef.current, point)
    setIsDrawing(false)
    setDraftShape(null)
    startPointRef.current = null
    if (isDrawableShape(nextShape)) {
      setShapes((current) => normalizeDrawingBoard({ shapes: [...current, nextShape] }).shapes)
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may already be released when the pointer leaves the board.
    }
  }

  function undoShape() {
    setShapes((current) => current.slice(0, -1))
  }

  function clearBoard() {
    setShapes([])
  }

  function submitBoard() {
    submitDrawingBoard({ shapes })
    setIsOpen(false)
  }

  function getBoardPoint(event: PointerEvent<SVGSVGElement>) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: clamp(Math.round(((event.clientX - rect.left) / rect.width) * DRAWING_BOARD_WIDTH), 0, DRAWING_BOARD_WIDTH),
      y: clamp(Math.round(((event.clientY - rect.top) / rect.height) * DRAWING_BOARD_HEIGHT), 0, DRAWING_BOARD_HEIGHT),
    }
  }

  return (
    <>
      <button
        type="button"
        className="gm-floating-tool gm-floating-tool--drawing"
        onClick={() => setIsOpen(true)}
      >
        <Brush size={17} />
        画板
      </button>

      {isOpen && (
        <div
          className="dice-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawing-modal-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false)
          }}
        >
          <div className="dice-modal-backdrop" aria-hidden="true" />
          <div className="dice-modal-frame drawing-modal-frame">
            <div className="dice-modal-topbar">
              <h3 id="drawing-modal-title">战术画板</h3>
              <button
                type="button"
                className="dice-modal-close"
                onClick={() => setIsOpen(false)}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>
            <div className="dice-hairline" />

            <div className="drawing-board-shell">
              <aside className="drawing-toolbar dice-light-card" aria-label="画板工具">
                <div className="drawing-section">
                  <div className="drawing-section__eyebrow">SHAPE</div>
                  <div className="drawing-shape-grid">
                    {DRAWING_BOARD_SHAPES.map((shape) => (
                      <button
                        key={shape}
                        type="button"
                        className={`drawing-shape-tool ${tool === shape ? 'is-active' : ''}`}
                        onClick={() => setTool(shape)}
                      >
                        <ShapeGlyph kind={shape} />
                        <span>{SHAPE_LABELS[shape]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="drawing-section">
                  <div className="drawing-section__eyebrow">COLOR</div>
                  <div className="drawing-color-grid">
                    {DRAWING_BOARD_COLORS.map((nextColor) => (
                      <button
                        key={nextColor}
                        type="button"
                        className={`drawing-color-swatch ${color === nextColor ? 'is-active' : ''}`}
                        style={{ '--swatch-color': nextColor } as CSSProperties}
                        onClick={() => setColor(nextColor)}
                        aria-label={`选择颜色 ${nextColor}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="drawing-actions">
                  <button type="button" onClick={undoShape} disabled={shapes.length === 0}>
                    <Undo2 size={15} />
                    撤销
                  </button>
                  <button type="button" onClick={clearBoard} disabled={shapes.length === 0}>
                    <Trash2 size={15} />
                    清空
                  </button>
                </div>
              </aside>

              <section className="drawing-canvas-panel" aria-label="画板区域">
                <svg
                  ref={boardRef}
                  className="drawing-canvas"
                  viewBox={`0 0 ${DRAWING_BOARD_WIDTH} ${DRAWING_BOARD_HEIGHT}`}
                  role="img"
                  aria-label="当前战术画板"
                  onPointerDown={beginDraw}
                  onPointerMove={updateDraw}
                  onPointerUp={finishDraw}
                  onPointerCancel={() => {
                    setIsDrawing(false)
                    setDraftShape(null)
                    startPointRef.current = null
                  }}
                >
                  <defs>
                    <pattern id="drawing-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(122,89,28,0.15)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width={DRAWING_BOARD_WIDTH} height={DRAWING_BOARD_HEIGHT} fill="url(#drawing-grid)" />
                  {visibleShapes.map((shape) => <DrawingShapeView key={shape.id} shape={shape} />)}
                </svg>
              </section>

              <footer className="drawing-submit-row">
                <div>
                  <strong>{shapes.length}</strong>
                  <span>个</span>
                </div>
                <button type="button" className="drawing-submit-button" onClick={submitBoard}>
                  <Send size={16} />
                  提交
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DrawingShapeView({ shape }: { shape: DrawingBoardShape }) {
  const common = {
    stroke: shape.color,
    strokeWidth: shape.kind === 'freehand' ? 5 : 4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }

  if (shape.kind === 'freehand') {
    const points = shape.points?.map((point) => `${point.x},${point.y}`).join(' ') ?? ''
    return <polyline points={points} {...common} />
  }
  if (shape.kind === 'rectangle') {
    return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} {...common} />
  }
  const size = Math.min(shape.width, shape.height)
  return <circle cx={shape.x + size / 2} cy={shape.y + size / 2} r={size / 2} {...common} />
}

function ShapeGlyph({ kind }: { kind: DrawingBoardShapeKind }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {kind === 'freehand' && <path d="M5 21 C9 7 13 26 17 13 S25 9 27 22" />}
      {kind === 'rectangle' && <rect x="7" y="9" width="18" height="14" rx="2" />}
      {kind === 'circle' && <circle cx="16" cy="16" r="10" />}
    </svg>
  )
}

function createShape(
  kind: DrawingBoardShapeKind,
  color: DrawingBoardColor,
  start: { x: number; y: number },
  end: { x: number; y: number },
): DrawingBoardShape {
  const left = Math.min(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const width = Math.max(1, Math.abs(end.x - start.x))
  const height = Math.max(1, Math.abs(end.y - start.y))
  const size = kind === 'circle' ? Math.max(width, height) : undefined

  return {
    id: `shape-${Date.now()}-${Math.round(start.x)}-${Math.round(start.y)}`,
    kind,
    color,
    x: left,
    y: top,
    width: size ?? width,
    height: size ?? height,
  }
}

function createFreehandShape(
  color: DrawingBoardColor,
  points: Array<{ x: number; y: number }>,
): DrawingBoardShape {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    id: `shape-${Date.now()}-${Math.round(points[0]?.x ?? 0)}-${Math.round(points[0]?.y ?? 0)}`,
    kind: 'freehand',
    color,
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
    points,
  }
}

function isDrawableShape(shape: DrawingBoardShape) {
  if (shape.kind === 'freehand') return (shape.points?.length ?? 0) >= 2
  return shape.width >= 3 && shape.height >= 3
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
