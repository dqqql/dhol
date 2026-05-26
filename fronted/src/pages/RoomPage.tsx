import React from 'react'
import { GmPanelBoard } from '@/components/gm-panel/GmPanelBoard'
import { TopBar } from '@/components/layout/TopBar'
import { RoomSettingsModal } from '@/components/ui/RoomSettingsModal'
import { ToastContainer } from '@/components/ui/Toast'
import { useStore } from '@/store/useStore'

interface RoomPageProps {
  onLeaveRoom: () => void
}

export function RoomPage({ onLeaveRoom }: RoomPageProps) {
  const { room, connectionStatus, manualReconnect } = useStore()

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
            background: connectionStatus === 'error' ? 'rgba(177,45,63,0.14)' : 'rgba(223,200,82,0.16)',
            borderBottom: `1px solid ${connectionStatus === 'error' ? 'rgba(177,45,63,0.26)' : 'rgba(223,200,82,0.28)'}`,
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
        <GmPanelBoard />
      </div>

      <RoomSettingsModal />
      <ToastContainer />
    </div>
  )
}
