import React, { useRef, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import type { MapCard } from '@/types'
import { getCardVisualConfig } from '@/utils/cardTypeConfig'
import { getCardBodyLines } from '@/utils/cardText'
import { ChevronDown, ChevronUp, Lock, Maximize2 } from 'lucide-react'
import { GRID_SIZE, MIN_CARD_GRID_COLS, MIN_CARD_GRID_ROWS } from '@/utils/grid'

interface CardNodeProps {
  card: MapCard
  isCurrentPlayer: boolean
  canvasScale: number
}

export function DhCardNode({ card, canvasScale }: CardNodeProps) {
  const {
    room, currentPlayerId, toggleExpandCard, resizeCard, commitResizeCard,
    lockCard, unlockCard, moveCard, commitMoveCard, updateCardTerritory,
    commitCardTerritory, setContextMenu, connectionDraftFromCardId, completeConnection,
  } = useStore()
  const cfg = getCardVisualConfig(card.type, card.style, card.custom_type_name)
  const currentPlayerName = room?.players.find(p => p.id === currentPlayerId)?.nickname
  const isLocked = !!card.locked_by && card.locked_by !== currentPlayerName
  const territory = card.type === 'Location' ? card.territory : undefined
  const bodyLines = getCardBodyLines(card)

  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null)
  const resizeStart = useRef<{ mx: number; my: number; width: number; height: number } | null>(null)
  const territoryDragStart = useRef<{ mx: number; my: number; ox: number; oy: number; width: number; height: number } | null>(null)
  const territoryResizeStart = useRef<{ mx: number; my: number; x: number; y: number; width: number; height: number } | null>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (connectionDraftFromCardId) {
      e.stopPropagation()
      completeConnection(card.id)
      return
    }

    if (isLocked) return
    e.stopPropagation()
    lockCard(card.id)
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: card.x, oy: card.y }

    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return
      const dx = (ev.clientX - dragStart.current.mx) / canvasScale
      const dy = (ev.clientY - dragStart.current.my) / canvasScale
      moveCard(card.id, dragStart.current.ox + dx, dragStart.current.oy + dy)
    }
    const onUp = () => {
      if (dragStart.current) {
        const latestCard = useStore.getState().room?.map_cards.find((item) => item.id === card.id)
        if (latestCard) {
          commitMoveCard(card.id, latestCard.x, latestCard.y)
        }
      }
      unlockCard(card.id)
      dragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [
    card.id,
    card.x,
    card.y,
    canvasScale,
    commitMoveCard,
    completeConnection,
    connectionDraftFromCardId,
    isLocked,
    lockCard,
    unlockCard,
    moveCard,
  ])

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLocked) return
    e.stopPropagation()
    lockCard(card.id)
    resizeStart.current = { mx: e.clientX, my: e.clientY, width: card.width, height: card.height }

    const onMove = (ev: MouseEvent) => {
      if (!resizeStart.current) return
      const dx = (ev.clientX - resizeStart.current.mx) / canvasScale
      const dy = (ev.clientY - resizeStart.current.my) / canvasScale
      const minWidth = MIN_CARD_GRID_COLS * GRID_SIZE
      const minHeight = MIN_CARD_GRID_ROWS * GRID_SIZE
      const nextWidth = Math.max(minWidth, resizeStart.current.width + dx)
      const nextHeight = Math.max(minHeight, resizeStart.current.height + dy)
      resizeCard(card.id, nextWidth, nextHeight)
    }

    const onUp = () => {
      const latestCard = useStore.getState().room?.map_cards.find((item) => item.id === card.id)
      if (latestCard) {
        commitResizeCard(card.id, latestCard.width, latestCard.height)
      }
      unlockCard(card.id)
      resizeStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [
    card.height, card.id, card.width,
    canvasScale, commitResizeCard, isLocked, lockCard, resizeCard, unlockCard,
  ])

  const onTerritoryMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLocked || !territory) return
    e.stopPropagation()
    lockCard(card.id)
    territoryDragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: territory.x,
      oy: territory.y,
      width: territory.width,
      height: territory.height,
    }

    const onMove = (ev: MouseEvent) => {
      if (!territoryDragStart.current) return
      const dx = (ev.clientX - territoryDragStart.current.mx) / canvasScale
      const dy = (ev.clientY - territoryDragStart.current.my) / canvasScale
      updateCardTerritory(card.id, {
        x: territoryDragStart.current.ox + dx,
        y: territoryDragStart.current.oy + dy,
        width: territoryDragStart.current.width,
        height: territoryDragStart.current.height,
      })
    }

    const onUp = () => {
      const latestCard = useStore.getState().room?.map_cards.find((item) => item.id === card.id)
      if (latestCard?.type === 'Location' && latestCard.territory) {
        commitCardTerritory(card.id, latestCard.territory)
      }
      unlockCard(card.id)
      territoryDragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [canvasScale, card.id, commitCardTerritory, isLocked, lockCard, territory, unlockCard, updateCardTerritory])

  const onTerritoryResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLocked || !territory) return
    e.stopPropagation()
    lockCard(card.id)
    territoryResizeStart.current = {
      mx: e.clientX,
      my: e.clientY,
      x: territory.x,
      y: territory.y,
      width: territory.width,
      height: territory.height,
    }

    const onMove = (ev: MouseEvent) => {
      if (!territoryResizeStart.current) return
      const dx = (ev.clientX - territoryResizeStart.current.mx) / canvasScale
      const dy = (ev.clientY - territoryResizeStart.current.my) / canvasScale
      updateCardTerritory(card.id, {
        x: territoryResizeStart.current.x,
        y: territoryResizeStart.current.y,
        width: territoryResizeStart.current.width + dx,
        height: territoryResizeStart.current.height + dy,
      })
    }

    const onUp = () => {
      const latestCard = useStore.getState().room?.map_cards.find((item) => item.id === card.id)
      if (latestCard?.type === 'Location' && latestCard.territory) {
        commitCardTerritory(card.id, latestCard.territory)
      }
      unlockCard(card.id)
      territoryResizeStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [canvasScale, card.id, commitCardTerritory, isLocked, lockCard, territory, unlockCard, updateCardTerritory])

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, cardId: card.id })
  }, [card.id, setContextMenu])

  return (
    <>
      {/* Territory area (Location cards only) */}
      {territory && (
        <div
          className="territory-area"
          style={{
            position: 'absolute',
            left: territory.x,
            top: territory.y,
            width: territory.width,
            height: territory.height,
            background: cfg.color,
            border: `1px dashed ${cfg.color}99`,
            cursor: isLocked ? 'not-allowed' : 'move',
            zIndex: 0,
          }}
          onMouseDown={onTerritoryMouseDown}
          onContextMenu={onContextMenu}
        />
      )}

      {territory && (
        <>
          <div
            style={{
              position: 'absolute',
              left: territory.x + 8,
              top: territory.y + 8,
              maxWidth: Math.max(territory.width - 16, 48),
              padding: '2px 8px',
              fontSize: 11,
              letterSpacing: '0.06em',
              color: cfg.color,
              background: `${cfg.color}14`,
              border: `1px solid ${cfg.color}55`,
              overflow: 'hidden',
              pointerEvents: 'none',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              zIndex: 1,
            }}
          >
            {card.title || '疆域'}
          </div>

          <button
            title="拖拽调整疆域"
            style={{
              position: 'absolute',
              left: territory.x + territory.width - 22,
              top: territory.y + territory.height - 22,
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-overlay)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              cursor: isLocked ? 'not-allowed' : 'nwse-resize',
              zIndex: 1,
            }}
            onMouseDown={onTerritoryResizeMouseDown}
            onClick={e => e.stopPropagation()}
          >
            <Maximize2 size={10} />
          </button>
        </>
      )}

      {/* Card */}
      <div
        className={`dh-card dh-card--${card.type.toLowerCase()} ${isLocked ? 'dh-card--locked' : ''}`}
        data-map-card-id={card.id}
        style={{
          position: 'absolute',
          left: card.x,
          top: card.y,
          width: card.width,
          height: card.height,
          borderColor: cfg.border,
          boxShadow: `0 1px 2px rgba(15,23,42,0.12)`,
          zIndex: 2,
        }}
        onMouseDown={onMouseDown}
        onContextMenu={onContextMenu}
      >
        {/* Player color indicator */}
        <div style={{
          position: 'absolute', top: 6, right: 6,
          width: 8, height: 8, borderRadius: 0,
          background: card.player_color,
          boxShadow: `0 0 0 1px ${card.player_color}`,
        }} />

        <div
          className="dh-card__header"
          style={{
            background: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.05) 100%), ${cfg.color}`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
            borderBottomColor: cfg.border,
            color: cfg.textOnColor,
            paddingRight: 24,
          }}
        >
          <div className="dh-card__title">
            {card.title}
          </div>
        </div>

        <div className="dh-card__body">
          {/* Content (expanded only) */}
          {card.is_expanded && bodyLines.length > 0 && (
            <div className="dh-card__content">
              {bodyLines.map((line, index) => (
                <div key={`${index}-${line}`}>{line}</div>
              ))}
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          style={{
            position: 'absolute', bottom: 4, left: 4,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 2,
            display: 'flex', alignItems: 'center',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          onClick={e => { e.stopPropagation(); toggleExpandCard(card.id) }}
        >
          {card.is_expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        <button
          title={`拖拽调整尺寸 · ${card.grid_cols} × ${card.grid_rows}`}
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-default)',
            cursor: 'nwse-resize',
            color: 'var(--text-secondary)',
            padding: 2,
            width: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseDown={onResizeMouseDown}
          onClick={e => e.stopPropagation()}
        >
          <Maximize2 size={10} />
        </button>

        {/* Locked indicator */}
        {isLocked && (
          <div style={{
            position: 'absolute', top: 4, left: 4,
            background: 'rgba(245,158,11,0.16)', borderRadius: 0, padding: '1px 5px',
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 9, color: 'var(--accent-amber)',
          }}>
            <Lock size={8} /> {card.locked_by}
          </div>
        )}
      </div>
    </>
  )
}
