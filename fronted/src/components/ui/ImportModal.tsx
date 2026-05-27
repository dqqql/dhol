import React, { useRef, useState } from 'react'
import { safeJsonParse } from '@dhgc/shared'
import { AlertCircle, Upload } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Modal } from './Modal'

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024

function waitForPaint() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
}

function waitForIdle() {
  return new Promise<void>((resolve) => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 500 })
      return
    }

    globalThis.setTimeout(resolve, 0)
  })
}

export function ImportModal() {
  const {
    room,
    isImportModalOpen,
    closeImportModal,
    importRoomBackup,
    addToast,
  } = useStore()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  if (!room) return null

  const importsEnabled = room.settings.imports_enabled

  async function handleFile(file: File) {
    if (isImporting) return
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      addToast('导入文件不能超过 10MB，请拆分内容或导出较小的房间备份。', 'error')
      return
    }

    setIsImporting(true)
    try {
      if (!importsEnabled) {
        addToast('请先在房间设置中启用导入功能', 'error')
        return
      }

      await waitForPaint()
      const text = await file.text()
      await waitForIdle()
      importRoomBackup(safeJsonParse(text))
    } catch (error) {
      addToast(error instanceof Error ? error.message : '文件解析失败', 'error')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Modal open={isImportModalOpen} onClose={closeImportModal} title="导入房间备份" maxWidth={500}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        支持导入 .dhroom.json 房间备份。导入后会恢复恐惧点、进度钟、角色卡。
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
          border: `2px dashed ${dragOver ? 'var(--accent-gold)' : 'var(--border-default)'}`,
          padding: 32,
          textAlign: 'center',
          background: dragOver ? 'rgba(184,134,11,0.04)' : 'var(--bg-overlay)',
          transition: 'all 0.15s',
          marginBottom: 16,
          cursor: isImporting ? 'wait' : 'pointer',
          opacity: isImporting ? 0.72 : 1,
        }}
        onClick={() => {
          if (!isImporting) fileInputRef.current?.click()
        }}
      >
        <Upload size={28} color={dragOver ? 'var(--accent-gold)' : 'var(--text-muted)'} style={{ margin: '0 auto 10px' }} />
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
          {isImporting ? '正在导入房间备份' : '拖拽房间备份到这里'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>或点击选择 .dhroom.json 文件</div>
        <input
          ref={fileInputRef}
          id="dh-import-file-input"
          type="file"
          disabled={isImporting}
          accept=".dhroom.json,.json"
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
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.2)',
          marginBottom: 20,
        }}
      >
        <AlertCircle size={13} color="var(--accent-amber)" />
        <span style={{ fontSize: 12, color: 'var(--accent-amber)' }}>
          {!importsEnabled
            ? '当前房间尚未启用导入功能，请先到房间设置中开启。'
            : '导入房间备份会覆盖当前房间的大部分内容，建议先导出当前房间备份。'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={closeImportModal} disabled={isImporting}>关闭</button>
      </div>
    </Modal>
  )
}
