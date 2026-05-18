import React, { useState } from 'react'
import { LogIn, Plus } from 'lucide-react'
import { useStore } from '@/store/useStore'

interface LandingPageProps {
  onEnterRoom: () => void
}

export function LandingPage({ onEnterRoom }: LandingPageProps) {
  const { createRoom, joinRoom, isEnteringRoom, addToast } = useStore()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [roomName, setRoomName] = useState('匕首之心 GM 面板')
  const [nickname, setNickname] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!nickname.trim()) {
      addToast('请输入你的昵称。', 'error')
      return
    }

    const entered = await createRoom({
      nickname,
      roomName,
      roomType: 'gm-panel',
    })

    if (entered) onEnterRoom()
  }

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault()
    if (!nickname.trim()) {
      addToast('请输入你的昵称。', 'error')
      return
    }
    if (!inviteCode.trim()) {
      addToast('请输入邀请码。', 'error')
      return
    }

    const entered = await joinRoom({
      inviteCode,
      nickname,
    })

    if (entered) onEnterRoom()
  }

  return (
    <div
      style={{
        width: '100vw',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
        background: 'radial-gradient(circle at top left, rgba(217, 119, 6, 0.1), transparent 28%), radial-gradient(circle at bottom right, rgba(180, 83, 9, 0.1), transparent 26%), linear-gradient(180deg, #fdfaf5 0%, #f6f1e8 50%, #ede0ce 100%)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        <section
          className="glass-panel"
          style={{
            padding: 28,
            boxShadow: '0 28px 64px rgba(60, 30, 0, 0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'var(--bg-overlay)', padding: 4, border: '1px solid var(--border-subtle)' }}>
            {(['create', 'join'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  border: 'none',
                  background: tab === value ? 'white' : 'transparent',
                  color: tab === value ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {value === 'create' ? '创建房间' : '加入房间'}
              </button>
            ))}
          </div>

          {tab === 'create' ? (
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label className="label">房间名称</label>
                  <input className="input" value={roomName} onChange={(event) => setRoomName(event.target.value)} maxLength={40} />
                </div>

                <div>
                  <label className="label">你的昵称</label>
                  <input className="input" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={20} required />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isEnteringRoom}>
                  <Plus size={15} /> {isEnteringRoom ? '连接中...' : '创建房间并进入'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoin}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label className="label">邀请码</label>
                  <input
                    className="input"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                    maxLength={6}
                    style={{ letterSpacing: '4px', textAlign: 'center', fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}
                    required
                  />
                </div>

                <div>
                  <label className="label">你的昵称</label>
                  <input className="input" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={20} required />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isEnteringRoom}>
                  <LogIn size={15} /> {isEnteringRoom ? '连接中...' : '加入房间'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
