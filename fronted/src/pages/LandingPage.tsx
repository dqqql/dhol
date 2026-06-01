import React, { useState } from 'react'
import type { RoomType } from '@dhgc/shared'
import { LogIn, Plus, Shield, Swords } from 'lucide-react'
import { useStore } from '@/store/useStore'

interface LandingPageProps {
  onEnterRoom: () => void
}

const ORNAMENT = '◆'

export function LandingPage({ onEnterRoom }: LandingPageProps) {
  const { createRoom, joinRoom, isEnteringRoom, addToast } = useStore()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [roomName, setRoomName] = useState('匕首之心 GM 面板')
  const [nickname, setNickname] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [roomType, setRoomType] = useState<RoomType>('gm-panel')

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!nickname.trim()) {
      addToast('请输入你的昵称。', 'error')
      return
    }
    const entered = await createRoom({ nickname, roomName, roomType })
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
    const entered = await joinRoom({ inviteCode, nickname })
    if (entered) onEnterRoom()
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 'calc(28px + env(safe-area-inset-top, 0px))',
        paddingRight: 20,
        paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
        paddingLeft: 20,
        boxSizing: 'border-box',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        /* Daggerheart diagonal split — void on left, parchment on right */
        background: [
          'radial-gradient(circle at 20% 22%, rgba(224,168,48,0.26), transparent 30%)',
          'radial-gradient(circle at 80% 75%, rgba(143,26,44,0.20), transparent 28%)',
          'linear-gradient(135deg, #160B04 0%, #2A1C0A 42%, #f0e5c8 42.4%, #faf4e2 100%)',
        ].join(', '),
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1020,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
          gap: 28,
          alignItems: 'stretch',
        }}
      >
        {/* ── Hero / brand panel ── */}
        <section
          className="dh-cut-corners"
          style={{
            position: 'relative',
            minHeight: 380,
            padding: 'clamp(24px, 5vw, 40px)',
            overflow: 'hidden',
            border: '1px solid rgba(224,168,48,0.38)',
            background: [
              'radial-gradient(ellipse at 74% 20%, rgba(224,168,48,0.24), transparent 38%)',
              'radial-gradient(ellipse at 16% 82%, rgba(143,26,44,0.18), transparent 36%)',
              'linear-gradient(150deg, #160B04 0%, #2A1C0A 60%, #1A1008 100%)',
            ].join(', '),
            color: '#FFF5D6',
            boxShadow: '0 36px 80px rgba(14,8,2,0.44)',
          }}
        >
          {/* inner border ornament */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 11,
              border: '1px solid rgba(224,168,48,0.18)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* corner diamond ornaments */}
          {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pos) => (
            <div
              key={pos}
              aria-hidden="true"
              style={{
                position: 'absolute',
                zIndex: 1,
                fontSize: 10,
                color: 'rgba(224,168,48,0.50)',
                top: pos.startsWith('top') ? 18 : undefined,
                bottom: pos.startsWith('bottom') ? 18 : undefined,
                left: pos.endsWith('left') ? 18 : undefined,
                right: pos.endsWith('right') ? 18 : undefined,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {ORNAMENT}
            </div>
          ))}

          <div style={{ position: 'relative', zIndex: 2, display: 'grid', minHeight: '100%', alignContent: 'space-between', gap: 32 }}>
            <div>
              {/* eyebrow label */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 20,
                  padding: '4px 12px',
                  border: '1px solid rgba(224,168,48,0.36)',
                  background: 'rgba(224,168,48,0.10)',
                  color: '#E0A830',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  fontFamily: 'var(--font-display)',
                }}
              >
                HOPE &nbsp;{ORNAMENT}&nbsp; FEAR
              </div>

              <h1
                className="dh-display"
                style={{
                  maxWidth: 440,
                  fontSize: 'clamp(38px, 9vw, 62px)',
                  lineHeight: 0.92,
                  fontWeight: 900,
                  letterSpacing: '0.01em',
                  margin: 0,
                  color: '#FFF5D6',
                }}
              >
                匕首之心
                <span
                  style={{
                    display: 'block',
                    background: 'linear-gradient(135deg, #E0A830 0%, #F5CF6A 50%, #C88820 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    marginTop: 4,
                  }}
                >
                  在线面板
                </span>
              </h1>

              {/* ornamental rule */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 20,
                  marginBottom: 18,
                  color: 'rgba(224,168,48,0.44)',
                }}
              >
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(224,168,48,0.5), transparent)' }} />
                <span style={{ fontSize: 8, letterSpacing: '0.3em' }}>◆ ◆ ◆</span>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(270deg, rgba(224,168,48,0.5), transparent)' }} />
              </div>

              <p style={{ maxWidth: 420, color: 'rgba(255,245,214,0.78)', fontSize: 14.5, lineHeight: 1.85 }}>
                在线追踪希望、护甲、压力、生命以及恐惧点、进度钟。查看所有队友的角色卡。
              </p>
            </div>

            {/* feature cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {[
                { icon: Shield, label: 'Heart', sub: '玩家资源', accent: '#E0A830', border: 'rgba(224,168,48,0.30)', bg: 'rgba(224,168,48,0.08)' },
                { icon: Swords, label: 'Dagger', sub: 'GM 资源', accent: '#C42048', border: 'rgba(196,32,72,0.30)', bg: 'rgba(196,32,72,0.08)' },
              ].map(({ icon: Icon, label, sub, accent, border, bg }) => (
                <div
                  key={label}
                  style={{
                    minHeight: 100,
                    padding: '14px 16px',
                    border: `1px solid ${border}`,
                    background: bg,
                    display: 'grid',
                    alignContent: 'space-between',
                  }}
                >
                  <Icon size={20} color={accent} strokeWidth={1.5} />
                  <div style={{ marginTop: 12 }}>
                    <div
                      className="dh-display"
                      style={{ fontSize: 16, fontWeight: 700, color: accent, letterSpacing: '0.06em' }}
                    >
                      {label}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 12, color: 'rgba(255,245,214,0.60)' }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Form panel ── */}
        <section
          className="dh-cut-corners"
          style={{
            position: 'relative',
            padding: 'clamp(20px, 5vw, 32px)',
            background: 'linear-gradient(180deg, rgba(255,252,244,0.98), rgba(240,232,210,0.94))',
            border: '1px solid rgba(224,168,48,0.28)',
            boxShadow: '0 28px 64px rgba(36,18,4,0.16), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
        >
          {/* inner border ornament */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 10,
              border: '1px solid rgba(92,58,16,0.10)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Tab switcher */}
            <div
              style={{
                display: 'flex',
                gap: 0,
                marginBottom: 26,
                background: 'rgba(92,58,16,0.07)',
                padding: 3,
                border: '1px solid rgba(92,58,16,0.14)',
              }}
            >
              {(['create', 'join'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    border: tab === value ? '1px solid rgba(224,168,48,0.44)' : '1px solid transparent',
                    background: tab === value
                      ? 'linear-gradient(180deg, #ffffff, #faf0d8)'
                      : 'transparent',
                    color: tab === value ? '#3A1C04' : '#8A6A30',
                    fontWeight: tab === value ? 800 : 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                    fontFamily: 'var(--font-display)',
                    boxShadow: tab === value ? '0 4px 14px rgba(92,58,16,0.10)' : 'none',
                    transition: 'all 150ms ease',
                  }}
                >
                  {value === 'create' ? '创建房间' : '加入房间'}
                </button>
              ))}
            </div>

            {tab === 'create' ? (
              <form onSubmit={handleCreate}>
                <div style={{ display: 'grid', gap: 18 }}>
                  <div>
                    <label className="label" style={{ color: '#5C3A10' }}>房间名称</label>
                    <input
                      className="input"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      maxLength={40}
                      style={{ background: 'rgba(255,252,244,0.95)', borderColor: 'rgba(92,58,16,0.22)' }}
                    />
                  </div>

                  <div>
                    <label className="label" style={{ color: '#5C3A10' }}>房间类型</label>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {[
                        { id: 'gm-panel', label: 'GM 面板', hint: '桌面端导入 HTML 角色卡。' },
                        { id: 'mobile-panel', label: '手机角色码房间', hint: '手机端直接粘贴角色码。' },
                      ].map((option) => {
                        const selected = roomType === option.id
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setRoomType(option.id as RoomType)
                              setRoomName(option.id === 'mobile-panel' ? '匕首之心 手机角色码房间' : '匕首之心 GM 面板')
                            }}
                            style={{
                              padding: '12px 14px',
                              textAlign: 'left',
                              border: selected ? '1px solid rgba(224,168,48,0.48)' : '1px solid rgba(92,58,16,0.16)',
                              background: selected
                                ? 'linear-gradient(180deg, #fffbf0, #faf0d4)'
                                : 'rgba(255,252,244,0.80)',
                              boxShadow: selected ? '0 6px 18px rgba(92,58,16,0.10)' : 'none',
                              cursor: 'pointer',
                              transition: 'all 150ms ease',
                            }}
                          >
                            <div style={{ fontSize: 13.5, fontWeight: 800, color: selected ? '#3A1C04' : '#5C3A10' }}>
                              {option.label}
                            </div>
                            <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: '#8A6A30' }}>
                              {option.hint}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="label" style={{ color: '#5C3A10' }}>你的昵称</label>
                    <input
                      className="input"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={20}
                      required
                      style={{ background: 'rgba(255,252,244,0.95)', borderColor: 'rgba(92,58,16,0.22)' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isEnteringRoom}
                    style={{
                      width: '100%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '12px 24px',
                      border: '1px solid rgba(160,112,24,0.50)',
                      background: isEnteringRoom
                        ? 'rgba(224,168,48,0.5)'
                        : 'linear-gradient(180deg, #E0A830, #B88020)',
                      color: '#1A0C04',
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      cursor: isEnteringRoom ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-display)',
                      boxShadow: isEnteringRoom ? 'none' : '0 8px 20px rgba(92,58,16,0.24)',
                      transition: 'all 150ms ease',
                      opacity: isEnteringRoom ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isEnteringRoom) {
                        e.currentTarget.style.background = 'linear-gradient(180deg, #EDBB44, #C89030)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isEnteringRoom) {
                        e.currentTarget.style.background = 'linear-gradient(180deg, #E0A830, #B88020)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }
                    }}
                  >
                    <Plus size={15} />
                    {isEnteringRoom ? '连接中...' : '创建并进入'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleJoin}>
                <div style={{ display: 'grid', gap: 18 }}>
                  <div>
                    <label className="label" style={{ color: '#5C3A10' }}>邀请码</label>
                    <input
                      className="input"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      style={{
                        letterSpacing: '6px',
                        textAlign: 'center',
                        fontSize: 20,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        background: 'rgba(255,252,244,0.95)',
                        borderColor: 'rgba(92,58,16,0.22)',
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label className="label" style={{ color: '#5C3A10' }}>你的昵称</label>
                    <input
                      className="input"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={20}
                      required
                      style={{ background: 'rgba(255,252,244,0.95)', borderColor: 'rgba(92,58,16,0.22)' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isEnteringRoom}
                    style={{
                      width: '100%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '12px 24px',
                      border: '1px solid rgba(160,112,24,0.50)',
                      background: isEnteringRoom
                        ? 'rgba(224,168,48,0.5)'
                        : 'linear-gradient(180deg, #E0A830, #B88020)',
                      color: '#1A0C04',
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      cursor: isEnteringRoom ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-display)',
                      boxShadow: isEnteringRoom ? 'none' : '0 8px 20px rgba(92,58,16,0.24)',
                      transition: 'all 150ms ease',
                      opacity: isEnteringRoom ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isEnteringRoom) {
                        e.currentTarget.style.background = 'linear-gradient(180deg, #EDBB44, #C89030)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isEnteringRoom) {
                        e.currentTarget.style.background = 'linear-gradient(180deg, #E0A830, #B88020)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }
                    }}
                  >
                    <LogIn size={15} />
                    {isEnteringRoom ? '连接中...' : '加入房间'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
