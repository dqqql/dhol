import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@/store/useStore'
import type { RoleCardDetails } from '@/types'
import { Modal } from './Modal'
import { getCardBodyLines } from '@/utils/cardText'
import { getCardTypeLabel } from '@/utils/cardTypeConfig'

const EMPTY_ROLE_DETAILS: RoleCardDetails = {
  player_name: '',
  profession: '',
  ancestry: '',
  community: '',
}

export function EditCardModal() {
  const {
    room,
    currentPlayerId,
    isEditCardModalOpen,
    editingCardId,
    closeEditCardModal,
    editCard,
    lockCard,
    unlockCard,
  } = useStore()

  const card = useMemo(
    () => room?.map_cards.find((item) => item.id === editingCardId) ?? null,
    [editingCardId, room],
  )

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [style, setStyle] = useState('#2563eb')
  const [customTypeName, setCustomTypeName] = useState('')
  const [roleDetails, setRoleDetails] = useState<RoleCardDetails>(EMPTY_ROLE_DETAILS)
  const lockedCardIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!editingCardId || !isEditCardModalOpen) return

    const latestCard = useStore.getState().room?.map_cards.find((item) => item.id === editingCardId)
    if (!latestCard) return

    setTitle(latestCard.title)
    setContent(latestCard.content)
    setStyle(latestCard.style)
    setCustomTypeName(latestCard.custom_type_name ?? '')
    setRoleDetails(latestCard.role_details ?? EMPTY_ROLE_DETAILS)
  }, [editingCardId, isEditCardModalOpen])

  useEffect(() => {
    if (!editingCardId || !isEditCardModalOpen) return

    lockedCardIdRef.current = editingCardId

    const latestCard = useStore.getState().room?.map_cards.find((item) => item.id === editingCardId)
    if (latestCard?.locked_by_player_id !== currentPlayerId) {
      lockCard(editingCardId)
    }

    return () => {
      const lockedCardId = lockedCardIdRef.current
      if (!lockedCardId) return

      const currentCard = useStore.getState().room?.map_cards.find((item) => item.id === lockedCardId)
      if (currentCard?.locked_by_player_id === currentPlayerId) {
        unlockCard(lockedCardId)
      }

      lockedCardIdRef.current = null
    }
  }, [currentPlayerId, editingCardId, isEditCardModalOpen, lockCard, unlockCard])

  if (!card) return null

  const activeCard = card
  const previewLines = getCardBodyLines({
    type: activeCard.type,
    content,
    role_details: activeCard.type === 'Role' ? roleDetails : undefined,
  })
  const typeLabel = getCardTypeLabel(activeCard.type, activeCard.custom_type_name)
  const isCustomTypeInvalid = activeCard.type === 'Custom' && !customTypeName.trim()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || isCustomTypeInvalid) return

    editCard(activeCard.id, {
      title: title.trim(),
      content: content.trim(),
      style,
      custom_type_name: activeCard.type === 'Custom' ? customTypeName.trim() : undefined,
      ...(activeCard.type === 'Role'
        ? {
            role_details: {
              player_name: roleDetails.player_name.trim() || title.trim(),
              profession: roleDetails.profession.trim(),
              ancestry: roleDetails.ancestry.trim(),
              community: roleDetails.community.trim(),
            },
          }
        : {}),
    })
  }

  return (
    <Modal
      open={isEditCardModalOpen}
      onClose={closeEditCardModal}
      title={activeCard.type === 'Role' ? '编辑角色卡' : `编辑${typeLabel}卡`}
      maxWidth={520}
    >
      <form onSubmit={handleSubmit}>
        {activeCard.type === 'Custom' && (
          <div style={{ marginBottom: 14 }}>
            <label className="label">自定义类型名</label>
            <input
              className="input"
              value={customTypeName}
              onChange={(event) => setCustomTypeName(event.target.value)}
              placeholder="输入自定义类型名"
              maxLength={20}
              required
            />
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label className="label">标题</label>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="输入卡牌标题"
            maxLength={30}
            required
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="label">描述</label>
          <textarea
            className="input"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="输入描述内容"
            rows={5}
          />
        </div>

        {activeCard.type === 'Role' && (
          <div style={{ marginBottom: 14 }}>
            <label className="label">角色信息</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <input
                className="input"
                value={roleDetails.player_name}
                onChange={(event) => setRoleDetails((prev) => ({ ...prev, player_name: event.target.value }))}
                placeholder="名字"
              />
              <input
                className="input"
                value={roleDetails.profession}
                onChange={(event) => setRoleDetails((prev) => ({ ...prev, profession: event.target.value }))}
                placeholder="职业"
              />
              <input
                className="input"
                value={roleDetails.ancestry}
                onChange={(event) => setRoleDetails((prev) => ({ ...prev, ancestry: event.target.value }))}
                placeholder="种族"
              />
              <input
                className="input"
                value={roleDetails.community}
                onChange={(event) => setRoleDetails((prev) => ({ ...prev, community: event.target.value }))}
                placeholder="社群"
              />
            </div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label className="label">展示颜色</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="color"
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              style={{
                width: 42,
                height: 42,
                border: '1px solid var(--border-default)',
                background: 'transparent',
                padding: 2,
                cursor: 'pointer',
              }}
            />
            <input
              className="input"
              value={style}
              onChange={(event) => setStyle(event.target.value)}
              placeholder="#2563eb"
              maxLength={7}
            />
          </div>
        </div>

        <div
          style={{
            marginBottom: 20,
            padding: 14,
            border: `1px solid ${style}55`,
            borderLeft: `4px solid ${style}`,
            background: 'var(--bg-overlay)',
          }}
        >
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
            预览
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {title || '未命名卡牌'}
          </div>
          <div style={{ fontSize: 11, color: style, marginBottom: 8 }}>
            {getCardTypeLabel(activeCard.type, activeCard.type === 'Custom' ? customTypeName : activeCard.custom_type_name)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, lineHeight: 1.65, color: 'var(--text-secondary)' }}>
            {previewLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
            {!previewLines.length && <div>暂无描述</div>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={closeEditCardModal}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim() || isCustomTypeInvalid}>
            保存修改
          </button>
        </div>
      </form>
    </Modal>
  )
}
