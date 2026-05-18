import React, { useState } from 'react'
import { Check, Clock, Copy } from 'lucide-react'
import { Modal } from './Modal'
import { useStore } from '@/store/useStore'

function roomTypeLabel(roomType: string) {
  if (roomType === 'gm-panel') return 'GM 面板'
  if (roomType === 'resource-tracker') return '追踪资源'
  return '共创房间'
}

export function RoomSettingsModal() {
  const { room, currentPlayerId, isRoomSettingsOpen, closeRoomSettings, addToast } = useStore()
  const [copied, setCopied] = useState(false)

  if (!room) return null
  const currentRoom = room

  const expiresAt = new Date(currentRoom.expires_at)
  const isHost = currentRoom.host_player_id === currentPlayerId

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(currentRoom.invite_code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
      addToast('邀请码已复制。', 'success')
    } catch {
      addToast('复制邀请码失败。', 'error')
    }
  }

  return (
    <Modal open={isRoomSettingsOpen} onClose={closeRoomSettings} title="房间设置" maxWidth={640}>
      <div style={{ display: 'grid', gap: 16 }}>
        <section
          style={{
            padding: 16,
            borderRadius: 16,
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ marginBottom: 4, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{currentRoom.room_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>{roomTypeLabel(currentRoom.room_type)}</div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div style={rowStyle}>
              <span style={labelStyle}>邀请码</span>
              <button type="button" onClick={copyCode} className="btn btn-secondary btn-sm">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {currentRoom.invite_code}
              </button>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>到期时间</span>
              <span style={valueStyle}>
                <Clock size={13} />
                {Number.isNaN(expiresAt.getTime()) ? currentRoom.expires_at : expiresAt.toLocaleString()}
              </span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>当前模式</span>
              <span style={valueStyle}>{currentRoom.mode}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>你的身份</span>
              <span style={valueStyle}>{isHost ? '房主' : '成员'}</span>
            </div>
          </div>
        </section>

        <section
          style={{
            padding: 16,
            borderRadius: 16,
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ marginBottom: 12, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>在线成员</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {currentRoom.players.map((player) => (
              <div
                key={player.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  background: 'white',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: player.color,
                      boxShadow: player.is_online ? `0 0 0 4px ${player.color}22` : 'none',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{player.nickname}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {player.is_host ? '房主' : '成员'} · {player.is_online ? '在线' : '离线'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  加入于 {new Date(player.joined_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  )
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-secondary)',
}

const valueStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-primary)',
}
