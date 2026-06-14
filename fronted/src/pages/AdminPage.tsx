import React, { useState } from 'react'
import { ArrowLeft, CalendarClock, KeyRound, LoaderCircle, Search, ShieldCheck, Users } from 'lucide-react'
import {
  fetchAdminRoom,
  updateAdminRoomExpiry,
  type AdminRoomSummary,
} from '@/lib/admin'

const DURATION_PRESETS = [7, 30, 90, 180]

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

function roomTypeLabel(roomType: AdminRoomSummary['room_type']) {
  return roomType === 'mobile-panel' ? '手机角色码房间' : 'GM 面板房间'
}

export function AdminPage() {
  const [secret, setSecret] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [durationDays, setDurationDays] = useState(30)
  const [room, setRoom] = useState<AdminRoomSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const cleanedInviteCode = inviteCode.trim().toUpperCase()
  const canSearch = secret.trim().length > 0 && /^[A-Z0-9]{6}$/.test(cleanedInviteCode)

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    if (!canSearch) return

    setIsLoading(true)
    setError('')
    setNotice('')
    try {
      setRoom(await fetchAdminRoom(cleanedInviteCode, secret.trim()))
    } catch (requestError) {
      setRoom(null)
      setError(requestError instanceof Error ? requestError.message : String(requestError))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (!room || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) return

    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      const updatedRoom = await updateAdminRoomExpiry(room.invite_code, secret.trim(), durationDays)
      setRoom(updatedRoom)
      setNotice(`房间已从现在起延长为 ${durationDays} 天。`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <a className="admin-back-link" href="/">
            <ArrowLeft size={16} />
            返回房间入口
          </a>
          <div className="admin-title-row">
            <div className="admin-title-icon" aria-hidden="true">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="admin-eyebrow">ROOM OPERATIONS</div>
              <h1>房间后台管理</h1>
              <p>通过邀请码查询房间，并调整它从现在起的持续时间。</p>
            </div>
          </div>
        </header>

        <section className="admin-card" aria-labelledby="admin-search-title">
          <div className="admin-card-heading">
            <KeyRound size={18} />
            <div>
              <h2 id="admin-search-title">验证并查找房间</h2>
              <p>管理密钥只保留在当前页面内存中，不会写入浏览器存储。</p>
            </div>
          </div>

          <form className="admin-search-form" onSubmit={handleSearch}>
            <label>
              <span className="label">管理密钥</span>
              <input
                className="input"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                autoComplete="off"
                placeholder="输入 ADMIN_SECRET"
                required
              />
            </label>
            <label>
              <span className="label">房间邀请码</span>
              <input
                className="input admin-invite-input"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={6}
                autoComplete="off"
                placeholder="ABC123"
                required
              />
            </label>
            <button className="btn btn-primary admin-search-button" type="submit" disabled={!canSearch || isLoading}>
              {isLoading ? <LoaderCircle className="admin-spinner" size={16} /> : <Search size={16} />}
              {isLoading ? '查询中' : '查询房间'}
            </button>
          </form>
        </section>

        {error && <div className="admin-feedback admin-feedback--error" role="alert">{error}</div>}
        {notice && <div className="admin-feedback admin-feedback--success" role="status">{notice}</div>}

        {room && (
          <section className="admin-card admin-room-card" aria-labelledby="admin-room-title">
            <div className="admin-room-topline">
              <div>
                <div className="admin-room-code">{room.invite_code}</div>
                <h2 id="admin-room-title">{room.room_name}</h2>
                <p>{roomTypeLabel(room.room_type)}</p>
              </div>
              <div className="admin-status-badge">房间有效</div>
            </div>

            <dl className="admin-stats">
              <div>
                <dt><CalendarClock size={15} /> 当前到期时间</dt>
                <dd>{formatDate(room.expires_at)}</dd>
              </div>
              <div>
                <dt><Users size={15} /> 玩家状态</dt>
                <dd>{room.online_player_count} 在线 / {room.player_count} 人</dd>
              </div>
              <div>
                <dt>创建时间</dt>
                <dd>{formatDate(room.created_at)}</dd>
              </div>
              <div>
                <dt>最后更新</dt>
                <dd>{formatDate(room.updated_at)}</dd>
              </div>
            </dl>

            <div className="admin-divider" />

            <form className="admin-duration-form" onSubmit={handleSave}>
              <div>
                <h3>设置新的持续时间</h3>
                <p>保存后，将以当前时间为起点重新计算到期时间。范围为 1 到 365 天。</p>
              </div>

              <div className="admin-presets" aria-label="持续时间快捷选项">
                {DURATION_PRESETS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={durationDays === days ? 'admin-preset admin-preset--active' : 'admin-preset'}
                    onClick={() => setDurationDays(days)}
                  >
                    {days} 天
                  </button>
                ))}
              </div>

              <label className="admin-duration-input">
                <span className="label">持续天数</span>
                <div>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={durationDays}
                    onChange={(event) => setDurationDays(Number(event.target.value))}
                    required
                  />
                  <span>天</span>
                </div>
              </label>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={isSaving || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365}
              >
                {isSaving ? <LoaderCircle className="admin-spinner" size={16} /> : <CalendarClock size={16} />}
                {isSaving ? '保存中' : '更新到期时间'}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  )
}
