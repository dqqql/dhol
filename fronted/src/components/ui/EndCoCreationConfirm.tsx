import React from 'react'
import { useStore } from '@/store/useStore'
import { Modal } from './Modal'
import { AlertTriangle } from 'lucide-react'

export function EndCoCreationConfirm() {
  const { isEndCoCreationConfirmOpen, closeEndConfirm, endCoCreation } = useStore()

  return (
    <Modal open={isEndCoCreationConfirmOpen} onClose={closeEndConfirm} maxWidth={420}>
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <AlertTriangle size={24} color="var(--accent-amber)" />
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>
          确认结束共创？
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
          未打出的<strong style={{ color: 'var(--accent-amber)' }}>自定义卡牌</strong>将被永久删除。<br />
          官方卡与导入卡将回收至牌组，可在下一轮使用。<br />
          地图上已打出的卡牌<strong>不受影响</strong>。
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={closeEndConfirm}>取消</button>
          <button className="btn btn-danger" onClick={endCoCreation}>确认结束共创</button>
        </div>
      </div>
    </Modal>
  )
}
