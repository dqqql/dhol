import React, { useEffect, useMemo, useState } from 'react'
import type { ConnectionColor } from '@/types'
import { useStore } from '@/store/useStore'
import { Modal } from './Modal'

const COLOR_OPTIONS: Array<{ value: ConnectionColor; label: string; description: string; color: string }> = [
  { value: 'red', label: '冲突', description: '敌对、阻碍、紧张', color: 'var(--conn-conflict)' },
  { value: 'green', label: '盟友', description: '合作、支援、友好', color: 'var(--conn-ally)' },
  { value: 'gray', label: '未知', description: '传闻、暧昧、待定', color: 'var(--conn-unknown)' },
]

export function ConnectionModal() {
  const {
    room,
    connectionEditor,
    closeConnectionEditor,
    addConnection,
    updateConnection,
    removeConnection,
  } = useStore()

  const existingConnection = useMemo(
    () => connectionEditor?.connectionId
      ? room?.connections.find((item) => item.id === connectionEditor.connectionId) ?? null
      : null,
    [connectionEditor, room],
  )

  const fromCard = useMemo(
    () => connectionEditor ? room?.map_cards.find((item) => item.id === connectionEditor.fromCardId) ?? null : null,
    [connectionEditor, room],
  )
  const toCard = useMemo(
    () => connectionEditor ? room?.map_cards.find((item) => item.id === connectionEditor.toCardId) ?? null : null,
    [connectionEditor, room],
  )

  const [color, setColor] = useState<ConnectionColor>('gray')
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!connectionEditor) return
    setColor(existingConnection?.color ?? 'gray')
    setLabel(existingConnection?.label ?? '')
  }, [connectionEditor, existingConnection])

  if (!connectionEditor || !fromCard || !toCard) return null
  const activeFromCard = fromCard
  const activeToCard = toCard

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (existingConnection) {
      updateConnection(existingConnection.id, {
        color,
        label: label.trim() || undefined,
      })
      return
    }

    addConnection({
      from_card_id: activeFromCard.id,
      to_card_id: activeToCard.id,
      color,
      label: label.trim() || undefined,
    })
  }

  return (
    <Modal
      open={Boolean(connectionEditor)}
      onClose={closeConnectionEditor}
      title={existingConnection ? '编辑连线' : '创建连线'}
      maxWidth={520}
    >
      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: 10,
            alignItems: 'center',
            marginBottom: 18,
          }}
        >
          <div className="connection-card-chip">
            <span className="connection-card-chip__label">起点</span>
            <span className="connection-card-chip__title">{activeFromCard.title}</span>
          </div>
          <div style={{ fontSize: 18, color: 'var(--text-muted)', textAlign: 'center' }}>→</div>
          <div className="connection-card-chip">
            <span className="connection-card-chip__label">终点</span>
            <span className="connection-card-chip__title">{activeToCard.title}</span>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label className="label">关系类型</label>
          <div style={{ display: 'grid', gap: 8 }}>
            {COLOR_OPTIONS.map((option) => {
              const active = option.value === color
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColor(option.value)}
                  className="connection-color-option"
                  style={{
                    borderColor: active ? option.color : 'var(--border-default)',
                    background: active ? 'color-mix(in srgb, white 78%, transparent)' : 'var(--bg-overlay)',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: option.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {option.label}
                    </span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {option.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="label">关系标签</label>
          <input
            className="input"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="例如：血脉、盟约、传闻、宿敌"
            maxLength={40}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div>
            {existingConnection && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => removeConnection(existingConnection.id)}
              >
                删除连线
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={closeConnectionEditor}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              {existingConnection ? '保存连线' : '创建连线'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
