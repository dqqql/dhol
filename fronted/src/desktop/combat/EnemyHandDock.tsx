import { useCallback, useEffect, useRef, useState } from 'react'
import type { CharacterSummary } from '@dhgc/shared/desktop'
import { formatSignedModifier } from './damage-formula'
import type { AttackRollAdvantage, EnemyHandCard } from './enemy-types'
import type { Point2D } from './AimingArrowOverlay'

function trackSlots(max: number, marked: number): boolean[] {
  return Array.from({ length: max }, (_, idx) => idx < marked)
}

export default function EnemyHandDock({
  hand,
  selectedId,
  defeatingIds,
  targetCharacter,
  advantage,
  attacking,
  ready,
  onSelectCard,
  onChangeAdvantage,
  onUpdateMark,
  onRemoveCard,
  onConfirmAttack,
  onCancel,
  onPointerInsideSelectedChange,
  onSelectedAnchorChange,
  onMeasureCardRect,
}: {
  hand: EnemyHandCard[]
  selectedId: string | null
  defeatingIds: ReadonlySet<string>
  targetCharacter: CharacterSummary | null
  advantage: AttackRollAdvantage
  attacking: boolean
  ready: boolean
  onSelectCard: (instanceId: string | null) => void
  onChangeAdvantage: (mode: AttackRollAdvantage) => void
  onUpdateMark: (instanceId: string, resource: 'hp' | 'stress', nextMarked: number) => void
  onRemoveCard: (instanceId: string) => void
  onConfirmAttack: () => void
  onCancel: () => void
  onPointerInsideSelectedChange: (inside: boolean) => void
  onSelectedAnchorChange: (point: Point2D | null) => void
  onMeasureCardRect: (instanceId: string, rect: DOMRect | null) => void
}) {
  const cardRefs = useRef(new Map<string, HTMLElement>())

  const measureAnchor = useCallback(() => {
    if (!selectedId) {
      onSelectedAnchorChange(null)
      return
    }
    const el = cardRefs.current.get(selectedId)
    if (!el) {
      onSelectedAnchorChange(null)
      return
    }
    const rect = el.getBoundingClientRect()
    onSelectedAnchorChange({
      x: rect.left + rect.width / 2,
      y: rect.top + 8,
    })
  }, [selectedId, onSelectedAnchorChange])

  useEffect(() => {
    measureAnchor()
    const timer = window.setTimeout(measureAnchor, 220)
    window.addEventListener('resize', measureAnchor)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', measureAnchor)
    }
  }, [measureAnchor, hand.length])

  // Expose rect measurement callback for defeat flight
  const setCardNode = (instanceId: string) => (node: HTMLElement | null) => {
    if (node) {
      cardRefs.current.set(instanceId, node)
    } else {
      cardRefs.current.delete(instanceId)
    }
  }

  // Trigger measurement when defeatingIds adds an item
  const prevDefeatingRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const id of defeatingIds) {
      if (!prevDefeatingRef.current.has(id)) {
        const el = cardRefs.current.get(id)
        onMeasureCardRect(id, el ? el.getBoundingClientRect() : null)
      }
    }
    prevDefeatingRef.current = new Set(defeatingIds)
  }, [defeatingIds, onMeasureCardRect])

  const selectedCard = selectedId ? hand.find(item => item.instanceId === selectedId) ?? null : null
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (hand.length === 0) return null

  const mid = (hand.length - 1) / 2

  return (
    <div className="enemy-hand-dock" aria-label="敌人手牌区">
      {/* 选中手牌后的上方动作条 */}
      {selectedCard && (
        <div className="enemy-action-bar" role="region" aria-label="攻击确认栏">
          <div className="enemy-action-bar__info">
            <span className="enemy-action-attacker">
              <b>{selectedCard.name}</b>
              <small>{formatSignedModifier(selectedCard.attackModifier)} · {selectedCard.damageFormula}</small>
            </span>
            <span className="enemy-action-arrow" aria-hidden="true">➔</span>
            {targetCharacter ? (
              <span className="enemy-action-target is-locked">
                <b>{targetCharacter.name}</b>
                <small>闪避 {targetCharacter.evasion ?? '未填'}</small>
              </span>
            ) : (
              <span className="enemy-action-target">
                请点击上方玩家角色卡选择目标
              </span>
            )}
          </div>

          <div className="enemy-action-bar__controls">
            <div className="enemy-adv-toggle" role="group" aria-label="攻击掷骰优劣势">
              {([
                ['normal', '常'],
                ['advantage', '优'],
                ['disadvantage', '劣'],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={advantage === mode ? 'active' : ''}
                  disabled={attacking}
                  onClick={() => onChangeAdvantage(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`btn-confirm-attack ${targetCharacter ? 'is-ready' : ''}`}
              disabled={!ready || !targetCharacter || attacking}
              onClick={onConfirmAttack}
            >
              {attacking ? '掷骰结算中…' : '确定攻击'}
            </button>
            <button type="button" className="btn-cancel-attack" disabled={attacking} onClick={onCancel}>
              取消
            </button>
          </div>
        </div>
      )}

        <div
          className="enemy-hand-fan"
          style={{ ['--hand-count' as string]: Math.max(2, hand.length) }}
          onScroll={measureAnchor}
        >
          {hand.map((card, index) => {
            const isSelected = card.instanceId === selectedId
            const isDefeating = defeatingIds.has(card.instanceId)
            const isHovered = card.instanceId === hoveredId
            const offsetFromMid = index - mid
            const angle = isSelected ? 0 : Math.max(-10, Math.min(10, offsetFromMid * 2.4))
            const archY = isSelected ? 0 : Math.min(18, Math.pow(offsetFromMid, 2) * 2.4)
            const zIndex = isSelected ? 40 : isHovered ? 30 : 10 + index
            const hpPct = Math.round(((card.hpMax - card.hpMarked) / card.hpMax) * 100)

            return (
              <article
                key={card.instanceId}
                ref={setCardNode(card.instanceId)}
                className={[
                  'enemy-hand-card',
                  isSelected ? 'is-selected' : '',
                  isHovered ? 'is-hovered' : '',
                  isDefeating ? 'is-defeating' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  zIndex,
                  ['--fan-rot' as string]: `${angle}deg`,
                  ['--fan-arch' as string]: `${archY}px`,
                }}
                onMouseEnter={() => setHoveredId(card.instanceId)}
                onMouseLeave={() => setHoveredId(curr => (curr === card.instanceId ? null : curr))}
                onPointerEnter={() => {
                  if (isSelected) onPointerInsideSelectedChange(true)
                }}
                onPointerLeave={() => {
                  if (isSelected) onPointerInsideSelectedChange(false)
                }}
                onTransitionEnd={() => {
                  if (isSelected) measureAnchor()
                }}
                onClick={event => {
                  event.stopPropagation()
                  if (isDefeating) return
                  if (!isSelected) {
                    onPointerInsideSelectedChange(true)
                    onSelectCard(card.instanceId)
                  }
                }}
              >
                {/* 头部：名字与简要血条 */}
                <header
                  className="enemy-card-head"
                  onClick={event => {
                    if (isSelected) {
                      event.stopPropagation()
                      onSelectCard(null)
                    }
                  }}
                  title={isSelected ? '点击头部收回卡牌' : '单击弹出并准备攻击'}
                >
                  <div className="enemy-card-title-wrap">
                    <span className="enemy-card-name">{card.name}</span>
                    <span className="enemy-card-mini-hp" aria-label={`剩余生命 ${card.hpMax - card.hpMarked} / ${card.hpMax}`}>
                      {card.hpMax - card.hpMarked}/{card.hpMax}
                    </span>
                  </div>
                  <div className="enemy-card-hp-strip" aria-hidden="true">
                    <span style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }} />
                  </div>
                </header>

                {/* 中部：默认与选中时均展示攻击加值、伤害阈值、伤害骰、难度 */}
                <div className="enemy-card-combat-stats">
                  <div className="enemy-stat-cell">
                    <span>命中加值</span>
                    <b>{formatSignedModifier(card.attackModifier)}</b>
                  </div>
                  <div className="enemy-stat-cell">
                    <span>伤害骰</span>
                    <b>{card.damageFormula}</b>
                  </div>
                  <div className="enemy-stat-cell">
                    <span>阈值(重/严)</span>
                    <b>{card.majorThreshold} / {card.severeThreshold}</b>
                  </div>
                  <div className="enemy-stat-cell">
                    <span>难度</span>
                    <b>{card.difficulty}</b>
                  </div>
                </div>

                {/* 底部：单击向上弹出固定后显露生命、压力标记区 */}
                <div
                  className="enemy-card-tracks"
                  onClick={event => event.stopPropagation()}
                >
                  <div className="enemy-track-row">
                    <div className="enemy-track-label">
                      <span>生命</span>
                      <b>{card.hpMarked}/{card.hpMax}</b>
                    </div>
                    <div className="enemy-track-pips">
                      {trackSlots(card.hpMax, card.hpMarked).map((filled, slotIdx) => (
                        <button
                          key={slotIdx}
                          type="button"
                          className={`enemy-pip enemy-pip--hp ${filled ? 'filled' : ''}`}
                          disabled={isDefeating}
                          aria-label={`生命第 ${slotIdx + 1} 格，当前${filled ? '已标记' : '未标记'}`}
                          onClick={() => {
                            const next = filled && slotIdx + 1 === card.hpMarked ? slotIdx : slotIdx + 1
                            onUpdateMark(card.instanceId, 'hp', next)
                          }}
                        />
                      ))}
                    </div>
                    <div className="enemy-track-step">
                      <button
                        type="button"
                        disabled={isDefeating || card.hpMarked <= 0}
                        aria-label="减少标记生命"
                        onClick={() => onUpdateMark(card.instanceId, 'hp', card.hpMarked - 1)}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        disabled={isDefeating || card.hpMarked >= card.hpMax}
                        aria-label="增加标记生命"
                        onClick={() => onUpdateMark(card.instanceId, 'hp', card.hpMarked + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {card.stressMax > 0 && (
                    <div className="enemy-track-row">
                      <div className="enemy-track-label">
                        <span>压力</span>
                        <b>{card.stressMarked}/{card.stressMax}</b>
                      </div>
                      <div className="enemy-track-pips">
                        {trackSlots(card.stressMax, card.stressMarked).map((filled, slotIdx) => (
                          <button
                            key={slotIdx}
                            type="button"
                            className={`enemy-pip enemy-pip--stress ${filled ? 'filled' : ''}`}
                            disabled={isDefeating}
                            aria-label={`压力第 ${slotIdx + 1} 格，当前${filled ? '已标记' : '未标记'}`}
                            onClick={() => {
                              const next = filled && slotIdx + 1 === card.stressMarked ? slotIdx : slotIdx + 1
                              onUpdateMark(card.instanceId, 'stress', next)
                            }}
                          />
                        ))}
                      </div>
                      <div className="enemy-track-step">
                        <button
                          type="button"
                          disabled={isDefeating || card.stressMarked <= 0}
                          aria-label="减少标记压力"
                          onClick={() => onUpdateMark(card.instanceId, 'stress', card.stressMarked - 1)}
                        >
                          −
                        </button>
                        <button
                          type="button"
                          disabled={isDefeating || card.stressMarked >= card.stressMax}
                          aria-label="增加标记压力"
                          onClick={() => onUpdateMark(card.instanceId, 'stress', card.stressMarked + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="enemy-card-footer">
                    <button
                      type="button"
                      className="enemy-card-remove"
                      disabled={isDefeating}
                      onClick={() => onRemoveCard(card.instanceId)}
                    >
                      移出手牌
                    </button>
                  </div>
                </div>

                {isDefeating && (
                  <div className="enemy-defeated-stamp" aria-hidden="true">已击败</div>
                )}
              </article>
            )
          })}
        </div>
    </div>
  )
}
