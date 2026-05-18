import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link2, LocateFixed, MousePointer2, Type, X, ZoomIn, ZoomOut } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useStore } from '@/store/useStore'
import { DhCardNode } from './CardNode'
import { CardContextMenu } from './CardContextMenu'
import { AnnotationNode } from './AnnotationNode'
import { getCardVisualConfig } from '@/utils/cardTypeConfig'
import { GRID_SIZE, getCardGridSize, snapToGrid } from '@/utils/grid'
import type { CardType, DhCard, MapCard } from '@/types'

interface ConnectionRenderData {
  id: string
  fromCardId: string
  toCardId: string
  path: string
  strokeColor: string
  markerColor: 'red' | 'green' | 'gray'
  label?: string
  labelX: number
  labelY: number
  labelWidth: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function rectsOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function buildConnectionRenderData(connection: {
  id: string
  from_card_id: string
  to_card_id: string
  color: 'red' | 'green' | 'gray'
  label?: string
}, from: MapCard, to: MapCard): ConnectionRenderData {
  const x1 = from.x + from.width / 2
  const y1 = from.y + from.height / 2
  const x2 = to.x + to.width / 2
  const y2 = to.y + to.height / 2
  const straightMidX = (x1 + x2) / 2
  const straightMidY = (y1 + y2) / 2
  const labelWidth = clamp((connection.label?.length ?? 0) * 12 + 20, 44, 220)
  const labelHeight = 22
  let normalX = -(y2 - y1)
  let normalY = x2 - x1
  const normalLength = Math.hypot(normalX, normalY) || 1
  normalX /= normalLength
  normalY /= normalLength
  if (normalY > 0) {
    normalX *= -1
    normalY *= -1
  }

  const cardRects = [
    {
      left: from.x - 12,
      top: from.y - 12,
      right: from.x + from.width + 12,
      bottom: from.y + from.height + 12,
    },
    {
      left: to.x - 12,
      top: to.y - 12,
      right: to.x + to.width + 12,
      bottom: to.y + to.height + 12,
    },
  ]

  let labelOffset = 0
  let labelX = straightMidX
  let labelY = straightMidY

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const labelRect = {
      left: labelX - labelWidth / 2,
      top: labelY - labelHeight / 2,
      right: labelX + labelWidth / 2,
      bottom: labelY + labelHeight / 2,
    }

    const overlapsObstacle = cardRects.some((rect) => rectsOverlap(labelRect, rect))
    if (!overlapsObstacle) break

    labelOffset += attempt === 0 ? 18 : 12
    labelX = straightMidX + normalX * labelOffset
    labelY = straightMidY + normalY * labelOffset
  }

  const strokeColor = connection.color === 'red'
    ? 'var(--conn-conflict)'
    : connection.color === 'green'
      ? 'var(--conn-ally)'
      : 'var(--conn-unknown)'

  return {
    id: connection.id,
    fromCardId: from.id,
    toCardId: to.id,
    path: `M ${x1} ${y1} L ${x2} ${y2}`,
    strokeColor,
    markerColor: connection.color,
    label: connection.label,
    labelX,
    labelY,
    labelWidth,
  }
}

