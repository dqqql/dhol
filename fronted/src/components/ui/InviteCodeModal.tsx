import React, { useState } from 'react'
import ReactDOM from 'react-dom'
import { Check, Copy, Share2, X } from 'lucide-react'

interface InviteCodeModalProps {
  open: boolean
  inviteCode: string
  roomName: string
  onClose: () => void
  onCopied?: () => void
}

export function InviteCodeModal({
  open,
  inviteCode,
  roomName,
  onClose,
  onCopied,
}: InviteCodeModalProps) {
  const [copied, setCopied] = useState(false)

  if (!open) return null

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      onCopied?.()
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-panel)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          animation: 'slideUp var(--transition-normal)',
          position: 'relative',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            padding: '24px 24px 20px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              top: -48,
              right: -30,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 84,
              height: 84,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              bottom: -24,
              left: 18,
              pointerEvents: 'none',
            }}
          />

          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.85)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms',
              zIndex: 1,
            }}
            onMouseEnter={(event) => { event.currentTarget.style.background = 'rgba(255,255,255,0.28)' }}
            onMouseLeave={(event) => { event.currentTarget.style.background = 'rgba(255,255,255,0.18)' }}
          >
            <X size={16} />
          </button>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(255,255,255,0.18)',
                color: 'white',
                marginBottom: 12,
                backdropFilter: 'blur(8px)',
              }}
            >
              <Share2 size={24} />
            </div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: 'white',
                letterSpacing: '-0.02em',
                marginBottom: 4,
                lineHeight: 1.2,
              }}
            >
              分享邀请码
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
              把邀请码发给队友，对方输入后就能加入房间
            </p>
          </div>
        </div>

        <div style={{ padding: '20px 24px 22px' }}>
          <div
            style={{
              background: 'var(--bg-overlay)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              marginBottom: 16,
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
              {roomName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              当前房间邀请码
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                background: 'linear-gradient(180deg, rgba(37,99,235,0.06), rgba(124,58,237,0.04))',
                border: '1px solid rgba(37,99,235,0.14)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                邀请码
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: '0.24em',
                  fontFamily: 'monospace',
                  color: 'var(--accent-violet)',
                  paddingLeft: '0.24em',
                }}
              >
                {inviteCode}
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={copyCode}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {copied ? <><Check size={14} /> 已复制</> : <><Copy size={14} /> 复制邀请码</>}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
