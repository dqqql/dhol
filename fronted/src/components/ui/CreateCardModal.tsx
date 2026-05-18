import React, { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { Modal } from './Modal'
import type { DeckCardType } from '@/types'
import { getCardTypeLabel, getCardVisualConfig } from '@/utils/cardTypeConfig'

const TYPES: DeckCardType[] = ['Location', 'Feature', 'Hook', 'Custom']

export function CreateCardModal() {
  const { isCreateCardModalOpen, closeCreateCardModal, createCustomCard } = useStore()
  const [type, setType] = useState<DeckCardType>('Hook')
  const [customTypeName, setCustomTypeName] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    if (isCreateCardModalOpen) return

    setType('Hook')
    setCustomTypeName('')
    setTitle('')
    setContent('')
  }, [isCreateCardModalOpen])

  const visualConfig = getCardVisualConfig(type, undefined, customTypeName)
  const resolvedTypeLabel = getCardTypeLabel(type, customTypeName)
  const isCustomTypeInvalid = type === 'Custom' && !customTypeName.trim()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || isCustomTypeInvalid) return

    createCustomCard({
      type,
      custom_type_name: type === 'Custom' ? customTypeName.trim() : undefined,
      title: title.trim(),
      content: content.trim(),
      style: visualConfig.color,
      is_custom: true,
    })
  }

  return (
    <Modal open={isCreateCardModalOpen} onClose={closeCreateCardModal} title="自创卡牌" maxWidth={460}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label className="label">卡牌类型</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {TYPES.map((value) => {
              const optionConfig = getCardVisualConfig(value)
              const selected = type === value

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  style={{
                    padding: '9px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${selected ? optionConfig.color : 'var(--border-default)'}`,
                    background: selected ? optionConfig.bg : 'var(--bg-overlay)',
                    color: selected ? optionConfig.color : 'var(--text-secondary)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  {getCardTypeLabel(value)}
                </button>
              )
            })}
          </div>
        </div>

        {type === 'Custom' && (
          <div style={{ marginBottom: 14 }}>
            <label className="label">自定义类型名</label>
            <input
              className="input"
              value={customTypeName}
              onChange={(event) => setCustomTypeName(event.target.value)}
              placeholder="例如：派系、线索、事件"
              maxLength={20}
              required
            />
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              自定义类型默认使用独立的青绿色，和现有的故事、地点、特色区分开。
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label className="label">标题</label>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="输入卡牌名称"
            maxLength={30}
            required
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="label">描述</label>
          <textarea
            className="input"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="输入描述文字"
            rows={4}
          />
        </div>

        {title.trim() && (
          <div
            style={{
              marginBottom: 20,
              padding: 12,
              background: 'var(--bg-overlay)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${visualConfig.border}`,
              borderTop: `3px solid ${visualConfig.color}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: visualConfig.color,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 4,
              }}
            >
              {resolvedTypeLabel} · 预览
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 4,
                fontFamily: '"Noto Sans SC", sans-serif',
              }}
            >
              {title}
            </div>
            {content.trim() && (
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.65,
                  fontFamily: '"Noto Sans SC", sans-serif',
                }}
              >
                {content}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={closeCreateCardModal}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim() || isCustomTypeInvalid}>
            创建并加入手牌
          </button>
        </div>
      </form>
    </Modal>
  )
}
