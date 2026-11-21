import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { MAP_IMAGES, MAP_CLASS_IMAGES, MAP_MONSTER_IMAGES, MAP_SIZE, mapTokenSize, fitMapToken, type MapTokenSize, type MapPoint, type MapStroke, type MapToken, type RoomMap } from '@dhgc/shared/desktop'
import type { RoomSync } from '../state/room-sync'
import type { PendingOperation } from '../sync/room-outbox'
import { clamp, mapPoint, simplifyStroke, MAP_RANGES, tokenTouchesRange } from './map-geometry'
import TokenIcon from './token-icons'
import './map.css'

const DEFAULT_VIEW = { x: 5, y: 10, zoom: 1 }
const VIEW_WIDTH = 15
const VIEW_HEIGHT = 10
const MIN_ZOOM = 0.25
const MAX_ZOOM = 4.0
const WIDTHS = [0.08, 0.16, 0.32]
const PEN_COLORS = ['#111111', '#004BD6', '#E6332A', '#16A34A', '#E5A000', '#7C3AED', '#64748B']
const LABEL_COLORS = ['#263950', '#004BD6', '#E6332A', '#16A34A', '#E5A000', '#7C3AED', '#111111']

const imageLabels: Record<typeof MAP_IMAGES[number], string> = {
  bard: '吟游诗人',
  druid: '德鲁伊',
  guardian: '守护者',
  ranger: '游侠',
  rogue: '游荡者',
  seraph: '神使',
  sorcerer: '术士',
  warrior: '战士',
  wizard: '法师',
  dragon: '巨龙',
  golem: '魔像',
  ghost: '幽灵',
  'dark-mage': '黑暗法师',
  demon: '恶魔',
}

const TOOLS = [
  ['select', '选择', '🖱️'],
  ['pan', '平移', '✋'],
  ['pen', '画笔', '✏️'],
  ['eraser', '橡皮擦', '🧹'],
] as const

type View = typeof DEFAULT_VIEW
type Tool = typeof TOOLS[number][0] | 'place'
type StrokeStatus = 'drawing' | 'confirmed' | 'pending' | 'failed' | 'erasing'
type Gesture =
  | { type: 'pan'; pointer: number; from: MapPoint; view: View }
  | { type: 'pen'; pointer: number; stroke: MapStroke }
  | { type: 'token'; pointer: number; from: MapPoint; offset: MapPoint; id: string; origin: MapPoint }

function moveView(view: View): View {
  const visibleW = VIEW_WIDTH / view.zoom
  const visibleH = VIEW_HEIGHT / view.zoom
  const x = visibleW >= MAP_SIZE ? (MAP_SIZE - visibleW) / 2 : clamp(view.x, 0, MAP_SIZE - visibleW)
  const y = visibleH >= MAP_SIZE ? (MAP_SIZE - visibleH) / 2 : clamp(view.y, 0, MAP_SIZE - visibleH)
  return { ...view, x, y }
}

function cellIndex(value: number) {
  return clamp(Math.floor(value), 0, MAP_SIZE - 1)
}

function projectMap(map: RoomMap, pending: PendingOperation[]) {
  const tokens = new Map(map.tokens.map(item => [item.id, item]))
  const strokes = new Map(map.strokes.map(item => [item.id, { stroke: item, status: 'confirmed' as StrokeStatus }]))
  const pendingTokens = new Set<string>()
  const erased = new Set<string>()
  for (const { command } of pending) {
    switch (command.type) {
      case 'map.token.create':
        tokens.set(command.token.id, command.token)
        pendingTokens.add(command.token.id)
        break
      case 'map.token.update': {
        const existing = tokens.get(command.id)
        if (existing) {
          tokens.set(command.id, fitMapToken({ ...existing, ...command.patch }))
          pendingTokens.add(command.id)
        }
        break
      }
      case 'map.token.delete':
        tokens.delete(command.id)
        break
      case 'map.stroke.add':
        strokes.set(command.stroke.id, { stroke: command.stroke, status: 'pending' })
        break
      case 'map.stroke.delete': {
        const existing = strokes.get(command.id)
        if (existing) strokes.set(command.id, { ...existing, status: 'erasing' })
        erased.add(command.id)
        break
      }
    }
  }
  return { tokens, strokes, pendingTokens, erased }
}

