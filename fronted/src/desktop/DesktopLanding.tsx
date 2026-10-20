import { useState, useRef, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { apiBase, type DesktopSession } from './desktop-api'
import { getSavedNickname, saveSavedNickname, getRoomHistory, saveRoomHistoryItem, saveRoomOwnerKey, type HistoryRoomItem } from './room-history'

interface SessionResponse { session: DesktopSession; room: { roomId: string; name?: string }; ownerKey?: string; code?: string }
const errors: Record<string, string> = {
  ROOM_NOT_FOUND: '找不到这个房间。',
  ROOM_FULL: '房间已满。',
  ROOM_EXPIRED: '房间已过期。',
  RATE_LIMITED: '操作太频繁，请稍后重试。',
  INVALID_BACKUP: '备份文件无效或不是新版房间备份。'
}

export default function DesktopLanding({ onEnter, initialInviteCode = '' }: { onEnter: (session: DesktopSession) => void; initialInviteCode?: string }) {
  const [nickname, setNickname] = useState(() => getSavedNickname())
  const [roomName, setRoomName] = useState('')
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [backup, setBackup] = useState<unknown>(null)
  const [backupName, setBackupName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [historyRooms, setHistoryRooms] = useState<HistoryRoomItem[]>(() => {
    const saved = getSavedNickname()
    return saved ? getRoomHistory(saved) : []
  })
  const [animKey, setAnimKey] = useState(0)
  const [flyingCode, setFlyingCode] = useState<string | null>(null)
  const joinButtonRef = useRef<HTMLButtonElement | null>(null)

  function refreshHistory(targetNickname: string) {
    const trimmed = targetNickname.trim()
    saveSavedNickname(trimmed)
    if (trimmed) {
      setHistoryRooms(getRoomHistory(trimmed))
      setAnimKey(prev => prev + 1)
    } else {
      setHistoryRooms([])
    }
  }

  function handleNicknameBlur() {
    refreshHistory(nickname)
  }

  function handleNicknameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    }
  }

  async function request(path: string, body: unknown) {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${apiBase()}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const result = await response.json() as SessionResponse
      if (!response.ok) throw new Error(errors[result.code ?? ''] ?? '无法进入房间，请检查输入后重试。')

      const currentNickname = nickname.trim() || result.session.nickname
      const targetName = (result.room as { name?: string })?.name || roomName.trim() || '未命名房间'
      saveSavedNickname(currentNickname)
      saveRoomHistoryItem(currentNickname, result.session.inviteCode, targetName)
      if (result.ownerKey) saveRoomOwnerKey(result.session.roomId, result.ownerKey)

      onEnter(result.session)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '网络连接失败。')
    } finally {
      setBusy(false)
    }
  }

  function submit(event: FormEvent, action: 'create' | 'join') {
    event.preventDefault()
    void request(
      `/api/v2/rooms${action === 'join' ? '/join' : ''}`,
      action === 'join'
        ? { nickname: nickname.trim(), invite_code: inviteCode.trim().toUpperCase() }
        : { nickname: nickname.trim(), room_name: roomName.trim() }
    )
  }

  function handleSelectHistoryRoom(room: HistoryRoomItem, cardEl: HTMLElement) {
    if (busy || flyingCode) return
    const currentNickname = nickname.trim()
    if (!currentNickname) return

    setFlyingCode(room.code)
    setError('')

    const targetEl = joinButtonRef.current || document.getElementById('invite-code')
    if (!targetEl) {
      setInviteCode(room.code)
      void request('/api/v2/rooms/join', {
        nickname: currentNickname,
        invite_code: room.code
      }).finally(() => {
        setFlyingCode(null)
      })
      return
    }

    const fromRect = cardEl.getBoundingClientRect()
    const toRect = targetEl.getBoundingClientRect()

    const clone = cardEl.cloneNode(true) as HTMLElement
    clone.classList.add('landing-history-card--flying-clone')
    clone.style.position = 'fixed'
    clone.style.left = `${fromRect.left}px`
    clone.style.top = `${fromRect.top}px`
    clone.style.width = `${fromRect.width}px`
    clone.style.height = `${fromRect.height}px`
    clone.style.margin = '0'
    clone.style.zIndex = '99999'
    clone.style.pointerEvents = 'none'
    clone.style.boxShadow = '6px 6px 0px rgba(10, 10, 10, 0.45)'
    clone.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease'
    document.body.appendChild(clone)

    cardEl.style.opacity = '0'

    requestAnimationFrame(() => {
      const deltaX = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2)
      const deltaY = (toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2)
      clone.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.65)`
      clone.style.opacity = '0.85'
    })

    setTimeout(() => {
      if (clone.parentNode) clone.parentNode.removeChild(clone)
      cardEl.style.opacity = ''
      setInviteCode(room.code)
      void request('/api/v2/rooms/join', {
        nickname: currentNickname,
        invite_code: room.code
      }).finally(() => {
        setFlyingCode(null)
      })
    }, 450)
  }

  async function chooseBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBackupName(file.name)
    setError('')
    try {
      setBackup(JSON.parse(await file.text()) as unknown)
    } catch {
      setBackup(null)
      setError('无法读取这个备份文件。')
    }
  }

  const hasNickname = nickname.trim().length > 0
  const canJoin = hasNickname && /^[A-Z0-9]{6}$/.test(inviteCode.trim())
  const canRestore = hasNickname && Boolean(backup)

  return (
    <main className="desktop-landing">
      <div className="landing-container">
        <div className="landing-window">
          {/* 顶部标题栏 */}
          <header className="landing-window__head">
            <h1>匕首港</h1>
            <p className="landing-window__notice">
              玩家请从SRD车卡器<a href="https://dhsheet.top" target="_blank" rel="noreferrer">dhsheet.top</a>或者pbdh车卡器<a href="https://daggerheart.cn/pbdh" target="_blank" rel="noreferrer">daggerheart.cn/pbdh</a>直接发送角色卡至房间，无需文件导入
            </p>
          </header>

          <div className="landing-window__body">
            {/* 玩家称呼（全局前提） */}
            <section className="landing-identity-bar">
              <label htmlFor="nickname">你的称呼</label>
              <input
                id="nickname"
                className="landing-identity-input"
                value={nickname}
                maxLength={24}
                autoComplete="nickname"
                placeholder="请输入称呼（必填）"
                onChange={event => setNickname(event.target.value)}
                onBlur={handleNicknameBlur}
                onKeyDown={handleNicknameKeyDown}
                required
              />
            </section>

            {/* 错误提示 */}
            {error && <p className="landing-error-bar" role="alert">{error}</p>}

            {/* 三栏核心动作区 */}
            <div className="landing-grid">
              {/* 1. 创建房间 */}
              <section className="landing-action-cell">
                <header className="landing-action-cell__head">
                  <h2>创建房间</h2>
                </header>
                <form className="landing-action-cell__body" onSubmit={event => submit(event, 'create')}>
                  <div className="landing-form-group">
                    <input
                      id="room-name"
                      aria-label="房间名称"
                      className="landing-input"
                      value={roomName}
                      maxLength={60}
                      onChange={event => setRoomName(event.target.value)}
                      placeholder="未命名房间"
                    />
                  </div>
                  <button type="submit" className="landing-btn-submit" disabled={busy || !hasNickname}>
                    创建房间
                  </button>
                </form>
              </section>

              {/* 2. 加入房间 */}
              <section className="landing-action-cell">
                <header className="landing-action-cell__head">
                  <h2>加入房间</h2>
                </header>
                <form className="landing-action-cell__body" onSubmit={event => submit(event, 'join')}>
                  <div className="landing-form-group">
                    <input
                      id="invite-code"
                      aria-label="六位邀请码"
                      className="landing-input landing-input--mono"
                      value={inviteCode}
                      maxLength={6}
                      spellCheck={false}
                      onChange={event => setInviteCode(event.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  <button
                    ref={joinButtonRef}
                    type="submit"
                    className="landing-btn-submit"
                    disabled={busy || !canJoin}
                  >
                    加入房间
                  </button>
                </form>
              </section>

              {/* 3. 恢复房间 */}
              <section className="landing-action-cell">
                <header className="landing-action-cell__head">
                  <h2>恢复房间</h2>
                </header>
                <div className="landing-action-cell__body">
                  <div className="landing-form-group">
                    <label htmlFor="backup-file" className="landing-file-btn">
                      {backupName ? backupName : '点击选择备份文件'}
                    </label>
                    <input
                      id="backup-file"
                      type="file"
                      className="landing-file-hidden"
                      accept="application/json,.json"
                      onChange={event => void chooseBackup(event)}
                    />
                  </div>
                  <button
                    type="button"
                    className="landing-btn-submit landing-btn-submit--outline"
                    disabled={busy || !canRestore}
                    onClick={() => void request('/api/v2/rooms/restore', { nickname: nickname.trim(), backup })}
                  >
                    恢复房间
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* 历史房间区域（红框对应位置） */}
        {hasNickname && historyRooms.length > 0 && (
          <section className="landing-history" aria-label="曾加入的房间">
            <header className="landing-history__head">
              <span className="landing-history__title">曾加入的房间</span>
              <span className="landing-history__tip">点击直接进入</span>
            </header>
            <div className="landing-history__grid">
              {historyRooms.map((room, index) => {
                const isFading = flyingCode !== null && flyingCode !== room.code
                const isFlyingSource = flyingCode === room.code
                return (
                  <button
                    key={`${animKey}:${room.code}`}
                    type="button"
                    className={`landing-history-card${isFading ? ' landing-history-card--fading' : ''}${isFlyingSource ? ' landing-history-card--flying-source' : ''}`}
                    style={{ animationDelay: `${index * 70}ms` }}
                    onClick={event => handleSelectHistoryRoom(room, event.currentTarget)}
                    title={`加入房间：${room.name} (${room.code})`}
                    disabled={busy || flyingCode !== null}
                  >
                    <span className="landing-history-card__code">{room.code}</span>
                    <span className="landing-history-card__name">{room.name}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