export function MapCanvas() {
  const {
    room,
    currentPlayerId,
    setContextMenu,
    playCard,
    addAnnotation,
    triggerPlacementAnimation,
    placementAnimation,
    clearPlacementAnimation,
    recycleAnimation,
    clearRecycleAnimation,
    connectionDraftFromCardId,
    draggingHandCard,
    cancelConnection,
    openConnectionEditor,
  } = useStore()

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [pointerWorld, setPointerWorld] = useState<{ x: number; y: number } | null>(null)
  const [isAnnotationPlacementActive, setIsAnnotationPlacementActive] = useState(false)
  const [dropPreview, setDropPreview] = useState<{
    x: number
    y: number
    width: number
    height: number
    card: DhCard
  } | null>(null)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null)
  const isPanning = useRef(false)
  const [isPanningActive, setIsPanningActive] = useState(false)
  const panStart = useRef({ mx: 0, my: 0, tx: 0, ty: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const toWorldPoint = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return null

    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale,
    }
  }, [transform])

  const updatePointerWorld = useCallback((clientX: number, clientY: number) => {
    const worldPoint = toWorldPoint(clientX, clientY)
    if (worldPoint) {
      setPointerWorld(worldPoint)
    }
  }, [toWorldPoint])

  const setAnnotationPlacement = useCallback((active: boolean) => {
    setIsAnnotationPlacementActive(active)
    if (active) {
      setSelectedAnnotationId(null)
      setEditingAnnotationId(null)
    }
  }, [])

  const zoomCanvas = useCallback((factor: number) => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2

    setTransform((value) => {
      const newScale = Math.min(3, Math.max(0.2, value.scale * factor))
      return {
        scale: newScale,
        x: cx - (cx - value.x) * (newScale / value.scale),
        y: cy - (cy - value.y) * (newScale / value.scale),
      }
    })
  }, [])

  const resetCanvasView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [])

  const updateDropPreview = useCallback((clientX: number, clientY: number, dragCardType?: CardType) => {
    if (!containerRef.current || !draggingHandCard) return

    const rect = containerRef.current.getBoundingClientRect()
    const pointerWorldX = (clientX - rect.left - transform.x) / transform.scale
    const pointerWorldY = (clientY - rect.top - transform.y) / transform.scale
    const cardSize = getCardGridSize(dragCardType || draggingHandCard.card.type)
    const nextX = snapToGrid(pointerWorldX - cardSize.width / 2)
    const nextY = snapToGrid(pointerWorldY - cardSize.height / 2)

    setDropPreview({
      x: nextX,
      y: nextY,
      width: cardSize.width,
      height: cardSize.height,
      card: draggingHandCard.card,
    })
  }, [draggingHandCard, transform])

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 1 && event.button !== 0) return

    if (event.button === 1 || (event.button === 0 && (event.target as HTMLElement).dataset.canvas === 'true' && !isAnnotationPlacementActive)) {
      setSelectedAnnotationId(null)
      setEditingAnnotationId(null)
      isPanning.current = true
      setIsPanningActive(true)
      panStart.current = { mx: event.clientX, my: event.clientY, tx: transform.x, ty: transform.y }
      event.preventDefault()
    }
  }, [isAnnotationPlacementActive, transform])

  const onMouseMove = useCallback((event: React.MouseEvent) => {
    if (connectionDraftFromCardId) {
      updatePointerWorld(event.clientX, event.clientY)
    }

    if (!isPanning.current) return

    const dx = event.clientX - panStart.current.mx
    const dy = event.clientY - panStart.current.my
    setTransform((value) => ({ ...value, x: panStart.current.tx + dx, y: panStart.current.ty + dy }))
  }, [connectionDraftFromCardId, updatePointerWorld])

  const onMouseUp = useCallback(() => {
    isPanning.current = false
    setIsPanningActive(false)
  }, [])

  useEffect(() => {
    if (!room) {
      setSelectedAnnotationId(null)
      setEditingAnnotationId(null)
      return
    }

    if (selectedAnnotationId && !room.annotations.some((annotation) => annotation.id === selectedAnnotationId)) {
      setSelectedAnnotationId(null)
    }

    if (editingAnnotationId && !room.annotations.some((annotation) => annotation.id === editingAnnotationId)) {
      setEditingAnnotationId(null)
    }
  }, [editingAnnotationId, room, selectedAnnotationId])

  useEffect(() => {
    if (!draggingHandCard) {
      setDropPreview(null)
    }
  }, [draggingHandCard])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = event.deltaY < 0 ? 1.1 : 0.9

      setTransform((value) => {
        const newScale = Math.min(3, Math.max(0.2, value.scale * factor))
        const rect = container.getBoundingClientRect()
        const cx = event.clientX - rect.left
        const cy = event.clientY - rect.top

        return {
          scale: newScale,
          x: cx - (cx - value.x) * (newScale / value.scale),
          y: cy - (cy - value.y) * (newScale / value.scale),
        }
      })
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [])

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes('application/dh-card-id')) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      const dragCardType = event.dataTransfer.getData('application/dh-card-type') as CardType
      updateDropPreview(event.clientX, event.clientY, dragCardType)
    }
  }, [updateDropPreview])

  const currentPlayerColor = room?.players.find((player) => player.id === currentPlayerId)?.color

  const onDrop = useCallback((event: React.DragEvent) => {
    const cardId = event.dataTransfer.getData('application/dh-card-id')
    const cardType = event.dataTransfer.getData('application/dh-card-type') as CardType
    if (!cardId || !containerRef.current) return

    event.preventDefault()

    const rect = containerRef.current.getBoundingClientRect()
    const fallbackCardSize = getCardGridSize(cardType || 'Hook')
    const fallbackWorldX = snapToGrid(((event.clientX - rect.left - transform.x) / transform.scale) - fallbackCardSize.width / 2)
    const fallbackWorldY = snapToGrid(((event.clientY - rect.top - transform.y) / transform.scale) - fallbackCardSize.height / 2)
    const targetX = dropPreview?.x ?? fallbackWorldX
    const targetY = dropPreview?.y ?? fallbackWorldY
    const targetWidth = dropPreview?.width ?? fallbackCardSize.width
    const targetHeight = dropPreview?.height ?? fallbackCardSize.height

    triggerPlacementAnimation(cardId, {
      left: rect.left + transform.x + targetX * transform.scale,
      top: rect.top + transform.y + targetY * transform.scale,
      width: targetWidth * transform.scale,
      height: targetHeight * transform.scale,
    }, currentPlayerColor)

    setDropPreview(null)
    playCard(cardId, targetX, targetY)
  }, [currentPlayerColor, dropPreview, playCard, transform, triggerPlacementAnimation])

  const bgPos = `${transform.x % (GRID_SIZE * transform.scale)}px ${transform.y % (GRID_SIZE * transform.scale)}px`
  const bgSize = `${GRID_SIZE * transform.scale}px ${GRID_SIZE * transform.scale}px`

  const createAnnotationAt = useCallback((clientX: number, clientY: number) => {
    const worldPoint = toWorldPoint(clientX, clientY)
    if (!worldPoint) return

    const annotationId = nanoid()
    const created = addAnnotation({
      id: annotationId,
      text: '新标注',
      x: worldPoint.x,
      y: worldPoint.y,
      font_size: 18,
    })

    if (!created) return

    setAnnotationPlacement(false)
    setSelectedAnnotationId(annotationId)
    setEditingAnnotationId(annotationId)
  }, [addAnnotation, setAnnotationPlacement, toWorldPoint])

  const connectionDraftSource = useMemo(() => {
    if (!room || !connectionDraftFromCardId) return null
    return room.map_cards.find((card) => card.id === connectionDraftFromCardId) ?? null
  }, [connectionDraftFromCardId, room])

  const previewPath = connectionDraftSource && pointerWorld
    ? {
        x1: connectionDraftSource.x + connectionDraftSource.width / 2,
        y1: connectionDraftSource.y + connectionDraftSource.height / 2,
        x2: pointerWorld.x,
        y2: pointerWorld.y,
      }
    : null

  const connectionRenderData = useMemo(() => {
    if (!room) return []

    return room.connections.flatMap((connection) => {
      const from = room.map_cards.find((card) => card.id === connection.from_card_id)
      const to = room.map_cards.find((card) => card.id === connection.to_card_id)
      if (!from || !to) return []
      return [buildConnectionRenderData(connection, from, to)]
    })
  }, [room])

  const dropPreviewConfig = dropPreview ? getCardVisualConfig(dropPreview.card.type, dropPreview.card.style, dropPreview.card.custom_type_name) : null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-base)',
        backgroundImage: 'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
        backgroundSize: bgSize,
        backgroundPosition: bgPos,
        cursor: isPanningActive ? 'grabbing' : (connectionDraftSource || isAnnotationPlacementActive) ? 'crosshair' : 'default',
        userSelect: 'none',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget as Node | null
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
          setDropPreview(null)
        }
      }}
      onDrop={onDrop}
      onContextMenu={(event) => {
        event.preventDefault()
        if (connectionDraftFromCardId) cancelConnection()
        setContextMenu(null)
      }}
      onClick={(event) => {
        const target = event.target as HTMLElement

        if (isAnnotationPlacementActive) {
          if (
            target.closest('.dh-card')
            || target.closest('[data-annotation-node="true"]')
            || target.closest('button')
            || target.closest('textarea')
            || target.closest('input')
          ) {
            return
          }

          createAnnotationAt(event.clientX, event.clientY)
          return
        }

        if (
          !target.closest('.dh-card')
          && !target.closest('[data-annotation-node="true"]')
          && !target.closest('button')
          && !target.closest('textarea')
          && !target.closest('input')
        ) {
          setSelectedAnnotationId(null)
          setEditingAnnotationId(null)
        }
      }}
    >
      {draggingHandCard && (
        <div
          style={{
            position: 'absolute',
            inset: 12,
            border: dropPreview ? '1px solid rgba(37,99,235,0.26)' : '1px dashed rgba(37,99,235,0.22)',
            background: dropPreview
              ? 'linear-gradient(180deg, rgba(37,99,235,0.04), rgba(37,99,235,0.01))'
              : 'transparent',
            boxShadow: dropPreview ? 'inset 0 0 0 2px rgba(37,99,235,0.08)' : 'none',
            pointerEvents: 'none',
            zIndex: 5,
            transition: 'all 120ms ease',
          }}
        />
      )}

      <div
        data-canvas="true"
        style={{
          position: 'absolute',
          transformOrigin: '0 0',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          width: 4000,
          height: 3000,
        }}
      >
        {dropPreview && dropPreviewConfig && (
          <div
            style={{
              position: 'absolute',
              left: dropPreview.x,
              top: dropPreview.y,
              width: dropPreview.width,
              height: dropPreview.height,
              border: `2px dashed ${dropPreviewConfig.color}`,
              background: `linear-gradient(180deg, ${dropPreviewConfig.bg}, rgba(255,255,255,0.84))`,
              boxShadow: `0 12px 28px rgba(15,23,42,0.14), 0 0 0 1px ${dropPreviewConfig.border}`,
              opacity: 0.78,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 10px',
                borderBottom: `1px solid ${dropPreviewConfig.border}`,
                color: dropPreviewConfig.color,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}
            >
              <dropPreviewConfig.Icon size={12} />
              <span>{dropPreviewConfig.label}</span>
            </div>
            <div
              style={{
                padding: '0 12px 14px',
                textAlign: 'center',
                color: 'var(--text-primary)',
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {dropPreview.card.title}
            </div>
            <div
              style={{
                position: 'absolute',
                right: 10,
                bottom: 10,
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--accent-violet)',
                background: 'rgba(255,255,255,0.92)',
                border: '1px solid rgba(37,99,235,0.18)',
                padding: '3px 8px',
              }}
            >
              在此落牌
            </div>
          </div>
        )}

        {room?.annotations.map((annotation) => (
          <AnnotationNode
            key={annotation.id}
            annotation={annotation}
            canvasScale={transform.scale}
            selected={selectedAnnotationId === annotation.id}
            editing={editingAnnotationId === annotation.id}
            onSelect={setSelectedAnnotationId}
            onStartEdit={(annotationId) => {
              setSelectedAnnotationId(annotationId)
              setEditingAnnotationId(annotationId)
            }}
            onStopEdit={() => setEditingAnnotationId(null)}
          />
        ))}

        <svg
          data-canvas="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="var(--conn-conflict)" />
            </marker>
            <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="var(--conn-ally)" />
            </marker>
            <marker id="arrow-gray" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="var(--conn-unknown)" />
            </marker>
          </defs>

          {connectionRenderData.map((connection) => {
            return (
              <g key={connection.id}>
                <path
                  d={connection.path}
                  stroke="transparent"
                  strokeWidth="14"
                  fill="none"
                  style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    openConnectionEditor({
                      connectionId: connection.id,
                      fromCardId: connection.fromCardId,
                      toCardId: connection.toCardId,
                    })
                  }}
                />
                <path
                  d={connection.path}
                  stroke={connection.strokeColor}
                  strokeWidth="1.5"
                  strokeOpacity="0.72"
                  fill="none"
                  markerEnd={`url(#arrow-${connection.markerColor})`}
                  pointerEvents="none"
                />
              </g>
            )
          })}

          {previewPath && (
            <path
              d={`M ${previewPath.x1} ${previewPath.y1} L ${previewPath.x2} ${previewPath.y2}`}
              stroke="var(--accent-violet)"
              strokeWidth="1.5"
              strokeDasharray="7 5"
              strokeOpacity="0.8"
              fill="none"
              pointerEvents="none"
            />
          )}
        </svg>

        {room?.map_cards.map((card) => (
          <DhCardNode
            key={card.id}
            card={card}
            canvasScale={transform.scale}
            isCurrentPlayer={card.placed_by === room.players.find((player) => player.id === room.current_turn_player_id)?.nickname}
          />
        ))}

        <svg
          data-canvas="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
        >
          {connectionRenderData.map((connection) => {
            if (!connection.label) return null

            return (
              <g
                key={`${connection.id}-label`}
                style={{ cursor: 'pointer', pointerEvents: 'all' }}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  openConnectionEditor({
                    connectionId: connection.id,
                    fromCardId: connection.fromCardId,
                    toCardId: connection.toCardId,
                  })
                }}
              >
                <rect
                  x={connection.labelX - connection.labelWidth / 2}
                  y={connection.labelY - 11}
                  width={connection.labelWidth}
                  height={22}
                  rx={11}
                  fill="rgba(255,255,255,0.96)"
                  stroke={connection.strokeColor}
                  strokeOpacity="0.28"
                />
                <text
                  x={connection.labelX}
                  y={connection.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10"
                  fill={connection.strokeColor}
                  fontFamily="'Noto Sans SC', sans-serif"
                  fontWeight="700"
                >
                  {connection.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {placementAnimation && (
        <CardTravelAnimationOverlay
          key={placementAnimation.id}
          card={placementAnimation.card}
          fromRect={placementAnimation.fromRect}
          toRect={placementAnimation.toRect}
          playerColor={placementAnimation.playerColor}
          direction="to-map"
          onComplete={clearPlacementAnimation}
        />
      )}

      {recycleAnimation && (
        <CardTravelAnimationOverlay
          key={recycleAnimation.id}
          card={recycleAnimation.card}
          fromRect={recycleAnimation.fromRect}
          toRect={recycleAnimation.toRect}
          playerColor={recycleAnimation.playerColor}
          direction="to-hand"
          onComplete={clearRecycleAnimation}
        />
      )}

      {connectionDraftSource && (
        <div
          className="glass-panel-sm"
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            zIndex: 250,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(37,99,235,0.1)',
              color: 'var(--accent-violet)',
              border: '1px solid rgba(37,99,235,0.18)',
            }}
          >
            <Link2 size={14} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              正在从“{connectionDraftSource.title}”发起连线
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              点击另一张卡牌选择目标，再设置关系类型和标签。
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={cancelConnection} title="取消连线">
            <X size={14} />
          </button>
        </div>
      )}

      {isAnnotationPlacementActive && (
        <div
          className="glass-panel-sm"
          style={{
            position: 'absolute',
            left: 14,
            bottom: 116,
            zIndex: 250,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(37,99,235,0.1)',
              color: 'var(--accent-violet)',
              border: '1px solid rgba(37,99,235,0.18)',
            }}
          >
            <Type size={14} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              点击画布放置文字标注
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
              放下后会直接进入编辑，空内容会自动删除。
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={() => setAnnotationPlacement(false)} title="取消放置标注">
            <X size={14} />
          </button>
        </div>
      )}

      <div
        className="glass-panel-sm"
        style={{
          position: 'absolute',
          left: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 250,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '8px',
        }}
      >
        <button
          title="浏览和选择画布内容"
          className={`btn btn-icon ${!isAnnotationPlacementActive ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setAnnotationPlacement(false)}
        >
          <MousePointer2 size={15} />
        </button>
        <button
          title={isAnnotationPlacementActive ? '取消标注放置' : '添加文字标注'}
          className={`btn btn-icon ${isAnnotationPlacementActive ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setAnnotationPlacement(!isAnnotationPlacementActive)}
        >
          <Type size={15} />
        </button>
        <div style={{ width: '100%', height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />
        <button className="btn btn-secondary btn-icon" onClick={() => zoomCanvas(0.9)} title="缩小">
          <ZoomOut size={15} />
        </button>
        <button className="btn btn-secondary btn-icon" onClick={() => zoomCanvas(1.1)} title="放大">
          <ZoomIn size={15} />
        </button>
        <button className="btn btn-secondary btn-icon" onClick={resetCanvasView} title="重置视图">
          <LocateFixed size={15} />
        </button>
      </div>

      <CardContextMenu />
    </div>
  )
}

function CardTravelAnimationOverlay({
  card,
  fromRect,
  toRect,
  playerColor,
  direction,
  onComplete,
}: {
  card: DhCard
  fromRect: { left: number; top: number; width: number; height: number }
  toRect: { left: number; top: number; width: number; height: number }
  playerColor?: string
  direction: 'to-map' | 'to-hand'
  onComplete: () => void
}) {
  const [entered, setEntered] = useState(false)
  const cfg = getCardVisualConfig(card.type, card.style, card.custom_type_name)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true))
    const timer = window.setTimeout(onComplete, 400)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [onComplete])

  const baseRect = direction === 'to-map' ? toRect : fromRect
  const fromCenterX = fromRect.left + fromRect.width / 2
  const fromCenterY = fromRect.top + fromRect.height / 2
  const toCenterX = toRect.left + toRect.width / 2
  const toCenterY = toRect.top + toRect.height / 2

  const startTranslateX = fromCenterX - toCenterX
  const startTranslateY = fromCenterY - toCenterY
  const endTranslateX = toCenterX - fromCenterX
  const endTranslateY = toCenterY - fromCenterY

  const startScaleX = Math.max(0.2, fromRect.width / Math.max(toRect.width, 1))
  const startScaleY = Math.max(0.2, fromRect.height / Math.max(toRect.height, 1))
  const endScaleX = Math.max(0.18, toRect.width / Math.max(fromRect.width, 1))
  const endScaleY = Math.max(0.18, toRect.height / Math.max(fromRect.height, 1))

  const transform = direction === 'to-map'
    ? (
      entered
        ? 'translate(0px, 0px) scale(1, 1) rotate(0deg)'
        : `translate(${startTranslateX}px, ${startTranslateY}px) scale(${startScaleX}, ${startScaleY}) rotate(-6deg)`
    )
    : (
      entered
        ? `translate(${endTranslateX}px, ${endTranslateY}px) scale(${endScaleX}, ${endScaleY}) rotate(6deg)`
        : 'translate(0px, 0px) scale(1, 1) rotate(0deg)'
    )

  return (
    <div
      className={`dh-card dh-card--${card.type.toLowerCase()}`}
      style={{
        position: 'fixed',
        left: baseRect.left,
        top: baseRect.top,
        width: baseRect.width,
        height: baseRect.height,
        background: 'rgba(255,255,255,0.96)',
        borderColor: cfg.border,
        boxShadow: direction === 'to-map'
          ? (entered ? `0 1px 2px rgba(15,23,42,0.12), 0 0 0 2px ${(playerColor ?? cfg.color)}22` : '0 10px 24px rgba(15,23,42,0.2)')
          : (entered ? '0 10px 24px rgba(15,23,42,0.16)' : `0 1px 2px rgba(15,23,42,0.12), 0 0 0 2px ${(playerColor ?? cfg.color)}22`),
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 650,
        opacity: direction === 'to-map'
          ? (entered ? 0.8 : 0.96)
          : (entered ? 0.4 : 0.96),
        transform,
        transformOrigin: 'center center',
        transition: 'transform 360ms cubic-bezier(0.22,1,0.36,1), opacity 360ms ease, box-shadow 360ms ease',
      }}
    >
      {playerColor && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 8,
            height: 8,
            background: playerColor,
            boxShadow: `0 0 0 1px ${playerColor}`,
          }}
        />
      )}

      <div
        className="dh-card__header"
        style={{
          background: cfg.color,
          borderBottomColor: cfg.border,
          color: cfg.textOnColor,
          paddingRight: 24,
        }}
      >
        <div className="dh-card__title">
          {card.title}
        </div>
      </div>
    </div>
  )
}
