import React from 'react'
import { useStore } from '@/store/useStore'
import { Crown, Wifi, WifiOff, SkipForward } from 'lucide-react'

export function PlayerPanel() {
  const { room, currentPlayerId, isPlayerPanelOpen, togglePlayerPanel, forceSkipTurn } = useStore()

  if (!room) return null

  const isHost = currentPlayerId === room.host_player_id

  return (
    <div style={{
      position: 'absolute',
      top: 72,
      left: 12,
      zIndex: 100,
    }}>
      <div className="glass-panel" style={{ width: 200, overflow: 'hidden' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            cursor: 'pointer',
          }}
          onClick={togglePlayerPanel}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flex: 1, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            玩家 · {room.players.filter(p => p.is_online).length}/{room.players.length}
          </span>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: room.players.filter(p => p.is_online).length }).map((_, i) => (
              <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-emerald)' }} />
            ))}
          </div>
        </div>

        {/* Players list */}
        {isPlayerPanelOpen && (
          <div style={{ padding: '6px 4px' }}>
            {room.turn_order.map(pid => {
              const player = room.players.find(p => p.id === pid)
              if (!player) return null
              const isActiveTurn = room.mode === 'co-creation' && room.current_turn_player_id === pid
              const isMe = pid === currentPlayerId

              return (
                <div
                  key={pid}
                  className={`player-pill ${!player.is_online ? 'player-pill--offline' : ''} ${isActiveTurn ? 'player-pill--active-turn' : ''}`}
                >
                  {/* Color dot */}
                  <div
                    className={`player-dot ${player.is_online ? 'player-dot--online' : ''}`}
                    style={{ background: player.color, color: player.color }}
                  />

                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12.5, fontWeight: isActiveTurn ? 600 : 400,
                      color: player.is_online ? 'var(--text-primary)' : 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {player.nickname}
                      {isMe && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>（你）</span>}
                    </div>
                    {isActiveTurn && (
                      <div style={{ fontSize: 10, color: 'var(--accent-violet)', fontWeight: 600, marginTop: 1 }}>
                        当前回合
                      </div>
                    )}
                  </div>

                  {/* Icons */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {player.is_host && <Crown size={11} color="var(--accent-amber)" />}
                    {player.is_online
                      ? <Wifi size={11} color="var(--accent-emerald)" />
                      : <WifiOff size={11} color="var(--text-muted)" />}
                  </div>
                </div>
              )
            })}

            {/* Force skip (host only, co-creation mode) */}
            {isHost && room.mode === 'co-creation' && room.current_turn_player_id && (
              <div style={{ padding: '6px 6px 2px', borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', fontSize: 11 }}
                  onClick={() => forceSkipTurn(room.current_turn_player_id!)}
                >
                  <SkipForward size={11} /> 强制跳过
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
