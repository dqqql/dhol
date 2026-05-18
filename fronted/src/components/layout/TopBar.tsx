import React, { useState } from 'react'
import { ChevronDown, Clock, Download, FileJson, FileText, HelpCircle, Layers, LogOut, Play, Settings, Share2, StopCircle, Upload, Wifi, WifiOff } from 'lucide-react'
import { InviteCodeModal } from '@/components/ui/InviteCodeModal'
import { TutorialModal } from '@/components/ui/TutorialModal'
import { fetchDhRoomBackup } from '@/lib/realtime'
import { useStore } from '@/store/useStore'
import { getCardBodyText } from '@/utils/cardText'
import { getCardTypeLabel } from '@/utils/cardTypeConfig'

function getModeLabel(roomType: string, mode: string) {
  if (roomType === 'gm-panel') return 'GM 面板'
  if (roomType === 'resource-tracker') return '追踪资源'
  if (mode === 'co-creation') return '共创模式'
  if (mode === 'normal') return '普通模式'
  return '自由模式'
}

export function TopBar({ onLeaveRoom }: { onLeaveRoom: () => void }) {
  const [showTutorial, setShowTutorial] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const {
    room,
    currentPlayerId,
    connectionStatus,
    isExportMenuOpen,
    toggleExportMenu,
    openImportModal,
    openRoomSettings,
    openCardLibrary,
    startCoCreation,
    openEndConfirm,
    manualReconnect,
    leaveRoom,
    addToast,
  } = useStore()

  if (!room) return null
  const currentRoom = room

  const isHost = currentRoom.host_player_id === currentPlayerId
  const isBoardRoom = currentRoom.room_type === 'resource-tracker' || currentRoom.room_type === 'gm-panel'
  const isCoCreation = currentRoom.mode === 'co-creation'
  const isDisconnected = connectionStatus === 'error' || connectionStatus === 'idle'
  const isReconnecting = connectionStatus === 'reconnecting' || connectionStatus === 'connecting'
  const modeLabel = getModeLabel(currentRoom.room_type, currentRoom.mode)
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

  function exportMarkdown() {
    let markdown = `# ${currentRoom.room_name}\n\n`
    const sections = [
      { title: '角色', cards: currentRoom.map_cards.filter((card) => card.type === 'Role') },
      { title: '地点', cards: currentRoom.map_cards.filter((card) => card.type === 'Location') },
      { title: '特征', cards: currentRoom.map_cards.filter((card) => card.type === 'Feature') },
      { title: '故事钩子', cards: currentRoom.map_cards.filter((card) => card.type === 'Hook') },
    ]

    for (const section of sections) {
      if (!section.cards.length) continue
      markdown += `## ${section.title}\n`
      for (const card of section.cards) {
        markdown += `### ${card.title}\n${getCardBodyText(card)}\n\n`
      }
    }

    const customCards = currentRoom.map_cards.filter((card) => card.type === 'Custom')
    const groupedCustomCards = new Map<string, typeof customCards>()
    for (const card of customCards) {
      const label = getCardTypeLabel(card.type, card.custom_type_name)
      groupedCustomCards.set(label, [...(groupedCustomCards.get(label) ?? []), card])
    }
    for (const [label, cards] of groupedCustomCards.entries()) {
      markdown += `## ${label}\n`
      for (const card of cards) {
        markdown += `### ${card.title}\n${getCardBodyText(card)}\n\n`
      }
    }

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentRoom.room_name}.md`
    link.click()
    URL.revokeObjectURL(url)
    addToast('Markdown 摘要已导出。', 'success')
    toggleExportMenu()
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

      {!isBoardRoom && (
        <>
          <button className="btn btn-secondary btn-sm" onClick={openCardLibrary}>
            <Layers size={13} /> 卡包
          </button>
          {isHost && (
            <button className="btn btn-secondary btn-sm" onClick={openImportModal}>
              <Upload size={13} /> 导入
            </button>
          )}
        </>
      )}

      {!isBoardRoom && !isCoCreation && isHost && (
        <button className="btn btn-primary btn-sm" onClick={startCoCreation}>
          <Play size={13} /> 开始共创
        </button>
      )}

      {isHost && !isBoardRoom && isCoCreation && (
        <button className="btn btn-danger btn-sm" onClick={openEndConfirm}>
          <StopCircle size={13} /> 结束共创
        </button>
      )}

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
            {!isBoardRoom && (
              <div className="context-menu__item" onClick={exportMarkdown}>
                <FileText size={13} /> Markdown 摘要 (.md)
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowTutorial(true)}
        title="使用说明"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 11px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(37,99,235,0.22)',
          background: 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(59,130,246,0.08))',
          color: 'var(--accent-violet)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <HelpCircle size={13} />
        帮助
      </button>

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
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
    </div>
  )
}
