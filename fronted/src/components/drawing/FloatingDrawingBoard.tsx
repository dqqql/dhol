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

const SHAPE_LABELS: Record<DrawingBoardShapeKind, string> = {
  rectangle: '矩形',
  triangle: '三角形',
  circle: '正圆',
  cone: '锥形',
  line: '线段',
}

type DraftShape = DrawingBoardShape | null

export function FloatingDrawingBoard() {
  const { room, submitDrawingBoard } = useStore()
  const [isOpen, setIsOpen] = useState(false)
  const [tool, setTool] = useState<DrawingBoardShapeKind>('rectangle')
  const [color, setColor] = useState<DrawingBoardColor>(DRAWING_BOARD_COLORS[1])
  const [shapes, setShapes] = useState<DrawingBoardShape[]>([])
  const [draftShape, setDraftShape] = useState<DraftShape>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const boardRef = useRef<SVGSVGElement | null>(null)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)

  const sharedBoard = room?.drawing_board
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
    setDraftShape(createShape(tool, color, point, point))
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function updateDraw(event: PointerEvent<SVGSVGElement>) {
    if (!isDrawing || !startPointRef.current) return
    setDraftShape(createShape(tool, color, startPointRef.current, getBoardPoint(event)))
  }

  function finishDraw(event: PointerEvent<SVGSVGElement>) {
    if (!isDrawing || !startPointRef.current) return
    const nextShape = createShape(tool, color, startPointRef.current, getBoardPoint(event))
    setIsDrawing(false)
    setDraftShape(null)
    startPointRef.current = null
    if (nextShape.width >= 3 && nextShape.height >= 3) {
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
                  <span>个当前画板形状</span>
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
  const strokeWidth = shape.kind === 'line' ? 8 : 4
  const common = {
    stroke: shape.color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (shape.kind === 'rectangle') {
    return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={`${shape.color}24`} {...common} />
  }
  if (shape.kind === 'circle') {
    const size = Math.min(shape.width, shape.height)
    return <circle cx={shape.x + size / 2} cy={shape.y + size / 2} r={size / 2} fill={`${shape.color}24`} {...common} />
  }
  if (shape.kind === 'triangle') {
    const points = `${shape.x + shape.width / 2},${shape.y} ${shape.x + shape.width},${shape.y + shape.height} ${shape.x},${shape.y + shape.height}`
    return <polygon points={points} fill={`${shape.color}24`} {...common} />
  }
  if (shape.kind === 'cone') {
    const path = [
      `M ${shape.x + shape.width / 2} ${shape.y}`,
      `L ${shape.x} ${shape.y + shape.height}`,
      `Q ${shape.x + shape.width / 2} ${shape.y + shape.height - Math.max(18, shape.height * 0.18)} ${shape.x + shape.width} ${shape.y + shape.height}`,
      'Z',
    ].join(' ')
    return <path d={path} fill={`${shape.color}24`} {...common} />
  }
  return <line x1={shape.x} y1={shape.y} x2={shape.x + shape.width} y2={shape.y + shape.height} {...common} />
}

function ShapeGlyph({ kind }: { kind: DrawingBoardShapeKind }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      {kind === 'rectangle' && <rect x="7" y="9" width="18" height="14" rx="2" />}
      {kind === 'triangle' && <polygon points="16,6 26,25 6,25" />}
      {kind === 'circle' && <circle cx="16" cy="16" r="10" />}
      {kind === 'cone' && <path d="M16 5 L6 25 Q16 20 26 25 Z" />}
      {kind === 'line' && <path d="M7 24 L25 8" />}
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
