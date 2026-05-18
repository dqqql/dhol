import React, { useState } from 'react'
import { ChevronDown, Clock, Download, FileJson, Layers, LogOut, Settings, Share2, Wifi, WifiOff } from 'lucide-react'
import { InviteCodeModal } from '@/components/ui/InviteCodeModal'
import { fetchDhRoomBackup } from '@/lib/realtime'
import { useStore } from '@/store/useStore'

function getModeLabel(roomType: string) {
  if (roomType === 'gm-panel') return 'GM 面板'
  if (roomType === 'resource-tracker') return '追踪资源'
  return '房间'
}

export function TopBar({ onLeaveRoom }: { onLeaveRoom: () => void }) {
  const [showInviteModal, setShowInviteModal] = useState(false)
  const {
    room,
    connectionStatus,
    isExportMenuOpen,
    toggleExportMenu,
    openRoomSettings,
    manualReconnect,
    leaveRoom,
    addToast,
  } = useStore()

  if (!room) return null
  const currentRoom = room

  const isDisconnected = connectionStatus === 'error' || connectionStatus === 'idle'
  const isReconnecting = connectionStatus === 'reconnecting' || connectionStatus === 'connecting'
  const modeLabel = getModeLabel(currentRoom.room_type)
  const expiresAt = new Date(currentRoom.expires_at)
  const daysLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  async function exportDhRoom() {
    try {
      const blob = await fetchDhRoomBackup(currentRoom.invite_code)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${currentRoom.room_name}.dhroom.json`
      link.click()
      URL.revokeObjectURL(url)
      addToast('房间备份已导出。', 'success')
      toggleExportMenu()
    } catch (error) {
      addToast(error instanceof Error ? error.message : '导出房间备份失败。', 'error')
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: '0 0 auto 0',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border-subtle)',
        height: 52,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #ea580c, #b45309)',
            color: 'white',
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          GM
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{currentRoom.room_name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px', fontFamily: 'monospace' }}>
            {currentRoom.invite_code}
          </div>
        </div>
      </div>

      <div className="mode-badge mode-badge--free">
        <Layers size={11} />
        {modeLabel}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 999,
          background: daysLeft < 1 ? 'rgba(244,63,94,0.1)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${daysLeft < 1 ? 'rgba(244,63,94,0.2)' : 'rgba(245,158,11,0.15)'}`,
          fontSize: 11,
          color: daysLeft < 1 ? 'var(--accent-rose)' : 'var(--accent-amber)',
        }}
      >
        <Clock size={10} />
        {daysLeft > 0 ? `${daysLeft} 天后到期` : '今日到期'}
      </div>

      <div style={{ flex: 1 }} />

      {isReconnecting && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 999,
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.2)',
            fontSize: 11,
            color: 'var(--accent-amber)',
          }}
        >
          <Wifi size={11} />
          重连中
        </div>
      )}

      {isDisconnected && (
        <button
          type="button"
          onClick={manualReconnect}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid rgba(244,63,94,0.2)',
            background: 'rgba(244,63,94,0.1)',
            color: 'var(--accent-rose)',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <WifiOff size={11} />
          连接断开，点击重连
        </button>
      )}

      <button className="btn btn-secondary btn-sm" onClick={() => setShowInviteModal(true)}>
        <Share2 size={13} /> 邀请码
      </button>

      <div style={{ position: 'relative' }}>
        <button className="btn btn-secondary btn-sm" onClick={toggleExportMenu}>
          <Download size={13} /> 导出 <ChevronDown size={11} />
        </button>
        {isExportMenuOpen && (
          <div
            className="context-menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              left: 'auto',
              minWidth: 220,
            }}
          >
            <div className="context-menu__item" onClick={exportDhRoom}>
              <FileJson size={13} /> 房间备份 (.dhroom.json)
            </div>
          </div>
        )}
      </div>

      <button className="btn btn-ghost btn-icon" onClick={openRoomSettings} title="房间设置">
        <Settings size={15} />
      </button>

      <button
        className="btn btn-ghost btn-sm"
        onClick={() => {
          leaveRoom()
          onLeaveRoom()
        }}
      >
        <LogOut size={13} /> 退出
      </button>

      <InviteCodeModal
        open={showInviteModal}
        inviteCode={currentRoom.invite_code}
        roomName={currentRoom.room_name}
        onClose={() => setShowInviteModal(false)}
        onCopied={() => addToast('邀请码已复制。', 'success')}
      />
    </div>
  )
}
