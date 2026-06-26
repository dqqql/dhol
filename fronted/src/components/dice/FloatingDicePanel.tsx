import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import type {
  DiceModifierMode,
  DicePoolEntry,
  DiceRollRecord,
  DiceRollRequest,
  DiceRollResult,
} from '@dhgc/shared'
import { Dices, History, Minus, Plus, RotateCcw, Sparkles, Trash2, UserRound, X } from 'lucide-react'
import { useStore } from '@/store/useStore'

const DICE_SIDES = [4, 6, 8, 10, 12, 20] as const
const DICE_PRESETS_STORAGE_KEY = 'dhgc:dice-presets:v1'

type DiceCounts = Record<number, number>
type RollTone = 'standard' | 'hope' | 'fear' | 'critical'
type DieTone = 'neutral' | 'hope' | 'fear' | 'advantage' | 'disadvantage'
type DicePreset = {
  id: string
  name: string
  formula: string
}

const EMPTY_COUNTS: DiceCounts = Object.fromEntries(DICE_SIDES.map((sides) => [sides, 0]))

export function FloatingDicePanel() {
  const { room, rollDice, clearDiceHistory } = useStore()
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'standard' | 'dual'>('dual')
  const [counts, setCounts] = useState<DiceCounts>({ ...EMPTY_COUNTS })
  const [modifier, setModifier] = useState(0)
  const [modifierMode, setModifierMode] = useState<DiceModifierMode>('normal')
  const [presetName, setPresetName] = useState('')
  const [presetFormula, setPresetFormula] = useState('')
  const [presetError, setPresetError] = useState('')
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  const [dicePresets, setDicePresets] = useState<DicePreset[]>(() => loadDicePresets())

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
  const currentFormula = useMemo(() => formatDiceGroup(counts, modifier), [counts, modifier])
  const roomRolls = Array.isArray(room?.dice_rolls) ? room.dice_rolls : []
  const latestRoll = roomRolls.at(-1)
  const history = roomRolls.slice().reverse()

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

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
    setPresetError('')
  }

  function submitRoll() {
    if (!canRoll) return
    rollDice(request)
  }

  function applyDiceGroup(formula: string, shouldRoll = false) {
    try {
      const parsed = parseDiceGroupFormula(formula)
      setMode('standard')
      setCounts(parsed.counts)
      setModifier(parsed.modifier)
      setModifierMode('normal')
      setPresetError('')
      if (shouldRoll) {
        rollDice({
          mode: 'standard',
          modifier_mode: 'normal',
          repeat: 1,
          modifier: parsed.modifier,
          dice: diceFromCounts(parsed.counts),
        })
      }
    } catch (error) {
      setPresetError(error instanceof Error ? error.message : '骰组格式无效')
    }
  }

  function savePreset(event: FormEvent) {
    event.preventDefault()
    const name = presetName.trim()
    const formula = presetFormula.trim()

    if (!name) {
      setPresetError('请输入预设名称')
      return
    }
    if (!formula) {
      setPresetError('请输入骰组公式')
      return
    }

    try {
      const parsed = parseDiceGroupFormula(formula)
      const nextPreset = {
        id: editingPresetId ?? createPresetId(),
        name,
        formula: parsed.normalized,
      }
      const nextPresets = editingPresetId
        ? dicePresets.map((preset) => preset.id === editingPresetId ? nextPreset : preset)
        : [...dicePresets, nextPreset]

      setDicePresets(nextPresets)
      persistDicePresets(nextPresets)
      setPresetName('')
      setPresetFormula('')
      setEditingPresetId(null)
      setPresetError('')
    } catch (error) {
      setPresetError(error instanceof Error ? error.message : '骰组格式无效')
    }
  }

  function editPreset(preset: DicePreset) {
    setEditingPresetId(preset.id)
    setPresetName(preset.name)
    setPresetFormula(preset.formula)
    setPresetError('')
  }

  function deletePreset(id: string) {
    const nextPresets = dicePresets.filter((preset) => preset.id !== id)
    setDicePresets(nextPresets)
    persistDicePresets(nextPresets)
    if (editingPresetId === id) {
      setEditingPresetId(null)
      setPresetName('')
      setPresetFormula('')
      setPresetError('')
    }
  }

  function cancelPresetEdit() {
    setEditingPresetId(null)
    setPresetName('')
    setPresetFormula('')
    setPresetError('')
  }

  function clearStandardDiceGroup() {
    setCounts({ ...EMPTY_COUNTS })
    setModifier(0)
    setModifierMode('normal')
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

      {isOpen && (
        <div
          className="dice-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dice-modal-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false)
          }}
        >
          <div className="dice-modal-backdrop" aria-hidden="true" />
          <div className="dice-modal-frame">
            <div className="dice-modal-topbar">
              <h3 id="dice-modal-title">掷骰面板</h3>
              <button
                type="button"
                className="dice-modal-close"
                onClick={() => setIsOpen(false)}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>
            <div className="dice-hairline" />

            <div className="dice-panel dice-panel--ritual">
              <section className={`dice-builder dice-light-card ${mode === 'standard' ? 'dice-builder--standard' : ''}`} aria-label="骰盘">
                <div className="dice-mode-switch dice-mode-switch--tabs" aria-label="掷骰模式">
                  <button
                    type="button"
                    className={mode === 'dual' ? 'is-active is-dual' : ''}
                    onClick={() => changeMode('dual')}
                  >
                    二元骰
                    <span>希望 d12 + 恐惧 d12</span>
                  </button>
                  <button
                    type="button"
                    className={mode === 'standard' ? 'is-active' : ''}
                    onClick={() => changeMode('standard')}
                  >
                    普通骰
                    <span>骰池与固定加值</span>
                  </button>
                </div>

                <div className="dice-section-heading">
                  <div>
                    <div className="dice-section-heading__eyebrow">ROLL SETUP</div>
                    <h3>{mode === 'dual' ? '二元骰设定' : '普通骰组'}</h3>
                  </div>
                  <button type="button" className="dice-reset" onClick={resetPool}>
                    <RotateCcw size={14} /> 重置
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
                          <span className="dice-token__label">d{sides}</span>
                          {count > 0 && <strong className="dice-token__count">{count}</strong>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="dice-control-row">
                  <Stepper
                    label="修正值"
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

                {mode === 'standard' && (
                  <>
                    <div className="dice-current-formula" aria-live="polite">
                      {currentFormula || '选择骰组'}
                    </div>
                    <div className="dice-clear-row">
                      <button type="button" onClick={clearStandardDiceGroup} disabled={!dice.length && modifier === 0}>
                        清空骰组
                      </button>
                    </div>

                    <div className="dice-preset-panel">
                      <div className="dice-preset-heading">
                        <h4>预设骰组</h4>
                        {editingPresetId && (
                          <button type="button" onClick={cancelPresetEdit}>
                            取消编辑
                          </button>
                        )}
                      </div>

                      <form className="dice-preset-form" onSubmit={savePreset}>
                        <input
                          value={presetName}
                          onChange={(event) => {
                            setPresetName(event.target.value)
                            if (presetError) setPresetError('')
                          }}
                          maxLength={20}
                          placeholder="名称"
                          aria-label="预设名称"
                        />
                        <input
                          value={presetFormula}
                          onChange={(event) => {
                            setPresetFormula(event.target.value)
                            if (presetError) setPresetError('')
                          }}
                          placeholder="2d6 + 3"
                          aria-label="预设骰组公式"
                        />
                        <button type="submit" aria-label={editingPresetId ? '保存预设' : '添加预设'}>
                          {editingPresetId ? '存' : <Plus size={18} />}
                        </button>
                      </form>

                      {presetError && <div className="dice-group-error">{presetError}</div>}

                      <div className="dice-preset-list" aria-label="预设骰组列表">
                        {dicePresets.length === 0 ? (
                          <p>添加常用骰式，之后点击名称即可掷骰</p>
                        ) : dicePresets.map((preset) => (
                          <div key={preset.id} className="dice-preset-item">
                            <button type="button" onClick={() => applyDiceGroup(preset.formula, true)}>
                              <span>{preset.name}</span>
                              <small>{preset.formula}</small>
                            </button>
                            <button type="button" onClick={() => editPreset(preset)} aria-label={`编辑${preset.name}`}>
                              编辑
                            </button>
                            <button type="button" onClick={() => deletePreset(preset.id)} aria-label={`删除${preset.name}`}>
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <button type="button" className="dice-roll-button" disabled={!canRoll} onClick={submitRoll}>
                  <Dices size={20} />
                  {mode === 'standard' && currentFormula ? `掷 · ${currentFormula}` : '掷出骰子'}
                </button>
              </section>

              <LatestRollStage roll={latestRoll} />

              <RollHistory rolls={history} onClear={clearDiceHistory} />
            </div>
          </div>
        </div>
      )}
    </>
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

function RollHistory({ rolls, onClear }: { rolls: DiceRollRecord[]; onClear: () => void }) {
  return (
    <section className="dice-history dice-light-card">
      <div className="dice-section-heading">
        <div>
          <div className="dice-section-heading__eyebrow">ROOM HISTORY</div>
          <h3>掷骰记录</h3>
        </div>
        <button
          type="button"
          className="dice-history__clear"
          onClick={onClear}
          disabled={rolls.length === 0}
          aria-label="清除掷骰记录"
        >
          {rolls.length === 0 ? <History size={16} /> : <Trash2 size={15} />}
          清空
        </button>
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
        <button type="button" className="dice-stepper__quick" onClick={() => onChange(Math.min(max, value + 2))}>
          +2
        </button>
        <button type="button" className="dice-stepper__quick" onClick={() => onChange(Math.min(max, value + 3))}>
          +3
        </button>
        <button type="button" className="dice-stepper__quick" onClick={() => onChange(Math.min(max, value + 5))}>
          +5
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

function diceFromCounts(counts: DiceCounts): DicePoolEntry[] {
  return DICE_SIDES
    .map((sides) => ({ sides, count: counts[sides] ?? 0 }))
    .filter((entry) => entry.count > 0)
}

function formatDiceGroup(counts: DiceCounts, modifier: number) {
  const diceText = DICE_SIDES
    .map((sides) => {
      const count = counts[sides] ?? 0
      return count > 0 ? `${count}d${sides}` : ''
    })
    .filter(Boolean)
    .join(' + ')
  const modifierText = modifier > 0 ? `${diceText ? ' + ' : ''}${modifier}` : modifier < 0 ? `${diceText ? ' - ' : '-'}${Math.abs(modifier)}` : ''

  return `${diceText}${modifierText}`
}

function loadDicePresets(): DicePreset[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(DICE_PRESETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is DicePreset => (
        item
        && typeof item.id === 'string'
        && typeof item.name === 'string'
        && typeof item.formula === 'string'
      ))
      .slice(0, 20)
  } catch {
    return []
  }
}

function persistDicePresets(presets: DicePreset[]) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(DICE_PRESETS_STORAGE_KEY, JSON.stringify(presets.slice(0, 20)))
  } catch {
    // Ignore storage failures; presets still work for the current session.
  }
}

function createPresetId() {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
