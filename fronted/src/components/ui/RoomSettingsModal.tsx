import React, { useState } from 'react'
import { Check, Clock, Copy } from 'lucide-react'
import { GM_PANEL_THEMES } from '@/components/gm-panel/gmPanelThemes'
import { Modal } from './Modal'
import { useStore } from '@/store/useStore'

function roomTypeLabel(roomType: string) {
  if (roomType === 'mobile-panel') return '手机角色码房间'
  return 'GM 面板'
}

export function RoomSettingsModal() {
  const {
    room,
    isRoomSettingsOpen,
    closeRoomSettings,
    addToast,
    updateGmPanelTheme,
  } = useStore()
  const [copied, setCopied] = useState(false)

  if (!room) return null
  const currentRoom = room

  const expiresAt = new Date(currentRoom.expires_at)
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
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ marginBottom: 4, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{currentRoom.room_name}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14 }}>{roomTypeLabel(currentRoom.room_type)}</div>

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
          </div>
        </section>

        <section
          style={{
            padding: 16,
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
                      {player.is_online ? '在线' : '离线'}
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

        {currentRoom.room_type === 'gm-panel' && (
          <section
            style={{
              padding: 16,
              background: 'var(--bg-overlay)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ marginBottom: 6, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>切换主题色</div>
            <div style={{ marginBottom: 14, fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              仅调整 GM 面板配色，不改动布局、按钮位置和功能逻辑。
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {GM_PANEL_THEMES.map((theme) => {
                const selected = currentRoom.settings.gm_panel_theme === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => updateGmPanelTheme(theme.id)}
                    style={{
                      display: 'grid',
                      gap: 10,
                      padding: 14,
                      textAlign: 'left',
                      border: selected ? '1px solid var(--accent-violet)' : '1px solid var(--border-subtle)',
                      background: selected ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.84)',
                      boxShadow: selected ? '0 0 0 3px rgba(67, 48, 141, 0.12)' : 'none',
                      cursor: 'pointer',
                      transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{theme.label}</div>
                        <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{theme.summary}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={previewSwatch(theme.preview.base)} />
                        <span style={previewSwatch(theme.preview.hope)} />
                        <span style={previewSwatch(theme.preview.fear)} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                        {selected ? '当前主题' : '点击切换'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={miniPreviewStyle(`linear-gradient(135deg, ${theme.preview.hope}, ${theme.preview.base})`)} />
                        <span style={miniPreviewStyle(`linear-gradient(135deg, ${theme.preview.fear}, ${theme.preview.base})`)} />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}
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

function previewSwatch(background: string): React.CSSProperties {
  return {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background,
    border: '1px solid rgba(15, 23, 42, 0.08)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
    flexShrink: 0,
  }
}

function miniPreviewStyle(background: string): React.CSSProperties {
  return {
    width: 42,
    height: 12,
    background,
    border: '1px solid rgba(15, 23, 42, 0.06)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.38)',
  }
}