const Stroke = memo(function Stroke({
  stroke,
  status,
  reason,
  isHovered,
}: {
  stroke: MapStroke
  status: StrokeStatus
  reason?: string
  isHovered?: boolean
}) {
  const [x, y] = stroke.points[0]
  const dot = stroke.points.length === 1
  const path = stroke.points.map(([px, py]) => `${px},${py}`).join(' ')
  const color = status === 'failed' || isHovered ? '#E6332A' : stroke.color
  return (
    <g
      data-stroke-id={stroke.id}
      data-stroke-status={status}
      className={`room-map-stroke room-map-stroke--${status} ${isHovered ? 'is-eraser-hover' : ''}`}
    >
      {reason && <title>{reason}</title>}
      {dot ? (
        <circle cx={x} cy={y} r={isHovered ? stroke.width * 0.75 : stroke.width / 2} fill={color} />
      ) : (
        <polyline
          points={path}
          stroke={color}
          strokeWidth={isHovered ? stroke.width * 1.6 : stroke.width}
          strokeDasharray={status === 'failed' || isHovered ? '0.3 0.2' : undefined}
        />
      )}
      {dot ? (
        <circle className="room-map-stroke-hit" cx={x} cy={y} r={Math.max(0.3, stroke.width / 2)} fill="transparent" />
      ) : (
        <polyline className="room-map-stroke-hit" points={path} stroke="transparent" strokeWidth={Math.max(0.55, stroke.width)} />
      )}
      {status === 'failed' && (
        <g className="room-map-failed-marker">
          <circle cx={x} cy={y} r={0.32} fill="#E6332A" />
          <text x={x} y={y} dy=".12" fontSize=".36" fill="#fff" textAnchor="middle">
            !
          </text>
        </g>
      )}
    </g>
  )
})

