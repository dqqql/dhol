import { useMemo, useState } from 'react'
import type {
  DiceModifierMode,
  DicePoolEntry,
  DiceRollRecord,
  DiceRollRequest,
  DiceRollResult,
} from '@dhgc/shared'
import { Dices, History, Minus, Plus, RotateCcw, Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '@/store/useStore'

const DICE_SIDES = [4, 6, 8, 10, 12, 20] as const

type DiceCounts = Record<number, number>

const EMPTY_COUNTS: DiceCounts = Object.fromEntries(DICE_SIDES.map((sides) => [sides, 0]))

export function FloatingDicePanel() {
  const { room, rollDice } = useStore()
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'standard' | 'dual'>('standard')
  const [counts, setCounts] = useState<DiceCounts>({ ...EMPTY_COUNTS, 20: 1 })
  const [modifier, setModifier] = useState(0)
  const [modifierMode, setModifierMode] = useState<DiceModifierMode>('normal')

  const dice = useMemo<DicePoolEntry[]>(() => (
    DICE_SIDES
      .map((sides) => ({ sides, count: counts[sides] ?? 0 }))
      .filter((entry) => entry.count > 0)
  ), [counts])

  const canUseAdvantage = mode === 'dual'
    || (dice.length === 1 && dice[0].sides === 20 && dice[0].count === 1)
  const effectiveModifierMode = canUseAdvantage ? modifierMode : 'normal'
  const request: DiceRollRequest = {
    mode,
    modifier_mode: effectiveModifierMode,
    repeat: 1,
    modifier,
    dice,
  }
  const canRoll = mode === 'dual' || dice.length > 0
  const roomRolls = Array.isArray(room?.dice_rolls) ? room.dice_rolls : []
  const latestRoll = roomRolls.at(-1)
  const history = roomRolls.slice().reverse()

  function changeDie(sides: number, delta: number) {
    const nextCounts = {
      ...counts,
      [sides]: Math.max(0, Math.min(100, (counts[sides] ?? 0) + delta)),
    }
    setCounts(nextCounts)

    if (mode === 'standard') {
      const selected = DICE_SIDES
        .map((dieSides) => ({ sides: dieSides, count: nextCounts[dieSides] ?? 0 }))
        .filter((entry) => entry.count > 0)
      const remainsSingleD20 = selected.length === 1 && selected[0].sides === 20 && selected[0].count === 1
      if (!remainsSingleD20) setModifierMode('normal')
    }
  }

  function changeMode(nextMode: 'standard' | 'dual') {
    setMode(nextMode)
    setModifierMode('normal')
    if (nextMode === 'dual') {
      setCounts({ ...EMPTY_COUNTS })
    } else if (!Object.values(counts).some(Boolean)) {
      setCounts({ ...EMPTY_COUNTS, 20: 1 })
    }
  }

  function resetPool() {
    setCounts(mode === 'standard' ? { ...EMPTY_COUNTS, 20: 1 } : { ...EMPTY_COUNTS })
    setModifier(0)
    setModifierMode('normal')
  }

  function submitRoll() {
    if (!canRoll) return
    rollDice(request)
  }

  return (
    <>
      <button
        type="button"
        className="gm-floating-tool gm-floating-tool--dice"
        onClick={() => setIsOpen(true)}
      >
        <Dices size={17} />
        掷骰
      </button>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="掷骰台" maxWidth={1180}>
        <div className="dice-panel">
          <LatestRollStage roll={latestRoll} />

          <div className="dice-panel__workspace">
            <section className="dice-builder" aria-label="骰盘">
              <div className="dice-section-heading">
                <div>
                  <div className="dice-section-heading__eyebrow">ROLL SETUP</div>
                  <h3>准备骰池</h3>
                </div>
                <button type="button" className="dice-reset" onClick={resetPool}>
                  <RotateCcw size={14} /> 重置
                </button>
              </div>

              <div className="dice-mode-switch" aria-label="掷骰模式">
                <button
                  type="button"
                  className={mode === 'standard' ? 'is-active' : ''}
                  onClick={() => changeMode('standard')}
                >
                  普通骰池
                  <span>所选骰子相加</span>
                </button>
                <button
                  type="button"
                  className={mode === 'dual' ? 'is-active is-dual' : ''}
                  onClick={() => changeMode('dual')}
                >
                  匕首之心
                  <span>希望 d12 + 恐惧 d12</span>
                </button>
              </div>

              <div>
                <div className="dice-field-label">
                  <span>{mode === 'dual' ? '附加骰' : '骰盘'}</span>
                  <span>左键增加，右键减少</span>
                </div>
                <div className="dice-tray">
                  {DICE_SIDES.map((sides) => {
                    const count = counts[sides] ?? 0
                    return (
                      <button
                        key={sides}
                        type="button"
                        className={`dice-token ${count ? 'is-selected' : ''}`}
                        onClick={() => changeDie(sides, 1)}
                        onContextMenu={(event) => {
                          event.preventDefault()
                          changeDie(sides, -1)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Backspace' || event.key === 'Delete' || event.key === 'ArrowDown') {
                            event.preventDefault()
                            changeDie(sides, -1)
                          }
                        }}
                        aria-label={`d${sides}，当前 ${count} 枚。左键增加，右键减少`}
                      >
                        <DiceIcon sides={sides} />
                        {count > 0 && <strong className="dice-token__count">{count}</strong>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="dice-control-row">
                <Stepper
                  label="固定加值"
                  value={modifier}
                  onChange={setModifier}
                  min={-100000}
                  max={100000}
                  format={(value) => value > 0 ? `+${value}` : String(value)}
                />
                <div className="dice-advantage-switch">
                  <AdvantageButton mode="normal" value={effectiveModifierMode} disabled={false} onChange={setModifierMode}>
                    常规
                  </AdvantageButton>
                  <AdvantageButton mode="advantage" value={effectiveModifierMode} disabled={!canUseAdvantage} onChange={setModifierMode}>
                    优势
                  </AdvantageButton>
                  <AdvantageButton mode="disadvantage" value={effectiveModifierMode} disabled={!canUseAdvantage} onChange={setModifierMode}>
                    劣势
                  </AdvantageButton>
                </div>
              </div>

              <button type="button" className="dice-roll-button" disabled={!canRoll} onClick={submitRoll}>
                <Dices size={20} />
                掷出骰子
              </button>
            </section>

            <RollHistory rolls={history} />
          </div>
        </div>
      </Modal>
    </>
  )
}

function DiceIcon({ sides }: { sides: number }) {
  const label = `d${sides}`
  const textClass = 'dice-token__number'

  return (
    <svg className="dice-token__icon" viewBox="0 0 80 80" aria-hidden="true">
      {sides === 4 && (
        <>
          <polygon className="dice-token__face" points="40,6 74,70 6,70" />
          <path className="dice-token__detail" d="M40 6v45M6 70l34-19 34 19" />
        </>
      )}
      {sides === 6 && (
        <>
          <polygon className="dice-token__face" points="40,5 71,22 71,58 40,75 9,58 9,22" />
          <path className="dice-token__detail" d="M9 22l31 18 31-18M40 40v35" />
        </>
      )}
      {sides === 8 && (
        <>
          <polygon className="dice-token__face" points="40,4 74,40 40,76 6,40" />
          <path className="dice-token__detail" d="M40 4v72M6 40h68M6 40l34-18 34 18M6 40l34 18 34-18" />
        </>
      )}
      {sides === 10 && (
        <>
          <polygon className="dice-token__face" points="40,4 70,22 75,52 56,75 24,75 5,52 10,22" />
          <path className="dice-token__detail" d="M40 4L25 43l-15-21M40 4l15 39 15-21M5 52l20-9 15 32 15-32 20 9" />
        </>
      )}
      {sides === 12 && (
        <>
          <polygon className="dice-token__face" points="28,5 52,5 72,20 78,44 66,68 40,77 14,68 2,44 8,20" />
          <polygon className="dice-token__detail dice-token__detail--closed" points="40,18 58,31 51,53 29,53 22,31" />
          <path className="dice-token__detail" d="M28 5l12 13L52 5M8 20l14 11L2 44M78 44L58 31l14-11M14 68l15-15 11 24 11-24 15 15" />
        </>
      )}
      {sides === 20 && (
        <>
          <polygon className="dice-token__face" points="40,3 70,18 78,49 58,75 22,75 2,49 10,18" />
          <path className="dice-token__detail" d="M40 3L25 29 10 18M40 3l15 26 15-11M2 49l23-20h30l23 20M2 49l20 26 18-20 18 20 20-26M25 29l15 26 15-26" />
        </>
      )}
      <text className={textClass} x="40" y="42">{label}</text>
    </svg>
  )
}

function LatestRollStage({ roll }: { roll?: DiceRollRecord }) {
  if (!roll) {
    return (
      <section className="dice-stage dice-stage--empty">
        <div className="dice-stage__sigil"><Dices size={30} /></div>
        <div>
          <div className="dice-stage__eyebrow">LAST ROLL</div>
          <h3>骰声尚未响起</h3>
          <p>从下方骰盘选择骰子，第一次结果会在这里成为全场焦点。</p>
        </div>
      </section>
    )
  }

  const primary = roll.results[0]
  const tone = getRollTone(primary)
  const outcomeLabel = getOutcomeLabel(primary)

  return (
    <section key={roll.id} className={`dice-stage dice-stage--${tone}`} aria-live="polite">
      <div className="dice-stage__aurora" />
      <div className="dice-stage__header">
        <div>
          <div className="dice-stage__eyebrow">LAST ROLL · {roll.actor_name}</div>
          <div className="dice-stage__formula">{roll.normalized_formula}</div>
        </div>
        <div className={`dice-outcome-badge dice-outcome-badge--${tone}`}>
          {primary.critical && <Sparkles size={14} />}
          {outcomeLabel}
        </div>
      </div>

      <div className="dice-stage__result">
        <div className="dice-stage__total">{primary.total}</div>

        {primary.hope !== undefined && primary.fear !== undefined && (
          <div className="duality-result">
            <div className="duality-die duality-die--hope">
              <span>希望</span>
              <strong>{primary.hope}</strong>
            </div>
            <div className="duality-result__divider">+</div>
            <div className="duality-die duality-die--fear">
              <span>恐惧</span>
              <strong>{primary.fear}</strong>
            </div>
          </div>
        )}
      </div>

      <div className="dice-stage__details">
        {formatResultDetails(primary, roll.request.modifier)}
      </div>
    </section>
  )
}

function RollHistory({ rolls }: { rolls: DiceRollRecord[] }) {
  return (
    <section className="dice-history">
      <div className="dice-section-heading">
        <div>
          <div className="dice-section-heading__eyebrow">ROOM HISTORY</div>
          <h3>掷骰历史</h3>
        </div>
        <History size={18} />
      </div>

      <div className="dice-history__list">
        {rolls.length === 0 ? (
          <div className="dice-history__empty">房间中还没有掷骰记录。</div>
        ) : rolls.map((roll) => {
          const primary = roll.results[0]
          const tone = getRollTone(primary)
          return (
            <article key={roll.id} className={`dice-history-item dice-history-item--${tone}`}>
              <div className="dice-history-item__top">
                <strong>{roll.actor_name}</strong>
                <time>{formatTime(roll.created_at)}</time>
              </div>
              <div className="dice-history-item__formula">{roll.normalized_formula}</div>
              <div className="dice-history-item__result">
                <span>{getOutcomeLabel(primary)}</span>
                <strong>{roll.results.map((result) => result.total).join(' · ')}</strong>
              </div>
              {primary.hope !== undefined && primary.fear !== undefined && (
                <div className="dice-history-item__duality">
                  希望 {primary.hope} / 恐惧 {primary.fear}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function Stepper(props: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  format?: (value: number) => string
}) {
  const { label, value, onChange, min, max, format = String } = props
  return (
    <div className="dice-stepper">
      <span>{label}</span>
      <div>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`${label}减一`}>
          <Minus size={15} />
        </button>
        <strong>{format(value)}</strong>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`${label}加一`}>
          <Plus size={15} />
        </button>
      </div>
    </div>
  )
}

function AdvantageButton(props: {
  mode: DiceModifierMode
  value: DiceModifierMode
  disabled: boolean
  onChange: (mode: DiceModifierMode) => void
  children: string
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      className={props.value === props.mode ? 'is-active' : ''}
      onClick={() => props.onChange(props.mode)}
    >
      {props.children}
    </button>
  )
}

function getRollTone(result: DiceRollResult) {
  if (result.critical) return 'critical'
  if (result.outcome === 'hope') return 'hope'
  if (result.outcome === 'fear') return 'fear'
  return 'standard'
}

function getOutcomeLabel(result: DiceRollResult) {
  if (result.critical) return '关键成功'
  if (result.outcome === 'hope') return '希望结果'
  if (result.outcome === 'fear') return '恐惧结果'
  return '掷骰结果'
}

function formatResultDetails(result: DiceRollResult, modifier: number) {
  const parts: string[] = []

  if (result.kept_primary !== undefined) {
    parts.push(`d20 [${result.primary_rolls.join(', ')}] 取 ${result.kept_primary}`)
  } else if (result.hope !== undefined && result.fear !== undefined) {
    parts.push(`希望 ${result.hope} + 恐惧 ${result.fear}`)
  } else {
    parts.push(...result.terms.map((term) => `${term.notation} [${term.rolls.join(', ')}]`))
  }

  if (result.advantage_roll !== undefined) {
    parts.push(`优劣势 d6：${result.advantage_roll}`)
  }
  if (result.hope !== undefined && result.terms.length) {
    parts.push(...result.terms.map((term) => `${term.notation} [${term.rolls.join(', ')}]`))
  }
  if (modifier !== 0) {
    parts.push(`固定加值 ${modifier > 0 ? '+' : ''}${modifier}`)
  }

  return parts.join(' · ')
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
