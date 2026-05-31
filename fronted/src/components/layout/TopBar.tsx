import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, Clock, Download, FileJson, FileUp, Layers, LogOut, MoreHorizontal, Settings, Share2, Wifi, WifiOff } from 'lucide-react'
import { InviteCodeModal } from '@/components/ui/InviteCodeModal'
import { fetchDhRoomBackup } from '@/lib/realtime'
import { useStore } from '@/store/useStore'

function getModeLabel(roomType: string) {
  if (roomType === 'mobile-panel') return '手机角色码房间'
  if (roomType === 'gm-panel') return 'GM 面板'
  if (roomType === 'resource-tracker') return '资源追踪'
  return '房间'
}

interface TopBarProps {
  onLeaveRoom: () => void
  onHeightChange?: (height: number) => void
}

export function TopBar({ onLeaveRoom, onHeightChange }: TopBarProps) {
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mobileActionsRef = useRef<HTMLDivElement | null>(null)
  const {
    room,
    connectionStatus,
    isExportMenuOpen,
    toggleExportMenu,
    openImportModal,
    openRoomSettings,
    manualReconnect,
    leaveRoom,
    addToast,
  } = useStore()

  if (!room) return null
  const currentRoom = room
  const isGmPanel = currentRoom.room_type === 'gm-panel'
  const isMobilePanel = currentRoom.room_type === 'mobile-panel'

  const isDisconnected = connectionStatus === 'error' || connectionStatus === 'idle'
  const isReconnecting = connectionStatus === 'reconnecting' || connectionStatus === 'connecting'
  const modeLabel = getModeLabel(currentRoom.room_type)
  const expiresAt = new Date(currentRoom.expires_at)
  const daysLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  useEffect(() => {
    if (!onHeightChange) return
    const element = containerRef.current
    if (!element) return

    const reportHeight = () => onHeightChange(Math.ceil(element.getBoundingClientRect().height))
    reportHeight()

    const observer = new ResizeObserver(reportHeight)
    observer.observe(element)
    window.addEventListener('resize', reportHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', reportHeight)
    }
  }, [onHeightChange, currentRoom.invite_code, currentRoom.room_name, currentRoom.room_type, isDisconnected, isReconnecting, isExportMenuOpen])

  useEffect(() => {
    if (!isMobileActionsOpen) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null
      if (mobileActionsRef.current?.contains(target)) return
      setIsMobileActionsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isMobileActionsOpen])

  async function exportDhRoom() {
    try {
      const blob = await fetchDhRoomBackup(currentRoom.invite_code)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${currentRoom.room_name}.dhroom.json`
      link.click()
      URL.revokeObjectURL(url)
      addToast('房间备份已开始下载。', 'success')
      toggleExportMenu()
    } catch (error) {
      addToast(error instanceof Error ? error.message : '导出房间备份失败。', 'error')
    }
  }

  function renderExportButton(expand = false) {
    return (
      <div style={{ position: 'relative', ...(expand ? { width: '100%' } : {}) }}>
        <button className="btn btn-secondary btn-sm" onClick={toggleExportMenu} style={expand ? { width: '100%', justifyContent: 'center' } : undefined}>
          <Download size={13} /> 导出<ChevronDown size={11} />
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
    )
  }

  function renderActionButtons(layout: 'inline' | 'mobile-popover') {
    if (layout === 'mobile-popover') {
      return (
        <div ref={mobileActionsRef} style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setIsMobileActionsOpen((current) => !current)}
          >
            <MoreHorizontal size={13} /> 更多
          </button>

          {isMobileActionsOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                zIndex: 320,
                width: 176,
                padding: 10,
                border: '1px solid rgba(139,224,213,0.26)',
                background: 'linear-gradient(180deg, rgba(251,251,255,0.98), rgba(228,224,239,0.94))',
                boxShadow: '0 18px 34px rgba(17, 11, 39, 0.22)',
                display: 'grid',
                gap: 8,
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setIsMobileActionsOpen(false)
                  setShowInviteModal(true)
                }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Share2 size={13} /> 邀请码
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setIsMobileActionsOpen(false)
                  openImportModal()
                }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <FileUp size={13} /> 导入
              </button>
              {renderExportButton(true)}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setIsMobileActionsOpen(false)
                  openRoomSettings()
                }}
                title="房间设置"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Settings size={13} /> 设置
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  setIsMobileActionsOpen(false)
                  leaveRoom()
                  onLeaveRoom()
                }}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: 'linear-gradient(180deg, #b12d3f, #8f1f34)',
                  borderColor: '#8f1f34',
                  color: '#f7f2ff',
                }}
              >
                <LogOut size={13} /> 离开
              </button>
            </div>
          )}
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowInviteModal(true)}>
          <Share2 size={13} /> 分享邀请码
        </button>
        <button className="btn btn-secondary btn-sm" onClick={openImportModal}>
          <FileUp size={13} /> 导入
        </button>
        {renderExportButton()}
        <button className="btn btn-secondary btn-sm" onClick={openRoomSettings} title="房间设置">
          <Settings size={13} /> 设置
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            leaveRoom()
            onLeaveRoom()
          }}
          style={{
            background: 'linear-gradient(180deg, #b12d3f, #8f1f34)',
            borderColor: '#8f1f34',
            color: '#f7f2ff',
          }}
        >
          <LogOut size={13} /> 离开
        </button>
      </div>
    )
  }

  function renderIdentityBlock() {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flex: '1 1 220px',
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #8be0d5, #38a89c)',
            color: '#171027',
            fontSize: 13,
            fontWeight: 900,
            border: '1px solid rgba(247,242,255,0.34)',
          }}
        >
          GM
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-on-void)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {currentRoom.room_name}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(247,242,255,0.64)', letterSpacing: '1px', fontFamily: 'monospace' }}>
            {currentRoom.invite_code}
          </div>
        </div>
      </div>
    )
  }

  function renderModeAndExpiry() {
    return (
      <>
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
            background: daysLeft < 1 ? 'rgba(177,45,63,0.18)' : 'rgba(139,224,213,0.12)',
            border: `1px solid ${daysLeft < 1 ? 'rgba(177,45,63,0.34)' : 'rgba(139,224,213,0.30)'}`,
            fontSize: 11,
            color: daysLeft < 1 ? '#ffd9df' : '#bff7f1',
          }}
        >
          <Clock size={10} />
          {daysLeft > 0 ? `${daysLeft} 天后过期` : '即将过期'}
        </div>
      </>
    )
  }

  function renderConnectionStatus() {
    return (
      <>
        {isReconnecting && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              background: 'rgba(139,224,213,0.12)',
              border: '1px solid rgba(139,224,213,0.30)',
              fontSize: 11,
              color: '#bff7f1',
            }}
          >
            <Wifi size={11} />
            正在重连
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
              border: '1px solid rgba(255,217,223,0.36)',
              background: 'rgba(177,45,63,0.22)',
              color: '#ffd9df',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <WifiOff size={11} />
            连接已断开，点击重连
          </button>
        )}
      </>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: '0 0 auto 0',
        zIndex: 300,
        paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))',
        paddingRight: 12,
        paddingBottom: isGmPanel ? 8 : 10,
        paddingLeft: 12,
        background: 'linear-gradient(90deg, rgba(24,15,59,0.96), rgba(39,24,90,0.92))',
        backdropFilter: 'blur(16px) saturate(1.25)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.25)',
        borderBottom: '1px solid rgba(139,224,213,0.32)',
        boxShadow: '0 8px 22px rgba(17, 11, 39, 0.18)',
      }}
    >
      {isGmPanel ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, minHeight: 44 }}>
          {renderIdentityBlock()}
          {renderModeAndExpiry()}
          <div style={{ flex: 1 }} />
          {renderConnectionStatus()}
          {renderActionButtons('inline')}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {renderIdentityBlock()}
            {renderModeAndExpiry()}
            <div style={{ flex: 1 }} />
            {renderConnectionStatus()}
            {isMobilePanel ? renderActionButtons('mobile-popover') : null}
          </div>

          {isMobilePanel ? null : (
            <div style={{ marginTop: 8 }}>
              {renderActionButtons('inline')}
            </div>
          )}
        </>
      )}

      <InviteCodeModal
        open={showInviteModal}
        inviteCode={currentRoom.invite_code}
        roomName={currentRoom.room_name}
        onClose={() => setShowInviteModal(false)}
        onCopied={() => addToast('邀请码已复制到剪贴板。', 'success')}
      />
    </div>
  )
}
