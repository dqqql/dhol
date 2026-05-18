import React, { useEffect, useRef, useState } from 'react'
import { GmPanelBoard } from '@/components/gm-panel/GmPanelBoard'
import { TopBar } from '@/components/layout/TopBar'
import { MapCanvas } from '@/components/map/MapCanvas'
import { HandArea } from '@/components/panels/HandArea'
import { PlayerPanel } from '@/components/panels/PlayerPanel'
import { ResourceTrackerBoard } from '@/components/resource/ResourceTrackerBoard'
import { CardLibraryModal } from '@/components/ui/CardLibraryModal'
import { ConnectionModal } from '@/components/ui/ConnectionModal'
import { CreateCardModal } from '@/components/ui/CreateCardModal'
import { DrawModal } from '@/components/ui/DrawModal'
import { EditCardModal } from '@/components/ui/EditCardModal'
import { EndCoCreationConfirm } from '@/components/ui/EndCoCreationConfirm'
import { ImportModal } from '@/components/ui/ImportModal'
import { RoomSettingsModal } from '@/components/ui/RoomSettingsModal'
import { ToastContainer } from '@/components/ui/Toast'
import { TurnStartModal } from '@/components/ui/TurnStartModal'
import { useStore } from '@/store/useStore'

interface RoomPageProps {
  onLeaveRoom: () => void
}

export function RoomPage({ onLeaveRoom }: RoomPageProps) {
  const { room, connectionStatus, manualReconnect, currentPlayerId, drawCards } = useStore()
  const [isTurnStartModalOpen, setIsTurnStartModalOpen] = useState(false)
  const previousTurnPlayerIdRef = useRef<string | null>(null)
  const previousHasDrawnThisTurnRef = useRef(false)
  const hasPromptedCurrentTurnRef = useRef(false)

  useEffect(() => {
    if (!room || room.mode !== 'co-creation') {
      previousTurnPlayerIdRef.current = room?.current_turn_player_id ?? null
      previousHasDrawnThisTurnRef.current = false
      hasPromptedCurrentTurnRef.current = false
      setIsTurnStartModalOpen(false)
      return
    }

    const currentTurnPlayerId = room.current_turn_player_id
    const previousTurnPlayerId = previousTurnPlayerIdRef.current
    const isMyTurn = currentTurnPlayerId === currentPlayerId
    const hasDrawnThisTurn = room.drawn_this_turn[currentPlayerId] ?? false

    if (previousTurnPlayerId !== currentTurnPlayerId) {
      hasPromptedCurrentTurnRef.current = false
    }

    // In a single-player room, the turn can advance back to the same player id.
    // Treat a drawn=true -> false reset as a fresh turn so the turn-start flow reopens.
    if (previousHasDrawnThisTurnRef.current && !hasDrawnThisTurn) {
      hasPromptedCurrentTurnRef.current = false
    }

    if (isMyTurn && !hasDrawnThisTurn && !hasPromptedCurrentTurnRef.current) {
      setIsTurnStartModalOpen(true)
      hasPromptedCurrentTurnRef.current = true
    }

    if (!isMyTurn || hasDrawnThisTurn) {
      setIsTurnStartModalOpen(false)
    }

    previousTurnPlayerIdRef.current = currentTurnPlayerId
    previousHasDrawnThisTurnRef.current = hasDrawnThisTurn
  }, [room, currentPlayerId])

  if (!room) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base)',
          color: 'var(--text-secondary)',
          fontSize: 14,
        }}
      >
        {connectionStatus === 'connecting' ? '正在同步房间状态…' : '房间状态尚未就绪'}
        <ToastContainer />
      </div>
    )
  }

  const showReconnectBanner = connectionStatus === 'reconnecting' || connectionStatus === 'error'
  const isResourceTracker = room.room_type === 'resource-tracker'
  const isGmPanel = room.room_type === 'gm-panel'

  function handleTurnStartDraw() {
    setIsTurnStartModalOpen(false)
    drawCards()
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <TopBar onLeaveRoom={onLeaveRoom} />

      {showReconnectBanner && (
        <div
          style={{
            position: 'absolute',
            top: 52,
            left: 0,
            right: 0,
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '8px 14px',
            background: connectionStatus === 'error' ? 'rgba(244,63,94,0.12)' : 'rgba(245,158,11,0.12)',
            borderBottom: `1px solid ${connectionStatus === 'error' ? 'var(--accent-rose)' : 'var(--accent-amber)'}`,
            fontSize: 13,
            color: connectionStatus === 'error' ? 'var(--accent-rose)' : 'var(--accent-amber)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {connectionStatus === 'error' ? (
            <>
              <span>与房间的连接已断开</span>
              <button
                style={{
                  padding: '3px 12px',
                  borderRadius: 99,
                  border: '1px solid var(--accent-rose)',
                  background: 'var(--accent-rose)',
                  color: 'white',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                onClick={manualReconnect}
              >
                重新连接
              </button>
            </>
          ) : (
            <span>正在重新连接到房间…</span>
          )}
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, top: showReconnectBanner ? 92 : 52 }}>
        {isGmPanel ? <GmPanelBoard /> : isResourceTracker ? <ResourceTrackerBoard /> : <MapCanvas />}
      </div>

      {!isResourceTracker && !isGmPanel && (
        <>
          <PlayerPanel />
          <HandArea />

          <DrawModal />
          <TurnStartModal
            open={isTurnStartModalOpen}
            onClose={() => setIsTurnStartModalOpen(false)}
            onDraw={handleTurnStartDraw}
          />
          <CreateCardModal />
          <EditCardModal />
          <ConnectionModal />
          <EndCoCreationConfirm />
        </>
      )}
      <RoomSettingsModal />
      {!isResourceTracker && !isGmPanel && (
        <>
          <ImportModal />
          <CardLibraryModal />
        </>
      )}

      <ToastContainer />
    </div>
  )
}
