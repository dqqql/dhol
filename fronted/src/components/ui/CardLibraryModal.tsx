import React, { useMemo, useState } from 'react'
import { createPackLibrary } from '@dhgc/shared'
import { useStore } from '@/store/useStore'
import { Modal } from './Modal'
import { BookOpen, CheckSquare, Download, Layers3 } from 'lucide-react'
import { getCardTypeLabel } from '@/utils/cardTypeConfig'

export function CardLibraryModal() {
  const {
    room,
    currentPlayerId,
    isCardLibraryOpen,
    closeCardLibrary,
    importLibraryPack,
    importLibraryCards,
  } = useStore()
  const [activePackId, setActivePackId] = useState<string | null>(null)
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])

  const packs = useMemo(() => (
    room ? createPackLibrary(room.imported_pack_library) : []
  ), [room])
  const activePack = useMemo(() => {
    if (!packs.length) return null
    return packs.find((pack) => pack.id === activePackId) ?? packs[0]
  }, [activePackId, packs])

  if (!room) return null

  const isHost = room.host_player_id === currentPlayerId
  const importsEnabled = room.settings.imports_enabled

  function openPack(packId: string) {
    setActivePackId(packId)
    setSelectedCardIds([])
  }

  function toggleCard(cardId: string) {
    setSelectedCardIds((current) => (
      current.includes(cardId)
        ? current.filter((id) => id !== cardId)
        : [...current, cardId]
    ))
  }

  function handleImportSelectedCards() {
    if (!activePack || !selectedCardIds.length) return
    importLibraryCards(activePack.id, selectedCardIds)
    setSelectedCardIds([])
  }

  function handleImportWholePack() {
    if (!activePack) return
    importLibraryPack(activePack.id, activePack.pack_name)
  }

  return (
    <Modal open={isCardLibraryOpen} onClose={closeCardLibrary} title="卡包库" maxWidth={980}>
      <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', gap: 16, minHeight: 520 }}>
        <div
          style={{
            border: '1px solid var(--border-default)',
            background: 'var(--bg-overlay)',
            padding: 10,
            overflow: 'auto',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
            全部卡包（{packs.length}）
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {packs.map((pack) => {
              const selected = activePack?.id === pack.id

              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => openPack(pack.id)}
                  style={{
                    textAlign: 'left',
                    border: selected ? '1px solid var(--accent-violet)' : '1px solid var(--border-default)',
                    background: selected ? 'rgba(124,111,222,0.08)' : 'var(--bg-base)',
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{pack.pack_name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pack.source === 'built-in' ? '内置' : '导入'}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                    {pack.cards.length} 张卡牌
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div
          style={{
            border: '1px solid var(--border-default)',
            background: 'var(--bg-overlay)',
            padding: 14,
            minWidth: 0,
          }}
        >
          {activePack ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpen size={16} />
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{activePack.pack_name}</h3>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {activePack.description ?? '暂无简介'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleImportSelectedCards}
                    disabled={!importsEnabled || !selectedCardIds.length}
                  >
                    <CheckSquare size={13} /> 导入选中卡牌
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleImportWholePack}
                    disabled={!importsEnabled || !isHost}
                  >
                    <Download size={13} /> 追加整包
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {!importsEnabled && '当前房间尚未启用导入功能，卡包库可查看但不能导入。'}
                {importsEnabled && isHost && '你是房主：可以追加整包，也可以导入任意选中的卡牌。'}
                {importsEnabled && !isHost && '你可以导入选中的卡牌；追加整包和导入房间备份仅限房主。'}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, maxHeight: 390, overflow: 'auto' }}>
                {activePack.cards.map((card) => {
                  const selected = selectedCardIds.includes(card.id)

                  return (
                    <label
                      key={card.id}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        border: selected ? '1px solid var(--accent-violet)' : '1px solid var(--border-default)',
                        background: selected ? 'rgba(124,111,222,0.08)' : 'var(--bg-base)',
                        padding: '10px 12px',
                        cursor: importsEnabled ? 'pointer' : 'default',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCard(card.id)}
                        disabled={!importsEnabled}
                        style={{ marginTop: 2 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{card.title}</strong>
                          <span style={{ fontSize: 10, color: card.style }}>{getCardTypeLabel(card.type, card.custom_type_name)}</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {card.content}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Layers3 size={18} style={{ marginRight: 8 }} />
              当前没有可查看的卡包
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
