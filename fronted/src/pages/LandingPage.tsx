import React, { useState } from 'react'
import { Dices, LogIn, Plus, Sparkles } from 'lucide-react'
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
        overflowY: 'auto',
        background: 'radial-gradient(circle at 18% 18%, rgba(139,224,213,0.24), transparent 26%), radial-gradient(circle at 82% 20%, rgba(223,200,82,0.18), transparent 28%), linear-gradient(135deg, #170e38 0%, #27185a 44%, #f1dfb5 44.2%, #f7ecd3 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 980,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: 24,
          alignItems: 'stretch',
        }}
      >
        <section
          className="dh-cut-corners"
          style={{
            position: 'relative',
            minHeight: 420,
            padding: 36,
            overflow: 'hidden',
            border: '1px solid rgba(223,200,82,0.46)',
            background: 'linear-gradient(145deg, rgba(24,15,59,0.94), rgba(39,24,90,0.88)), radial-gradient(circle at 78% 24%, rgba(139,224,213,0.28), transparent 28%)',
            color: 'var(--text-on-void)',
            boxShadow: '0 30px 70px rgba(17,11,39,0.34)',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 12,
              border: '1px solid rgba(223,200,82,0.30)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', minHeight: '100%', alignContent: 'space-between', gap: 28 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18, color: 'var(--accent-cyan)', fontSize: 13, fontWeight: 800, letterSpacing: '0.08em' }}>
                <Sparkles size={16} />
                HOPE / FEAR 
              </div>
              <h1 style={{ maxWidth: 420, fontSize: 58, lineHeight: 0.96, fontWeight: 950, letterSpacing: 0, margin: 0 }}>
                匕首之心
                <span style={{ display: 'block', color: 'var(--accent-cyan)' }}>在线面板</span>
              </h1>
              <p style={{ maxWidth: 460, marginTop: 20, color: 'rgba(255,247,223,0.82)', fontSize: 15, lineHeight: 1.8 }}>
                在线追踪希望、护甲、压力、生命以及恐惧点、进度钟。查看所有队友的角色卡。
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {[
                ['Heart', '玩家资源', 'var(--accent-cyan)'],
                ['Dagger', 'GM资源', 'var(--accent-rose)'],
              ].map(([label, text, color]) => (
                <div
                  key={label}
                  style={{
                    minHeight: 98,
                    padding: 14,
                    border: '1px solid rgba(223,200,82,0.28)',
                    background: 'rgba(255,247,223,0.08)',
                    display: 'grid',
                    alignContent: 'space-between',
                  }}
                >
                  <Dices size={22} color={color} />
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 900, color }}>{label}</div>
                    <div style={{ marginTop: 3, fontSize: 12, color: 'rgba(255,247,223,0.68)' }}>{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="glass-panel dh-cut-corners"
          style={{
            padding: 30,
            boxShadow: '0 28px 64px rgba(17, 11, 39, 0.22), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'rgba(39,24,90,0.08)', padding: 4, border: '1px solid var(--border-subtle)' }}>
            {(['create', 'join'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  border: tab === value ? '1px solid rgba(223,200,82,0.42)' : '1px solid transparent',
                  background: tab === value ? 'linear-gradient(180deg, #fffdf7, #f2e2bd)' : 'transparent',
                  color: tab === value ? 'var(--accent-violet)' : 'var(--text-muted)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: tab === value ? '0 6px 16px rgba(39,24,90,0.10)' : 'none',
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
