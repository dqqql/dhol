import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Shuffle, Sparkles } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { getCardBodyLines } from '@/utils/cardText'
import { getCardVisualConfig } from '@/utils/cardTypeConfig'
import { getCardGridSize } from '@/utils/grid'
import type { DhCard } from '@/types'

export function HandArea() {
  const {
    room,
    currentPlayerId,
    isHandPanelOpen,
    toggleHandPanel,
    drawCards,
    openCreateCardModal,
  } = useStore()

  if (!room) return null

  const isCoCreation = room.mode === 'co-creation'
  const isMyTurn = room.current_turn_player_id === currentPlayerId
  const hand: DhCard[] = room.hands[currentPlayerId] ?? []
  const roleCard = hand.find((card) => card.type === 'Role') ?? null
  const regularCards = hand.filter((card) => card.type !== 'Role')
  const roleCardAlreadyOnMap = room.map_cards.some(
    (card) => card.type === 'Role' && card.placed_by_player_id === currentPlayerId,
  )

  if (!isCoCreation) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        pointerEvents: 'none',
      }}
    >
      <div
        className="glass-panel"
        data-hand-drop-target="true"
        style={{
          margin: '0 12px 12px',
          padding: 0,
          overflow: 'hidden',
          pointerEvents: 'all',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          transform: isHandPanelOpen ? 'none' : 'translateY(calc(100% - 44px))',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            borderBottom: isHandPanelOpen ? '1px solid var(--border-subtle)' : 'none',
            cursor: 'pointer',
          }}
          onClick={toggleHandPanel}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            手牌区
          </span>

          <div
            style={{
              background: 'rgba(124,111,222,0.15)',
              color: 'var(--accent-violet)',
              fontSize: 11,
              fontWeight: 700,
              padding: '1px 7px',
              borderRadius: 99,
              border: '1px solid rgba(124,111,222,0.25)',
            }}
          >
            {hand.length}
          </div>

          {isMyTurn && (
            <div
              style={{
                padding: '2px 10px',
                borderRadius: 99,
                background: 'rgba(16,185,129,0.12)',
                color: 'var(--accent-emerald)',
                fontSize: 11,
                fontWeight: 600,
                border: '1px solid rgba(16,185,129,0.2)',
              }}
            >
              你的回合
            </div>
          )}

          <div style={{ flex: 1 }} />

          <div
            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            onClick={(event) => event.stopPropagation()}
          >
            {isMyTurn && (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={drawCards}
                  title="从三类卡牌中各翻出一张，再三选一加入手牌"
                >
                  <Shuffle size={13} /> 抽牌
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={openCreateCardModal}
                  title="创建一张自定义卡牌"
                >
                  <Plus size={13} /> 自创
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => useStore.getState().endTurn()}
                >
                  结束回合
                </button>
              </>
            )}

            <button
              className="btn btn-primary btn-sm"
              onClick={toggleHandPanel}
              title={isHandPanelOpen ? '收起手牌区' : '展开手牌区'}
            >
              {isHandPanelOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
              {isHandPanelOpen ? '收起手牌' : '展开手牌'}
            </button>
          </div>
        </div>

        {isHandPanelOpen && (
          <div style={{ padding: '12px 14px', overflow: 'hidden' }}>
            <div className="hand-panel-layout">
              <section className="hand-role-rail" aria-label="角色卡专属槽位">
                <div className="hand-column__header hand-column__header--role">
                  <span>角色卡槽位</span>
                  <span className="hand-column__count">{roleCard ? 1 : 0}</span>
                </div>
                <div className="hand-column__body hand-column__body--role">
                  {roleCard ? (
                    <HandCard card={roleCard} index={0} canPlay={isMyTurn} isRoleSpecial />
                  ) : (
                    <div className="hand-empty-card hand-empty-card--role">
                      <div className="hand-empty-card__icon"><Sparkles size={16} /></div>
                      <div>{roleCardAlreadyOnMap ? '角色卡已上场' : '本轮暂未补发角色卡'}</div>
                      <div className="hand-empty-card__hint">
                        {roleCardAlreadyOnMap
                          ? '你的角色已经进入画布，可以继续围绕它建立关系和补充信息。'
                          : '开始新一轮共创时会自动补发。'}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="hand-main-rail" aria-label="普通手牌滚动区">
                <div className="hand-column__header">
                  <span>普通手牌</span>
                  <span className="hand-column__count">{regularCards.length}</span>
                </div>
                <div className="hand-column__body hand-column__body--main">
                  {regularCards.length === 0 ? (
                    <div className="hand-empty-card hand-empty-card--main">
                      <div>当前没有普通手牌</div>
                      <div className="hand-empty-card__hint">
                        起始仍会按地点、特色、故事各发两张；之后抽牌时再从三类中各翻一张，三选一加入手牌。
                      </div>
                    </div>
                  ) : (
                    <div className="hand-card-row">
                      {regularCards.map((card, index) => (
                        <HandCard
                          key={card.id}
                          card={card}
                          index={index}
                          canPlay={isMyTurn}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function HandCard({
  card,
  index,
  canPlay,
  isRoleSpecial = false,
}: {
  card: DhCard
  index: number
  canPlay: boolean
  isRoleSpecial?: boolean
}) {
  const cfg = getCardVisualConfig(card.type, card.style, card.custom_type_name)
  const [isDragging, setIsDragging] = useState(false)
  const { beginHandCardDrag, clearHandCardDrag } = useStore()
  const bodyLines = getCardBodyLines(card)

  return (
    <div
      className={`hand-card-shell ${isRoleSpecial ? 'hand-card-shell--role' : ''}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div
        className={`hand-card ${isDragging ? 'hand-card--dragging' : ''} ${isRoleSpecial ? 'hand-card--role' : ''}`}
        style={{
          borderTop: `3px solid ${cfg.color}`,
          opacity: canPlay ? 1 : 0.65,
        }}
        draggable={canPlay}
        onDragStart={(event) => {
          if (!canPlay) return

          setIsDragging(true)

          const rect = event.currentTarget.getBoundingClientRect()
          beginHandCardDrag(card, {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          })

          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('application/dh-card-id', card.id)
          event.dataTransfer.setData('application/dh-card-type', card.type)
          event.dataTransfer.setData('text/plain', card.title)

          const dragImage = event.currentTarget.cloneNode(true) as HTMLDivElement
          dragImage.style.position = 'fixed'
          dragImage.style.top = '-9999px'
          dragImage.style.left = '-9999px'
          dragImage.style.margin = '0'
          dragImage.style.width = `${rect.width}px`
          dragImage.style.height = `${rect.height}px`
          dragImage.style.transform = 'rotate(-7deg) scale(1.03)'
          dragImage.style.boxShadow = '0 24px 48px rgba(15,23,42,0.32), 0 0 0 1px rgba(37,99,235,0.14)'
          dragImage.style.opacity = '0.98'
          dragImage.style.pointerEvents = 'none'
          dragImage.style.zIndex = '9999'
          document.body.appendChild(dragImage)

          const { width, height } = getCardGridSize(card.type)
          event.dataTransfer.setDragImage(
            dragImage,
            width / 2,
            Math.min(height / 2, event.currentTarget.clientHeight / 2),
          )

          window.setTimeout(() => {
            if (dragImage.parentNode) {
              dragImage.parentNode.removeChild(dragImage)
            }
          }, 0)
        }}
        onDragEnd={() => {
          setIsDragging(false)
          clearHandCardDrag(card.id)
        }}
        title={canPlay ? '拖拽到画布以打出这张卡牌' : '不是你的回合，暂时不能打牌'}
      >
        {card.is_custom && (
          <div className="hand-card__custom-badge">
            自创
          </div>
        )}

        {isRoleSpecial && (
          <div className="hand-card__special-badge">
            专属
          </div>
        )}

        <div className="hand-card__body">
          <div className="hand-card__strip" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
            <cfg.Icon size={12} />
            <span>{cfg.label}</span>
          </div>

          <div className="hand-card__title">
            {card.title}
          </div>
        </div>

        <div className="hand-card__hover-detail">
          <div className="hand-card__hover-head">
            <div className="hand-card__hover-title-row">
              <div className="hand-card__hover-title">{card.title}</div>
            </div>
            <span className="hand-card__hover-type" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
              <cfg.Icon size={12} />
              {cfg.label}
            </span>
          </div>
          {card.is_custom && <span className="hand-card__hover-custom">自创卡牌</span>}
          {isRoleSpecial && <span className="hand-card__hover-custom">专属角色卡</span>}
          <div className="hand-card__hover-content">
            {bodyLines.length ? bodyLines.map((line, lineIndex) => <div key={`${lineIndex}-${line}`}>{line}</div>) : '暂无描述'}
          </div>
        </div>
      </div>
    </div>
  )
}
