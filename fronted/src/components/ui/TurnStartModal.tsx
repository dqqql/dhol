import React from 'react'
import { BellRing, Shuffle } from 'lucide-react'
import { Modal } from './Modal'

interface TurnStartModalProps {
  open: boolean
  onClose: () => void
  onDraw: () => void
}

export function TurnStartModal({ open, onClose, onDraw }: TurnStartModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="轮到你了，可以抽牌" maxWidth={420}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 18 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(16,185,129,0.12)',
            color: 'var(--accent-emerald)',
            flexShrink: 0,
          }}
        >
          <BellRing size={18} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            现在是你的回合，先抽一张牌吧
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            你可以点击下方手牌区里的“抽牌”按钮开始本回合操作，也可以直接在这里点“立即抽牌”。
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          知道了
        </button>
        <button className="btn btn-primary btn-sm" onClick={onDraw}>
          <Shuffle size={13} /> 立即抽牌
        </button>
      </div>
    </Modal>
  )
}
