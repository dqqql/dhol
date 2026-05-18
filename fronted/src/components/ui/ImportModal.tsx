import React, { useState } from 'react'
import { safeJsonParse } from '@dhgc/shared'
import { useStore } from '@/store/useStore'
import { Modal } from './Modal'
import { AlertCircle, Upload } from 'lucide-react'

type ImportMode = 'pack' | 'room'

export function ImportModal() {
  const {
    room,
    currentPlayerId,
    isImportModalOpen,
    closeImportModal,
    importPack,
    importRoomBackup,
    addToast,
  } = useStore()
  const [dragOver, setDragOver] = useState(false)
  const [mode, setMode] = useState<ImportMode>('pack')

  if (!room) return null

  const isHost = room.host_player_id === currentPlayerId
  const importsEnabled = room.settings.imports_enabled

  async function handleFile(file: File) {
    try {
      const text = await file.text()
      const payload = safeJsonParse(text)

      if (mode === 'pack') {
        if (!isHost) {
          addToast('只有房主可以导入整包', 'error')
          return
        }

        if (!importsEnabled) {
          addToast('请先在房间设置中启用导入功能', 'error')
          return
        }

        importPack(payload)
        return
      }

      if (!isHost) {
        addToast('只有房主可以导入房间备份', 'error')
        return
      }

      if (!importsEnabled) {
        addToast('请先在房间设置中启用导入功能', 'error')
        return
      }

      importRoomBackup(payload)
    } catch (error) {
      addToast(error instanceof Error ? error.message : '文件解析失败', 'error')
    }
  }

  return (
    <Modal open={isImportModalOpen} onClose={closeImportModal} title="导入" maxWidth={500}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'var(--bg-base)', padding: 4 }}>
        {([
          { id: 'pack', label: '导入卡包' },
          { id: 'room', label: '导入房间' },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id)}
            className={`btn btn-sm ${mode === item.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        {mode === 'pack'
          ? '支持导入 .dhpack.json 或符合卡包结构的 .json 文件。导入后会把整套卡包加入当前房间的卡包库与牌堆。'
          : '支持导入 .dhroom.json 房间备份。导入后会尽量恢复地图、连接、注释、手牌、牌堆和房间设置。'}
      </p>

      <div
        onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          const file = event.dataTransfer.files[0]
          if (file) void handleFile(file)
        }}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent-violet)' : 'var(--border-default)'}`,
          padding: 32,
          textAlign: 'center',
          background: dragOver ? 'rgba(124,111,222,0.06)' : 'var(--bg-overlay)',
          transition: 'all 0.15s',
          marginBottom: 16,
          cursor: 'pointer',
        }}
        onClick={() => document.getElementById('dh-import-file-input')?.click()}
      >
        <Upload size={28} color={dragOver ? 'var(--accent-violet)' : 'var(--text-muted)'} style={{ margin: '0 auto 10px' }} />
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>拖拽文件到这里</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>或点击选择文件</div>
        <input
          id="dh-import-file-input"
          type="file"
          accept=".json,.dhpack.json,.dhroom.json"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
            event.currentTarget.value = ''
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)',
          marginBottom: 20,
        }}
      >
        <AlertCircle size={13} color="var(--accent-amber)" />
        <span style={{ fontSize: 12, color: 'var(--accent-amber)' }}>
          {!importsEnabled
            ? '当前房间尚未启用导入功能，请房主先到房间设置中开启。'
            : mode === 'pack'
              ? '只有房主可以导入整包。其他玩家请使用“卡包库”导入选中的卡牌。'
              : '导入房间备份会覆盖当前房间的大部分内容，建议先导出当前房间备份。'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={closeImportModal}>关闭</button>
      </div>
    </Modal>
  )
}
