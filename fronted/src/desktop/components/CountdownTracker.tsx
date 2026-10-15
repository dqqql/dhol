import { useState } from 'react'
import type { CountdownClock } from '@dhgc/shared/desktop'

export default function CountdownTracker({
  clocks,
  ready,
  onCreate,
  onAdjust,
  onReset,
  onDelete,
  onLog
}: {
  clocks: CountdownClock[]
  ready: boolean
  onCreate: (name: string, max: number) => void
  onAdjust: (id: string, delta: 1 | -1) => void
  onReset: (id: string) => void
  onDelete: (id: string) => void
  onLog?: (text: string) => void
}) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMax, setNewMax] = useState(6)
  const [deleteTarget, setDeleteTarget] = useState<CountdownClock | null>(null)

  const handleAdjust = (clock: CountdownClock, delta: 1 | -1) => {
    const value = Math.max(0, Math.min(clock.max, clock.value + delta))
    if (value === clock.value) return
    onAdjust(clock.id, delta)
    onLog?.(`倒计时【${clock.name}】推进至 ${value}/${clock.max}`)
    if (value >= clock.max) {
      onLog?.(`倒计时【${clock.name}】已满格触发！`)
    }
  }

  const handleReset = (clock: CountdownClock) => {
    onReset(clock.id)
    onLog?.(`倒计时【${clock.name}】已重置`)
  }

  const handleCreate = () => {
    const name = newName.trim() || '倒计时'
    onCreate(name, newMax)
    onLog?.(`新建倒计时【${name}】(${newMax}步)`)
    setIsAddOpen(false)
    setNewName('')
    setNewMax(6)
  }

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      onDelete(deleteTarget.id)
      onLog?.(`已删除倒计时【${deleteTarget.name}】`)
      setDeleteTarget(null)
    }
  }

  return <section className="clocks-card" aria-labelledby="clocks-title">
    <div className="clocks-header">
      <h3 id="clocks-title" className="clocks-title">倒计时</h3>
      <button type="button" disabled={!ready || clocks.length >= 20} onClick={() => setIsAddOpen(true)}>+ 新建</button>
    </div>

    <div className="clocks-list">
      {clocks.map(clock => {
        const isTriggered = clock.value >= clock.max
        const slots = Array.from({ length: clock.max }, (_, i) => i < clock.value)
        return <div key={clock.id} className={`clock-item ${isTriggered ? 'triggered' : ''}`}>
          <div className="clock-item-top">
            <div className="clock-name">{clock.name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="clock-badge-triggered">触发</span>
              <div className="clock-ratio">{clock.value} <small style={{ fontSize: '14px', color: 'var(--ink-muted)' }}>/ {clock.max}</small></div>
            </div>
          </div>
          <div className="clock-track">
            {slots.map((filled, i) => <div key={i} className={`clock-slot ${filled ? 'filled' : ''}`} />)}
          </div>
          <div className="clock-item-foot">
            <div className="clock-steppers">
              <button type="button" disabled={!ready || clock.value <= 0} onClick={() => handleAdjust(clock, -1)}>−</button>
              <button type="button" disabled={!ready || clock.value >= clock.max} onClick={() => handleAdjust(clock, 1)}>+</button>
              <button type="button" disabled={!ready || clock.value === 0} style={{ fontSize: '12px', padding: '0 8px' }} onClick={() => handleReset(clock)}>重置</button>
            </div>
            <button type="button" className="clock-del-btn" disabled={!ready} onClick={() => setDeleteTarget(clock)}>删除</button>
          </div>
        </div>
      })}
      {ready && clocks.length < 20 && <button type="button" className="clock-new-box" onClick={() => setIsAddOpen(true)}>+ 新建倒计时</button>}
    </div>

    {/* 新建倒计时弹窗 (滑块 2-12) */}
    {isAddOpen && <div className="modal-overlay show">
      <div className="modal-box modal-box--sm">
        <div className="modal-bar">
          <h2>新建倒计时</h2>
          <button type="button" onClick={() => setIsAddOpen(false)}>关闭</button>
        </div>
        <div className="modal-content">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontWeight: 800, fontSize: '13px' }}>名称</label>
              <input
                type="text"
                placeholder="例如：援军抵达"
                value={newName}
                maxLength={60}
                onChange={e => setNewName(e.target.value)}
                style={{ width: '100%', marginTop: '6px' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label style={{ fontWeight: 800, fontSize: '13px' }}>步数</label>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 900, color: 'var(--blue)' }}>{newMax}</span>
                  <span style={{ fontSize: '13px', color: 'var(--ink-muted)' }}>步</span>
                </div>
              </div>
              <input
                type="range"
                min={2}
                max={12}
                step={1}
                value={newMax}
                onChange={e => setNewMax(Number(e.target.value))}
                style={{ width: '100%', marginTop: '10px', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-muted)', marginTop: '4px' }}>
                <span>2</span><span>4</span><span>6</span><span>8</span><span>10</span><span>12</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button type="button" onClick={() => setIsAddOpen(false)}>取消</button>
              <button type="button" disabled={!ready} style={{ background: 'var(--ink)', color: '#fff' }} onClick={handleCreate}>创建</button>
            </div>
          </div>
        </div>
      </div>
    </div>}

    {/* 删除倒计时确认弹窗 */}
    {deleteTarget && <div className="modal-overlay show">
      <div className="modal-box modal-box--sm">
        <div className="modal-bar">
          <h2>删除倒计时</h2>
          <button type="button" onClick={() => setDeleteTarget(null)}>关闭</button>
        </div>
        <div className="modal-content">
          <p style={{ fontSize: '16px', fontWeight: 700 }}>
            确定删除倒计时【<span style={{ color: 'var(--red)' }}>{deleteTarget.name}</span>】？
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={() => setDeleteTarget(null)}>取消</button>
            <button type="button" className="btn-alert-confirm" disabled={!ready} onClick={handleConfirmDelete}>删除</button>
          </div>
        </div>
      </div>
    </div>}
  </section>
}
