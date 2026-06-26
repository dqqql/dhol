import { useMemo, useState, type CSSProperties } from 'react'
import type {
  DiceModifierMode,
  DicePoolEntry,
  DiceRollRecord,
  DiceRollRequest,
  DiceRollResult,
} from '@dhgc/shared'
import { Dices, History, Minus, Plus, RotateCcw, Sparkles, UserRound } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '@/store/useStore'

const DICE_SIDES = [4, 6, 8, 10, 12, 20] as const
const DICE_GROUP_PRESETS = [
  { label: 'd20', formula: '1d20' },
  { label: '2d6', formula: '2d6' },
  { label: '3d6', formula: '3d6' },
  { label: '2d12+2', formula: '2d12 + 2' },
] as const

type DiceCounts = Record<number, number>
type RollTone = 'standard' | 'hope' | 'fear' | 'critical'
type DieTone = 'neutral' | 'hope' | 'fear' | 'advantage' | 'disadvantage'

const EMPTY_COUNTS: DiceCounts = Object.fromEntries(DICE_SIDES.map((sides) => [sides, 0]))

export function FloatingDicePanel() {
  const { room, rollDice } = useStore()
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'standard' | 'dual'>('standard')
  const [counts, setCounts] = useState<DiceCounts>({ ...EMPTY_COUNTS, 20: 1 })
  const [modifier, setModifier] = useState(0)
  const [modifierMode, setModifierMode] = useState<DiceModifierMode>('normal')
  const [diceGroupFormula, setDiceGroupFormula] = useState('1d20')
  const [diceGroupError, setDiceGroupError] = useState('')

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
    setDiceGroupFormula('1d20')
    setDiceGroupError('')
  }

  function submitRoll() {
    if (!canRoll) return
    rollDice(request)
  }

  function applyDiceGroup(formula = diceGroupFormula) {
    try {
      const parsed = parseDiceGroupFormula(formula)
      setMode('standard')
      setCounts(parsed.counts)
      setModifier(parsed.modifier)
      setModifierMode('normal')
      setDiceGroupFormula(parsed.normalized)
      setDiceGroupError('')
    } catch (error) {
      setDiceGroupError(error instanceof Error ? error.message : '骰组格式无效')
    }
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

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="掷骰面板" maxWidth={1152}>
        <div className="dice-panel dice-panel--ritual">
          <section className="dice-builder dice-light-card" aria-label="骰盘">
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
                      <strong className="dice-token__count">{count}</strong>
                    </button>
                  )
                })}
              </div>
            </div>

            {mode === 'standard' && (
              <div className="dice-group-box">
                <div className="dice-field-label">
                  <span>骰组</span>
                  <span>例：2d6 + d8 + 3</span>
                </div>
                <div className="dice-group-input-row">
                  <input
                    className="dice-group-input"
                    value={diceGroupFormula}
                    onChange={(event) => {
                      setDiceGroupFormula(event.target.value)
                      if (diceGroupError) setDiceGroupError('')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') applyDiceGroup()
                    }}
                    aria-label="骰组公式"
                    placeholder="2d6 + d8 + 3"
                  />
                  <button type="button" className="dice-group-apply" onClick={() => applyDiceGroup()}>
                    应用
                  </button>
                </div>
                <div className="dice-group-presets" aria-label="骰组快捷项">
                  {DICE_GROUP_PRESETS.map((preset) => (
                    <button
                      key={preset.formula}
                      type="button"
                      onClick={() => applyDiceGroup(preset.formula)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {diceGroupError && <div className="dice-group-error">{diceGroupError}</div>}
              </div>
            )}

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

          <LatestRollStage roll={latestRoll} />

          <RollHistory rolls={history} />
        </div>
      </Modal>
    </>
  )
}

function DiceIcon({ sides }: { sides: number }) {
  const label = `d${sides}`

  return (
    <svg className="dice-token__icon" viewBox="0 0 80 80" aria-hidden="true">
      {sides === 4 && (
        <>
          <polygon className="dice-token__face" points="40,5 75,70 5,70" />
          <path className="dice-token__detail" d="M40 5L22 70M40 5l18 65M12 58h56M22 70l18-30 18 30" />
        </>
      )}
      {sides === 6 && (
        <>
          <polygon className="dice-token__face" points="40,6 72,24 72,58 40,74 8,58 8,24" />
          <path className="dice-token__detail" d="M8 24l32 18 32-18M40 42v32M8 58l32-16 32 16M40 6v36" />
        </>
      )}
      {sides === 8 && (
        <>
          <polygon className="dice-token__face" points="40,4 74,40 40,76 6,40" />
          <path className="dice-token__detail" d="M40 4v72M6 40h68M6 40l34-20 34 20M6 40l34 20 34-20M22 40l18-36 18 36M22 40l18 36 18-36" />
        </>
      )}
      {sides === 10 && (
        <>
          <polygon className="dice-token__face" points="40,4 68,18 76,52 58,74 22,74 4,52 12,18" />
          <path className="dice-token__detail" d="M40 4L22 38 12 18M40 4l18 34 10-20M4 52l18-14 18 36 18-36 18 14M22 74l18-36 18 36M22 38h36" />
        </>
      )}
      {sides === 12 && (
        <>
          <polygon className="dice-token__face" points="28,5 52,5 72,20 78,44 66,68 40,77 14,68 2,44 8,20" />
          <polygon className="dice-token__detail dice-token__detail--closed" points="40,16 59,30 52,54 28,54 21,30" />
          <path className="dice-token__detail" d="M28 5l12 11L52 5M8 20l13 10L2 44M78 44L59 30l13-10M14 68l14-14 12 23 12-23 14 14M21 30l19-14 19 14M28 54l-26-10M52 54l26-10M28 54L14 68M52 54l14 14" />
        </>
      )}
      {sides === 20 && (
        <>
          <polygon className="dice-token__face" points="40,4 69,17 78,48 60,72 22,75 2,50 11,18" />
          <path className="dice-token__detail" d="M40 4L25 28 11 18M40 4l15 25 14-12M2 50l23-22h30l23 20M2 50l20 25 18-20 20 17 18-24M25 28l15 27 15-26M11 18l14 10-23 22M69 17L55 29l23 19M22 75l18-20 20 17M25 28l-3 47M55 29l5 43" />
        </>
      )}
      <text className="dice-token__number" x="40" y="42">{label}</text>
    </svg>
  )
}

function LatestRollStage({ roll }: { roll?: DiceRollRecord }) {
  if (!roll) {
    return (
      <section className="dice-stage dice-stage--empty dice-result-card">
        <div className="dice-stage__sigil"><Dices size={30} /></div>
        <div>
          <div className="dice-stage__eyebrow">WAITING</div>
          <h3>等待掷骰</h3>
          <p>选择骰池后，最新结果会在这里展开。</p>
        </div>
      </section>
    )
  }

  const primary = roll.results[0]
  const tone = getRollTone(primary)
  const outcomeLabel = getOutcomeLabel(primary)

  return (
    <section key={roll.id} className={`dice-stage dice-stage--${tone} dice-result-card`} aria-live="polite">
      <OutcomeBackdrop tone={tone} />
      <div className="dice-stage__header">
        <div>
          <div className="dice-stage__eyebrow">最新掷骰结果</div>
          <div className="dice-stage__owner">
            <UserRound size={14} />
            <span>{roll.actor_name}</span>
          </div>
          <div className="dice-stage__formula">{roll.normalized_formula}</div>
        </div>
        <div className={`dice-outcome-badge dice-outcome-badge--${tone}`}>
          {primary.critical && <Sparkles size={14} />}
          {outcomeLabel}
        </div>
      </div>

      <div className="dice-stage__result">
        {primary.hope !== undefined && primary.fear !== undefined ? (
          <DualityRollResult result={primary} modifier={roll.request.modifier} modifierMode={roll.request.modifier_mode} />
        ) : (
          <StandardRollResult result={primary} />
        )}
      </div>

      <div className="dice-stage__details">
        {formatResultDetails(primary, roll.request.modifier)}
      </div>
    </section>
  )
}

function DualityRollResult(props: {
  result: DiceRollResult
  modifier: number
  modifierMode: DiceModifierMode
}) {
  const { result, modifier, modifierMode } = props
  const advantageTone: DieTone = modifierMode === 'advantage' ? 'advantage' : 'disadvantage'

  return (
    <div className="duality-result-shell">
      <div className="duality-result">
        <AnimatedDie value={result.hope ?? 0} sides={12} tone="hope" label="希望" critical={result.critical} />
        <AnimatedDie value={result.fear ?? 0} sides={12} tone="fear" label="恐惧" critical={result.critical} />
        {result.advantage_roll !== undefined && (
          <AnimatedDie
            value={result.advantage_roll}
            sides={6}
            tone={advantageTone}
            label={modifierMode === 'advantage' ? '优势' : '劣势'}
            size="small"
          />
        )}
      </div>
      <ResultBanner result={result} modifier={modifier} />
    </div>
  )
}

function StandardRollResult({ result }: { result: DiceRollResult }) {
  const dice = result.terms.flatMap((term) => (
    term.rolls.map((value, index) => ({
      key: `${term.sides}-${index}-${value}`,
      sides: term.sides,
      value,
    }))
  ))

  return (
    <div className="standard-result-shell">
      <div className="standard-result-dice">
        {dice.map((die) => (
          <AnimatedDie key={die.key} value={die.value} sides={die.sides} tone="neutral" />
        ))}
      </div>
      <div className="standard-result-total">
        <span>总点数</span>
        <strong>{result.total}</strong>
      </div>
    </div>
  )
}

function ResultBanner({ result, modifier }: { result: DiceRollResult, modifier: number }) {
  const tone = getRollTone(result)
  const details: string[] = []
  if (result.hope !== undefined) details.push(String(result.hope))
  if (result.fear !== undefined) details.push(String(result.fear))
  if (result.advantage_roll !== undefined) details.push(`${result.advantage_roll > 0 ? '+' : ''}${result.advantage_roll}`)
  if (modifier !== 0) details.push(`${modifier > 0 ? '+' : ''}${modifier}`)

  return (
    <div className={`roll-result__banner roll-result__banner--${tone}`}>
      <h3>{getOutcomeLabel(result)}</h3>
      <div className="roll-result__line" />
      <span>总点数</span>
      <strong>{result.total}</strong>
      {details.length > 0 && <small>({details.join(' + ')})</small>}
    </div>
  )
}

function AnimatedDie(props: {
  value: number
  sides: number
  tone?: DieTone
  label?: string
  critical?: boolean
  size?: 'small' | 'normal'
}) {
  const { value, sides, tone = 'neutral', label, critical = false, size = 'normal' } = props
  return (
    <div className={`animated-die animated-die--${tone} ${critical ? 'is-critical' : ''} animated-die--${size}`}>
      <div className="animated-die__face" title={`d${sides}`}>
        <span className="animated-die__tooltip">d{sides}</span>
        <strong>{value}</strong>
      </div>
      {label && <span className="animated-die__label">{label}</span>}
    </div>
  )
}

function OutcomeBackdrop({ tone }: { tone: RollTone }) {
  if (tone === 'hope') {
    return (
      <div className="outcome-backdrop outcome-backdrop--hope" aria-hidden="true">
        <span className="outcome-backdrop__hope-rays" />
        <span className="outcome-backdrop__hope-ring" />
        {Array.from({ length: 14 }).map((_, index) => (
          <span
            key={index}
            className="outcome-mote"
            style={{
              '--mote-x': `${10 + (index * 31) % 80}%`,
              '--mote-delay': `${(index % 7) * 0.11}s`,
              '--mote-duration': `${1.15 + (index % 5) * 0.13}s`,
            } as CSSProperties}
          />
        ))}
      </div>
    )
  }

  if (tone === 'fear') {
    return (
      <div className="outcome-backdrop outcome-backdrop--fear" aria-hidden="true">
        <span className="outcome-backdrop__fear-vignette" />
        <span className="outcome-backdrop__ink outcome-backdrop__ink--one" />
        <span className="outcome-backdrop__ink outcome-backdrop__ink--two" />
        <span className="outcome-backdrop__ink outcome-backdrop__ink--three" />
        <span className="outcome-backdrop__fear-ripple" />
      </div>
    )
  }

  if (tone === 'critical') {
    return (
      <div className="outcome-backdrop outcome-backdrop--crit" aria-hidden="true">
        <span className="outcome-backdrop__crit-rays" />
        <span className="outcome-backdrop__crit-ring outcome-backdrop__crit-ring--one" />
        <span className="outcome-backdrop__crit-ring outcome-backdrop__crit-ring--two" />
      </div>
    )
  }

  return <div className="outcome-backdrop outcome-backdrop--standard" aria-hidden="true" />
}

function RollHistory({ rolls }: { rolls: DiceRollRecord[] }) {
  return (
    <section className="dice-history dice-light-card">
      <div className="dice-section-heading">
        <div>
          <div className="dice-section-heading__eyebrow">ROOM HISTORY</div>
          <h3>掷骰记录</h3>
        </div>
        <History size={18} />
      </div>

      <div className="dice-history__list">
        {rolls.length === 0 ? (
          <div className="dice-history__empty">尚无掷骰记录。</div>
        ) : rolls.map((roll) => {
          const primary = roll.results[0]
          const tone = getRollTone(primary)
          return (
            <article key={roll.id} className={`dice-history-item dice-history-item--${tone}`}>
              <div className="dice-history-item__top">
                <span className="dice-history-item__actor">
                  <UserRound size={12} />
                  <strong>{roll.actor_name}</strong>
                </span>
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

function getRollTone(result: DiceRollResult): RollTone {
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

function parseDiceGroupFormula(formula: string): {
  counts: DiceCounts
  modifier: number
  normalized: string
} {
  const cleaned = formula
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, '-')
    .replace(/\s+/g, '')

  if (!cleaned) throw new Error('请输入骰组公式')

  const pattern = /([+-]?)(?:(\d*)d(\d+)|(\d+))/gy
  const allowedSides = new Set<number>(DICE_SIDES)
  const totals = new Map<number, number>()
  let modifier = 0
  let cursor = 0
  let totalDice = 0

  while (cursor < cleaned.length) {
    pattern.lastIndex = cursor
    const match = pattern.exec(cleaned)
    if (!match || match.index !== cursor) {
      throw new Error('公式格式无效，请使用如 2d6 + d8 + 3')
    }

    const [token, sign, countText, sidesText, modifierText] = match
    if (cursor > 0 && !sign) throw new Error('骰组各项之间需要使用 + 或 -')

    if (sidesText) {
      if (sign === '-') throw new Error('暂不支持从结果中减去骰子')
      const count = countText ? Number(countText) : 1
      const sides = Number(sidesText)

      if (!Number.isInteger(count) || count < 1 || count > 20) {
        throw new Error('每种骰子的数量需为 1 到 20')
      }
      if (!allowedSides.has(sides)) {
        throw new Error(`当前骰组仅支持 d${DICE_SIDES.join('、d')}`)
      }

      totalDice += count
      if (totalDice > 60) throw new Error('单个骰组最多包含 60 颗骰子')
      totals.set(sides, (totals.get(sides) ?? 0) + count)
    } else {
      const value = Number(modifierText)
      modifier += sign === '-' ? -value : value
      if (Math.abs(modifier) > 100000) throw new Error('固定加值范围需在 -100000 到 +100000 之间')
    }

    cursor += token.length
  }

  if (totals.size === 0) throw new Error('公式中至少需要一颗骰子')

  const counts = { ...EMPTY_COUNTS }
  for (const [sides, count] of totals.entries()) {
    counts[sides] = Math.min(100, count)
  }

  const diceText = DICE_SIDES
    .map((sides) => {
      const count = counts[sides] ?? 0
      return count > 0 ? `${count}d${sides}` : ''
    })
    .filter(Boolean)
    .join(' + ')
  const modifierText = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : ''

  return {
    counts,
    modifier,
    normalized: `${diceText}${modifierText}`,
  }
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