function labelInk(hex: string) {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const [r, g, b] = channels.map(channel => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#000000' : '#FFFFFF'
}

function TokenEditor({
  token,
  save,
  remove,
  rangeIndex,
  onRangeChange,
}: {
  token: MapToken
  save(patch: { name?: string; labelColor?: string; size?: MapTokenSize }): boolean
  remove(): void
  rangeIndex: number
  onRangeChange(index: number): void
}) {
  const [name, setName] = useState(token.name)
  const [color, setColor] = useState(token.labelColor)
  const trackRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const updateIndex = (clientX: number) => {
      const padding = 8
      const trackWidth = Math.max(1, rect.width - padding * 2)
      const offset = clientX - rect.left - padding
      const ratio = Math.max(0, Math.min(1, offset / trackWidth))
      const nearest = Math.round(ratio * (MAP_RANGES.length - 1))
      onRangeChange(nearest)
    }
    updateIndex(event.clientX)

    const onPointerMove = (moveEv: PointerEvent) => {
      updateIndex(moveEv.clientX)
    }
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  const handleColorPreset = (c: string) => {
    setColor(c)
    save({ labelColor: c })
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const patch = {
      ...(name.trim() && name.trim() !== token.name ? { name: name.trim() } : {}),
      ...(color && color !== token.labelColor ? { labelColor: color } : {}),
    }
    if (Object.keys(patch).length && save(patch)) {
      // saved successfully
    }
  }

  const hasChanges = (name.trim() && name.trim() !== token.name) || (color && color !== token.labelColor)
  const currentRange = MAP_RANGES[rangeIndex]

  return (
    <form className="room-map-token-editor" onSubmit={handleSubmit}>
      <div className="room-map-editor-badge" title={token.name}>
        <TokenIcon image={token.image} size={24} />
      </div>
      <label className="room-map-editor-field">
        <span className="room-map-field-label">名称</span>
        <input
          aria-label="Token 名称"
          required
          maxLength={48}
          value={name}
          onChange={event => setName(event.target.value)}
        />
      </label>
      <div className="room-map-editor-size">
        <span className="room-map-field-label">体型</span>
        <div className="room-map-width-group" role="group" aria-label="Token 体型">
          {([1, 2, 3] as const).map((size, index) => (
            <button key={size} type="button" className={`room-map-width-btn ${mapTokenSize(token) === size ? 'is-active' : ''}`}
              aria-pressed={mapTokenSize(token) === size} title={`${size}×${size} 格`} onClick={() => save({ size })}>
              {['小', '中', '大'][index]}
            </button>
          ))}
        </div>
      </div>
      <div className="room-map-editor-colors">
        <span className="room-map-field-label">名牌底色</span>
        <div className="room-map-color-swatches" role="radiogroup" aria-label="快捷名牌底色">
          {LABEL_COLORS.map(c => (
            <button
              key={c}
              type="button"
              className={`room-map-color-swatch ${color.toLowerCase() === c.toLowerCase() ? 'is-active' : ''}`}
              style={{ backgroundColor: c }}
              title={c}
              aria-label={`名牌底色 ${c}`}
              onClick={() => handleColorPreset(c)}
            />
          ))}
          <label className="room-map-color-picker-label" title="自定义名牌底色">
            <input
              aria-label="名牌底色"
              type="color"
              value={color}
              onChange={event => setColor(event.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="room-map-editor-actions">
        <div className="room-map-range-control">
          <div className="room-map-range-header">
            <span>距离</span>
            <output>{currentRange.label} · {currentRange.radius} 格</output>
          </div>
          <div
            ref={trackRef}
            className="room-map-range-slider-wrap"
            role="group"
            aria-label="距离刻度"
            onPointerDown={handlePointerDown}
          >
            <div className="room-map-range-track-bg" />
            <div
              className="room-map-range-track-fill"
              style={{
                width: `calc(8px + (100% - 16px) * ${rangeIndex / 3})`,
                backgroundColor: currentRange.color,
              }}
            />
            <div className="room-map-range-nodes">
              {MAP_RANGES.map((range, index) => {
                const isActive = index === rangeIndex
                const isPassed = index <= rangeIndex
                return (
                  <button
                    key={range.radius}
                    type="button"
                    className={`room-map-range-node ${isActive ? 'is-active' : ''} ${isPassed ? 'is-passed' : ''}`}
                    style={{
                      left: `calc(8px + (100% - 16px) * ${index / 3})`,
                      '--node-color': range.color,
                    } as React.CSSProperties}
                    title={`${range.label}（${range.radius} 格）`}
                    aria-label={`${range.label} ${range.radius} 格`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRangeChange(index)
                    }}
                  />
                )
              })}
            </div>
            <input
              type="range"
              className="room-map-range-native-input"
              aria-label="距离"
              min="0"
              max="3"
              step="1"
              value={rangeIndex}
              aria-valuetext={`${currentRange.label}，${currentRange.radius} 格`}
              style={{ accentColor: currentRange.color }}
              onChange={event => onRangeChange(Number(event.target.value))}
            />
          </div>
        </div>
        <button type="submit" className="button--primary room-map-btn-sm" disabled={!hasChanges}>
          保存
        </button>
        <button type="button" className="button--danger room-map-btn-sm" onClick={remove}>
          删除
        </button>
      </div>
    </form>
  )
}

function RangeRings({
  center,
  activeRange,
}: {
  center: MapPoint
  activeRange: (typeof MAP_RANGES)[number]
}) {
  const [exitingRange, setExitingRange] = useState<(typeof MAP_RANGES)[number] | null>(null)
  const [currentRange, setCurrentRange] = useState(activeRange)
  const [animationKey, setAnimationKey] = useState(0)

  if (currentRange !== activeRange) {
    setExitingRange(currentRange)
    setCurrentRange(activeRange)
    setAnimationKey(k => k + 1)
  }

  useEffect(() => {
    if (!exitingRange) return
    const timer = setTimeout(() => {
      setExitingRange(null)
    }, 280)
    return () => clearTimeout(timer)
  }, [exitingRange])

  return (
    <g className="room-map-range-rings" transform={`translate(${center[0]} ${center[1]})`} pointerEvents="none">
      {exitingRange && (
        <g key={`exiting-${animationKey}`} className="room-map-range-shrink">
          <circle
            cx={0}
            cy={0}
            r={exitingRange.radius}
            fill={exitingRange.color}
            fillOpacity={0.07}
            stroke={exitingRange.color}
            strokeWidth={0.06}
            strokeOpacity={0.75}
          />
        </g>
      )}
      <g key={`active-${animationKey}`} className={exitingRange ? 'room-map-range-expand' : undefined}>
        <circle
          cx={0}
          cy={0}
          r={currentRange.radius}
          fill={currentRange.color}
          fillOpacity={0.07}
          stroke={currentRange.color}
          strokeWidth={0.06}
          strokeOpacity={0.85}
        />
      </g>
    </g>
  )
}

export default function MapPanel({
  map,
  sync,
  pending,
  connected,
  onClose,
}: {
  map: RoomMap
  sync: RoomSync
  pending: PendingOperation[]
  connected: boolean
  onClose(): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const board = useRef<SVGSVGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const viewKey = `dhol-map-view-${sync.options.roomId}`
  const [view, setView] = useState<View>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(viewKey) ?? 'null')
      if (saved && [saved.x, saved.y, saved.zoom].every(value => typeof value === 'number' && Number.isFinite(value)) && saved.zoom >= MIN_ZOOM && saved.zoom <= MAX_ZOOM) {
        return moveView({ x: saved.x, y: saved.y, zoom: saved.zoom })
      }
    } catch { /* Storage may be unavailable or contain invalid data. */ }
    return DEFAULT_VIEW
  })
  const addMenu = useRef<HTMLDivElement>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(viewKey, JSON.stringify(view)) } catch { /* Keep the map usable when storage is unavailable. */ }
  }, [view, viewKey])

  useEffect(() => {
    if (!addMenuOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (!addMenu.current?.contains(event.target as Node)) setAddMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [addMenuOpen])
  const [tool, setTool] = useState<Tool>('select')
  const [image, setImage] = useState<typeof MAP_IMAGES[number]>('bard')
  const [color, setColor] = useState('#111111')
  const [width, setWidth] = useState(WIDTHS[1])
  const [selectedId, setSelectedId] = useState('')
  const [rangeIndex, setRangeIndex] = useState(0)
  const [draft, setDraft] = useState<MapStroke | null>(null)
  const [dragged, setDragged] = useState<{ id: string; position: MapPoint; anchor: MapPoint } | null>(null)
  const [notice, setNotice] = useState('')
  const [isSpaceHeld, setIsSpaceHeld] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [hoverCell, setHoverCell] = useState<MapPoint | null>(null)
  const [hoverStrokeId, setHoverStrokeId] = useState<string | null>(null)

  const projected = useMemo(() => projectMap(map, pending), [map, pending])
  const failures = [...sync.mapFailures().values()].filter(item => !projected.erased.has(item.stroke.id))
  const pendingCount = pending.filter(item => item.command.type.startsWith('map.')).length
  const selected = projected.tokens.get(selectedId)
  const activeRange = MAP_RANGES[rangeIndex]
  const rangeCenter: MapPoint | null = selected ? [
    (dragged?.id === selected.id ? dragged.anchor[0] : selected.x) + mapTokenSize(selected) / 2,
    (dragged?.id === selected.id ? dragged.anchor[1] : selected.y) + mapTokenSize(selected) / 2,
  ] : null
  const syncFailure = sync.getState().save === 'failed' ? sync.getState().reason : null

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => {
      element?.close()
    }
  }, [])

  const submit = useCallback((command: Parameters<RoomSync['submit']>[0]): boolean => {
    try {
      sync.submit(command)
      setNotice('')
      return true
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '地图操作失败')
      return false
    }
  }, [sync])

  function zoomBy(factor: number) {
    setView(current => {
      const zoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      const newX = current.x + 0.5 * VIEW_WIDTH * (1 / current.zoom - 1 / zoom)
      const newY = current.y + 0.5 * VIEW_HEIGHT * (1 / current.zoom - 1 / zoom)
      return moveView({ zoom, x: newX, y: newY })
    })
  }

  function centerView() {
    setView(current => moveView({
      zoom: current.zoom,
      x: (MAP_SIZE - VIEW_WIDTH / current.zoom) / 2,
      y: (MAP_SIZE - VIEW_HEIGHT / current.zoom) / 2,
    }))
  }

  useEffect(() => {
    const isInput = (el: EventTarget | null) =>
      el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement || el instanceof HTMLButtonElement

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInput(e.target)) return

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        setIsSpaceHeld(true)
        return
      }

      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomBy(1.2)
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomBy(1 / 1.2)
      } else if (e.key === '0') {
        e.preventDefault()
        setView(DEFAULT_VIEW)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [selectedId, tool, onClose, submit])

  useEffect(() => {
    const element = board.current
    if (!element) return
    const zoom = (event: WheelEvent) => {
      event.preventDefault()
      if (gesture.current) return
      const bounds = element.getBoundingClientRect()
      const fracX = (event.clientX - bounds.left) / bounds.width
      const fracY = (event.clientY - bounds.top) / bounds.height
      setView(current => {
        const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15
        const zoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM)
        const newX = current.x + fracX * VIEW_WIDTH * (1 / current.zoom - 1 / zoom)
        const newY = current.y + fracY * VIEW_HEIGHT * (1 / current.zoom - 1 / zoom)
        return moveView({ zoom, x: newX, y: newY })
      })
    }
    element.addEventListener('wheel', zoom, { passive: false })
    return () => element.removeEventListener('wheel', zoom)
  }, [])

  function pointAt(event: Pick<PointerEvent, 'clientX' | 'clientY'>, frame = view): MapPoint {
    const bounds = board.current!.getBoundingClientRect()
    return [
      frame.x + ((event.clientX - bounds.left) / bounds.width) * (VIEW_WIDTH / frame.zoom),
      frame.y + ((event.clientY - bounds.top) / bounds.height) * (VIEW_HEIGHT / frame.zoom),
    ]
  }

  function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (gesture.current) return
    const isPan =
      event.button === 2 ||
      event.button === 1 ||
      (event.button === 0 && (tool === 'pan' || isSpaceHeld))

    if (!isPan && event.button !== 0) return
    event.preventDefault()

    const point = pointAt(event)
    const target = event.target as Element

    if (isPan) {
      gesture.current = { type: 'pan', pointer: event.pointerId, view, from: point }
      setIsPanning(true)
    } else if (tool === 'eraser') {
      const id = target.closest('[data-stroke-id]')?.getAttribute('data-stroke-id')
      if (id && sync.mapFailures().has(id)) sync.clearMapFailure(id)
      else if (id) submit({ type: 'map.stroke.delete', id })
    } else if (tool === 'place') {
      const id = crypto.randomUUID()
      if (
        submit({
          type: 'map.token.create',
          token: {
            id,
            image,
            name: imageLabels[image],
            labelColor: '#263950',
            x: cellIndex(point[0]),
            y: cellIndex(point[1]),
          },
        })
      ) {
        setSelectedId(id)
        setTool('select')
      }
    } else if (tool === 'pen') {
      const stroke = { id: crypto.randomUUID(), color, width, points: [mapPoint(point)] }
      gesture.current = { type: 'pen', pointer: event.pointerId, stroke }
      setDraft(stroke)
    } else {
      const node = target.closest('[data-token-id]')
      const id = node?.getAttribute('data-token-id') ?? ''
      const token = projected.tokens.get(id)
      setSelectedId(id)
      if (token) {
        const offset: MapPoint = [
          Number(node?.getAttribute('data-offset-x')),
          Number(node?.getAttribute('data-offset-y')),
        ]
        gesture.current = {
          type: 'token',
          pointer: event.pointerId,
          id,
          from: point,
          offset,
          origin: [token.x, token.y],
        }
      }
    }
    if (gesture.current) event.currentTarget.setPointerCapture(event.pointerId)
  }

  function appendPoints(active: Extract<Gesture, { type: 'pen' }>, event: ReactPointerEvent<SVGSVGElement>) {
    const events = event.nativeEvent.getCoalescedEvents?.()
    const points = active.stroke.points
    for (const sample of events?.length ? events : [event]) {
      const point = mapPoint(pointAt(sample))
      const last = points.at(-1)!
      if (point[0] !== last[0] || point[1] !== last[1]) points.push(point)
    }
    if (points.length > 4096) active.stroke.points = simplifyStroke(points, active.stroke.width)
  }

  function dragPosition(active: Extract<Gesture, { type: 'token' }>, point: MapPoint): MapPoint {
    return [
      clamp(active.origin[0] + point[0] - active.from[0], 0, MAP_SIZE - mapTokenSize(projected.tokens.get(active.id) ?? {})),
      clamp(active.origin[1] + point[1] - active.from[1], 0, MAP_SIZE - mapTokenSize(projected.tokens.get(active.id) ?? {})),
    ]
  }

  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const point = pointAt(event)

    if (tool === 'place') {
      setHoverCell([cellIndex(point[0]), cellIndex(point[1])])
    }
    if (tool === 'eraser') {
      const strokeNode = (event.target as Element).closest('[data-stroke-id]')
      setHoverStrokeId(strokeNode?.getAttribute('data-stroke-id') ?? null)
    }

    const active = gesture.current
    if (!active || active.pointer !== event.pointerId) return

    if (active.type === 'pan') {
      const curr = pointAt(event, active.view)
      setView(
        moveView({
          ...active.view,
          x: active.view.x + active.from[0] - curr[0],
          y: active.view.y + active.from[1] - curr[1],
        })
      )
    } else if (active.type === 'pen') {
      appendPoints(active, event)
      setDraft({ ...active.stroke, points: [...active.stroke.points] })
    } else {
      const [x, y] = dragPosition(active, point)
      setDragged({ id: active.id, position: [x + active.offset[0], y + active.offset[1]], anchor: [x, y] })
    }
  }

  function pointerEnd(event: ReactPointerEvent<SVGSVGElement>, cancelled = false) {
    setIsPanning(false)
    const active = gesture.current
    if (!active || active.pointer !== event.pointerId) return
    gesture.current = null

    if (!cancelled && active.type === 'pen') {
      appendPoints(active, event)
      submit({
        type: 'map.stroke.add',
        stroke: { ...active.stroke, points: simplifyStroke(active.stroke.points, active.stroke.width) },
      })
    } else if (!cancelled && active.type === 'token') {
      const [x, y] = dragPosition(active, pointAt(event)).map(Math.round)
      if (x !== active.origin[0] || y !== active.origin[1]) {
        submit({ type: 'map.token.update', id: active.id, patch: { x, y } })
      }
    }
    setDraft(null)
    setDragged(null)
  }

  const groups = new Map<string, MapToken[]>()
  for (const token of projected.tokens.values()) {
    const key = `${token.x},${token.y},${mapTokenSize(token)}`
    const group = groups.get(key)
    if (group) group.push(token)
    else groups.set(key, [token])
  }

  return (
    <dialog
      ref={dialog}
      className="room-map-dialog"
      aria-labelledby="room-map-heading"
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
    >
      <header className="room-map-header">
        <div className="room-map-header-left">
          <h2 id="room-map-heading">房间地图</h2>
          <span className="room-map-badge">40 × 40 格</span>
        </div>
        <p className="room-map-header-hint">右键移动 左键选中 滚轮缩放</p>
        <div className="room-map-status-bar">
          <p className="room-map-status" role="status">
            <span
              className={`room-map-sync-dot ${
                !connected || syncFailure ? 'is-offline' : pendingCount ? 'is-pending' : 'is-synced'
              }`}
            />
            <span className="room-map-sync-text">
              {syncFailure ? '地图未保存' : connected
                ? pendingCount
                  ? `${pendingCount} 项待确认`
                  : '地图已同步'
                : pendingCount
                ? `连接中断，${pendingCount} 项待同步`
                : '连接中断'}
            </span>
            {failures.length > 0 && (
              <strong className="room-map-failure-text">
                {failures.length} 条笔迹失败（可用橡皮擦清除）
              </strong>
            )}
            {(notice || syncFailure) && <strong className="room-map-notice-text"> {notice || syncFailure}</strong>}
          </p>
        </div>
        <button type="button" className="room-map-close" onClick={onClose}>
          关闭
        </button>
      </header>

      <div className="room-map-tools" role="group" aria-label="地图工具">
        <div className="room-map-tools-left">
          <div className="room-map-tool-group">
            {TOOLS.map(([id, label, icon]) => (
              <button
                type="button"
                key={id}
                className={`room-map-btn ${tool === id ? 'is-active' : ''}`}
                aria-label={label}
                aria-pressed={tool === id}
                onClick={() => setTool(id)}
                title={label}
              >
                <span className="room-map-tool-icon">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="room-map-divider" />

          {/* 画笔调色盘与粗细 */}
          <div className="room-map-brush">
            <span className="room-map-label-sm">线色</span>
            <div className="room-map-color-swatches" role="radiogroup" aria-label="快捷线色">
              {PEN_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`room-map-color-swatch ${color.toLowerCase() === c.toLowerCase() ? 'is-active' : ''}`}
                  style={{ backgroundColor: c }}
                  title={c}
                  aria-label={`选择颜色 ${c}`}
                  onClick={() => {
                    setColor(c)
                    setTool('pen')
                  }}
                />
              ))}
              <label className="room-map-color-picker-label" title="自定义颜色">
                <input
                  aria-label="画笔颜色"
                  type="color"
                  value={color}
                  onChange={event => {
                    setColor(event.target.value)
                    setTool('pen')
                  }}
                />
              </label>
            </div>

            <div className="room-map-divider-sm" />

            <span className="room-map-label-sm">粗细</span>
            <div className="room-map-width-group" role="radiogroup" aria-label="画笔粗细">
              {WIDTHS.map((val, idx) => (
                <button
                  key={val}
                  type="button"
                  className={`room-map-width-btn ${width === val ? 'is-active' : ''}`}
                  aria-pressed={width === val}
                  onClick={() => {
                    setWidth(val)
                    setTool('pen')
                  }}
                  title={['细 (0.08)', '中 (0.16)', '粗 (0.32)'][idx]}
                >
                  <span className="room-map-width-line" style={{ height: `${(idx + 1) * 2 + 1}px` }} />
                  <span>{['细', '中', '粗'][idx]}</span>
                </button>
              ))}
              <select
                aria-label="画笔粗细"
                className="sr-only"
                value={width}
                onChange={event => {
                  setWidth(Number(event.target.value))
                  setTool('pen')
                }}
                tabIndex={-1}
              >
                {WIDTHS.map((val, index) => (
                  <option key={val} value={val}>
                    {['细', '中', '粗'][index]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="room-map-divider" />

          {/* 新增 Token 选项 */}
          <div className="room-map-add" ref={addMenu} onKeyDown={event => {
            if (event.key === 'Escape' && addMenuOpen) {
              event.preventDefault()
              event.stopPropagation()
              setAddMenuOpen(false)
              addButton.current?.focus()
            }
          }}>
            <button
              ref={addButton}
              type="button"
              className={`room-map-btn ${tool === 'place' ? 'is-active' : ''}`}
              aria-expanded={addMenuOpen}
              aria-controls="room-map-add-menu"
              onClick={() => setAddMenuOpen(open => !open)}
              title="选择图案后在地图上放置新 Token"
            >
              <span>➕ 新增 Token</span>
            </button>
            {addMenuOpen && (
              <div id="room-map-add-menu" className="room-map-add-menu" role="group" aria-label="新增 Token 类型">
                {([['职业', MAP_CLASS_IMAGES], ['怪物', MAP_MONSTER_IMAGES]] as const).map(([category, images]) => (
                  <div key={category} className="room-map-add-column" role="group" aria-label={category}>
                    <span className="room-map-menu-heading">{category}</span>
                    {images.map(id => (
                      <button key={id} type="button" className="room-map-btn" onClick={() => {
                        setImage(id)
                        setTool('place')
                        setAddMenuOpen(false)
                        addButton.current?.focus()
                      }}>
                        <TokenIcon image={id} size={26} />
                        <span>{imageLabels[id]}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 缩放控制 */}
        <div className="room-map-tools-right">
          <div className="room-map-zoom-group">
            <button
              type="button"
              className="room-map-zoom-btn"
              onClick={() => zoomBy(1 / 1.2)}
              title="缩小 (-)"
              aria-label="缩小"
            >
              −
            </button>
            <button
              type="button"
              className="room-map-zoom-btn room-map-reset"
              onClick={() => setView(DEFAULT_VIEW)}
              title="重置地图视野 (0)"
              aria-label="重置地图视野"
            >
              {Math.round(view.zoom * 100)}%
            </button>
            <button
              type="button"
              className="room-map-zoom-btn"
              onClick={() => zoomBy(1.2)}
              title="放大 (+)"
              aria-label="放大"
            >
              +
            </button>
            <button
              type="button"
              className="room-map-zoom-btn"
              onClick={centerView}
              title="回到地图中心，保持当前缩放"
              aria-label="回中"
            >
              回中
            </button>
          </div>
        </div>
      </div>

      <div className="room-map-board-container">
        <svg
          ref={board}
          className={`room-map-board ${isPanning ? 'is-panning' : ''} ${isSpaceHeld ? 'is-space-held' : ''}`}
          data-tool={tool}
          aria-label="40 × 40 格房间地图"
          data-map-pending={pendingCount}
          viewBox={`${view.x} ${view.y} ${VIEW_WIDTH / view.zoom} ${VIEW_HEIGHT / view.zoom}`}
          onContextMenu={event => event.preventDefault()}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={event => pointerEnd(event)}
          onPointerCancel={event => pointerEnd(event, true)}
          onLostPointerCapture={event => pointerEnd(event, true)}
          onPointerLeave={() => {
            setHoverCell(null)
            setHoverStrokeId(null)
          }}
        >
          <defs>
            <pattern id="room-map-grid-minor" width="1" height="1" patternUnits="userSpaceOnUse">
              <path d="M 1 0 H 0 V 1" fill="none" stroke="#DCDCD4" strokeWidth=".04" />
            </pattern>
            <pattern id="room-map-grid-major" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M 5 0 H 0 V 5" fill="none" stroke="#B8B8AE" strokeWidth=".08" />
            </pattern>
          </defs>

          {/* 地图背景与多级网格 */}
          <rect width={MAP_SIZE} height={MAP_SIZE} fill="#F9F9F6" />
          <rect width={MAP_SIZE} height={MAP_SIZE} fill="url(#room-map-grid-minor)" />
          <rect width={MAP_SIZE} height={MAP_SIZE} fill="url(#room-map-grid-major)" />
          <rect width={MAP_SIZE} height={MAP_SIZE} fill="none" stroke="#111111" strokeWidth=".1" />

          {/* 地图中心十字标记 (20, 20) */}
          <line x1="19.4" y1="20" x2="20.6" y2="20" stroke="#888882" strokeWidth=".06" strokeLinecap="round" />
          <line x1="20" y1="19.4" x2="20" y2="20.6" stroke="#888882" strokeWidth=".06" strokeLinecap="round" />

          {rangeCenter && selected && (
            <RangeRings key={selected.id} center={rangeCenter} activeRange={activeRange} />
          )}

          {/* 笔迹层 */}
          {[...projected.strokes.values()].map(item => (
            <Stroke
              key={item.stroke.id}
              {...item}
              isHovered={tool === 'eraser' && hoverStrokeId === item.stroke.id}
            />
          ))}
          {failures.map(item => (
            <Stroke
              key={`failed-${item.stroke.id}`}
              {...item}
              status="failed"
              isHovered={tool === 'eraser' && hoverStrokeId === item.stroke.id}
            />
          ))}
          {draft && <Stroke stroke={draft} status="drawing" />}

          {/* 拖动 Token 时的目标格子吸附高亮框 */}
          {dragged && (
            <g className="room-map-drag-indicator" pointerEvents="none">
              <rect
                x={clamp(Math.round(dragged.position[0]), 0, MAP_SIZE - mapTokenSize(projected.tokens.get(dragged.id) ?? {}))}
                y={clamp(Math.round(dragged.position[1]), 0, MAP_SIZE - mapTokenSize(projected.tokens.get(dragged.id) ?? {}))}
                width={mapTokenSize(projected.tokens.get(dragged.id) ?? {})}
                height={mapTokenSize(projected.tokens.get(dragged.id) ?? {})}
                fill="rgba(0, 75, 214, 0.12)"
                stroke="#004BD6"
                strokeWidth="0.06"
                strokeDasharray="0.16 0.1"
                rx="0.05"
              />
            </g>
          )}

          {/* 新增 Token 模式下的实时预览虚影 */}
          {tool === 'place' && hoverCell && (
            <g className="room-map-place-ghost" transform={`translate(${hoverCell[0]} ${hoverCell[1]})`} pointerEvents="none">
              <rect
                x="0.05"
                y="0.05"
                width="0.9"
                height="0.9"
                fill="rgba(0, 75, 214, 0.14)"
                stroke="#004BD6"
                strokeWidth="0.05"
                strokeDasharray="0.12 0.08"
                rx="0.05"
              />
              <g opacity="0.8">
                <TokenIcon image={image} x={0.06} y={0.06} size={0.88} />
              </g>
              <rect x="0.18" y="0.77" width="0.64" height="0.22" rx="0.04" fill="#004BD6" />
              <text x="0.5" y="0.93" fill="#ffffff" textAnchor="middle" fontSize="0.15" fontWeight="800">
                放置
              </text>
            </g>
          )}

          {/* Token 列表 */}
          <g className="room-map-tokens">
            {[...groups.values()].flatMap(group =>
              group.map((token, index) => {
                const clustered = group.length > 1
                const offset: MapPoint = clustered
                  ? [(index % 2 ? 1 : -1) * 0.19, (index % 4 < 2 ? -1 : 1) * 0.17]
                  : [0, 0]
                const [x, y] =
                  dragged?.id === token.id ? dragged.position : [token.x + offset[0], token.y + offset[1]]
                const footprint = mapTokenSize(token)
                const size = clustered ? footprint * 0.65 : footprint - 0.12
                const centerX = footprint / 2
                const centerY = footprint / 2
                const labelY = footprint - 0.24
                const initials = [...token.name]
                const label = initials.length > 7 ? `${initials.slice(0, 6).join('')}…` : token.name
                const labelLength = Math.min(
                  1.95,
                  Math.max(
                    0.42,
                    [...label].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 0.26 : 0.15), 0) + 0.17
                  )
                )
                const isSelected = selectedId === token.id
                const inRange = !isSelected && rangeCenter !== null && tokenTouchesRange(rangeCenter, activeRange.radius, token)

                return (
                  <g
                    key={token.id}
                    className={`room-map-token ${isSelected ? 'is-selected' : ''}`}
                    data-token-id={token.id}
                    data-cell={`${token.x},${token.y}`}
                    data-token-size={footprint}
                    data-in-range={inRange || undefined}
                    data-token-status={projected.pendingTokens.has(token.id) ? 'pending' : 'confirmed'}
                    data-offset-x={offset[0]}
                    data-offset-y={offset[1]}
                    transform={`translate(${x} ${y})`}
                  >
                    <title>
                      {token.name}
                    </title>

                    {/* 选中高亮光环 */}
                    {isSelected && (
                      <g className="room-map-selection-halo">
                        <circle
                          cx={centerX}
                          cy={centerY}
                          r={size / 2 + 0.08}
                          fill="rgba(0, 75, 214, 0.18)"
                          stroke="#004BD6"
                          strokeWidth="0.06"
                        />
                      </g>
                    )}

                    <TokenIcon image={token.image} x={centerX - size / 2} y={centerY - size / 2} size={size} />
                    {inRange && (
                      <circle className="room-map-range-highlight" cx={centerX} cy={centerY} r={size / 2 + 0.035}
                        fill="none" stroke={activeRange.color} strokeWidth="0.065" pointerEvents="none" />
                    )}

                    {(!clustered || isSelected || index === group.length - 1) && (
                      <g className="room-map-token-label-group">
                        <rect
                          x={centerX - labelLength / 2}
                          y={labelY}
                          width={labelLength}
                          height=".31"
                          rx=".04"
                          fill={token.labelColor}
                          stroke="#111111"
                          strokeWidth="0.02"
                        />
                        <text
                          x={centerX}
                          y={labelY + 0.22}
                          fill={labelInk(token.labelColor)}
                          textAnchor="middle"
                          fontSize=".23"
                          fontWeight="800"
                        >
                          {label}
                        </text>
                      </g>
                    )}
                    <circle cx={centerX} cy={centerY} r={size / 2} fill="transparent" />
                  </g>
                )
              })
            )}
          </g>
        </svg>
      </div>

      <div className="room-map-footer">
        {selected && (
          <TokenEditor
            key={selected.id}
            token={selected}
            rangeIndex={rangeIndex}
            onRangeChange={setRangeIndex}
            save={patch => submit({ type: 'map.token.update', id: selected.id, patch })}
            remove={() => submit({ type: 'map.token.delete', id: selected.id })}
          />
        )}
      </div>
    </dialog>
  )
}
