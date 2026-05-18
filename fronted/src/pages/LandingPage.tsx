import React, { useState } from 'react'
import type { RoomType } from '@dhgc/shared'
import { BookOpen, LogIn, Plus } from 'lucide-react'
import { TutorialModal } from '@/components/ui/TutorialModal'
import { useStore } from '@/store/useStore'

interface LandingPageProps {
  onEnterRoom: () => void
}

const ROOM_TYPES: Array<{ id: RoomType; title: string; desc: string }> = [
  { id: 'gm-panel', title: 'GM 面板', desc: '导入 MyDHcharsheet HTML，分页展示角色卡并实时同步资源。' },
  { id: 'co-creation', title: '共创房间', desc: '保留参考项目原本的多人共创地图玩法。' },
]

export function LandingPage({ onEnterRoom }: LandingPageProps) {
  const { createRoom, joinRoom, isEnteringRoom, addToast } = useStore()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [roomName, setRoomName] = useState('匕首之心 GM 面板')
  const [nickname, setNickname] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [roomType, setRoomType] = useState<RoomType>('gm-panel')
  const [showTutorial, setShowTutorial] = useState(false)

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!nickname.trim()) {
      addToast('请输入你的昵称。', 'error')
      return
    }

    const entered = await createRoom({
      nickname,
      roomName,
      roomType,
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
        background: 'radial-gradient(circle at top left, rgba(249, 115, 22, 0.14), transparent 28%), radial-gradient(circle at bottom right, rgba(180, 83, 9, 0.14), transparent 26%), linear-gradient(180deg, #fffaf5 0%, #f5efe6 100%)',
      }}
    >
      <button
        type="button"
        onClick={() => setShowTutorial(true)}
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 14px',
          borderRadius: 999,
          border: '1px solid rgba(59, 130, 246, 0.18)',
          background: 'rgba(255,255,255,0.8)',
          color: '#2563eb',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <BookOpen size={15} />
        使用说明
      </button>

      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      <div style={{ width: '100%', maxWidth: 1040, display: 'grid', gap: 24, gridTemplateColumns: '1.1fr 0.9fr' }}>
        <section
          style={{
            padding: 36,
            borderRadius: 28,
            background: 'linear-gradient(135deg, rgba(124, 79, 49, 0.96), rgba(67, 44, 33, 0.98))',
            color: 'white',
            boxShadow: '0 28px 60px rgba(67, 44, 33, 0.22)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #fb923c, #ea580c)',
              marginBottom: 20,
              fontSize: 26,
              fontWeight: 900,
            }}
          >
            GM
          </div>
          <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.05, fontWeight: 900 }}>匕首之心 GM 面板</h1>
          <p style={{ marginTop: 16, marginBottom: 0, maxWidth: 520, fontSize: 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.82)' }}>
            按开发文档实现的多人实时 GM 面板。导入 `MyDHcharsheet` 导出的 HTML 角色卡，固定槽位分页展示，
            实时同步恐惧点、进度钟与角色资源，同时保留本地悬浮笔记。
          </p>

          <div style={{ display: 'grid', gap: 12, marginTop: 28 }}>
            {[
              '支持 `window.characterData` 直提取导入，不依赖 DOM 结构',
              '每页默认 4 张角色卡，单卡独立滚动，便于同屏查看长卡',
              '所有在线成员同权编辑，所有变更进入活动日志',
              '悬浮笔记按房间保存在本地，不进入同步链路',
            ].map((item) => (
              <div
                key={item}
                style={{
                  padding: '12px 14px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section
          className="glass-panel"
          style={{
            padding: 28,
            borderRadius: 28,
            boxShadow: '0 28px 60px rgba(31, 41, 55, 0.12)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'var(--bg-overlay)', padding: 4, borderRadius: 999 }}>
            {(['create', 'join'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 999,
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
                  <label className="label">房间类型</label>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {ROOM_TYPES.map((item) => {
                      const active = roomType === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setRoomType(item.id)}
                          style={{
                            textAlign: 'left',
                            padding: '14px 16px',
                            borderRadius: 16,
                            border: active ? '1px solid #ea580c' : '1px solid var(--border-default)',
                            background: active ? 'rgba(249, 115, 22, 0.08)' : 'rgba(255,255,255,0.9)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{item.title}</div>
                          <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{item.desc}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="label">你的昵称</label>
                  <input className="input" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={20} required />
                </div>

                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 16,
                    border: '1px solid rgba(249, 115, 22, 0.16)',
                    background: 'rgba(255, 247, 237, 0.94)',
                    color: '#9a3412',
                    fontSize: 12,
                    lineHeight: 1.7,
                  }}
                >
                  房间默认保留 3 天。`GM 面板` 是当前仓库的主功能入口；如果只是想按文档体验完整流程，直接保持默认即可。
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
