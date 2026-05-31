import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Shield, Swords, Upload } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

const FIELD = {
  name: '\u540d\u79f0',
  originalName: '\u539f\u6587',
  tier: '\u4f4d\u9636',
  kind: '\u79cd\u7c7b',
  traits: '\u7279\u6027',
  traitName: '\u540d\u79f0',
  traitOriginalName: '\u539f\u540d',
  traitType: '\u7c7b\u578b',
  traitDescription: '\u7279\u6027\u63cf\u8ff0',
  type: '\u7c7b\u578b',
  intro: '\u7b80\u4ecb',
  tactics: '\u52a8\u673a\u4e0e\u6218\u672f',
  difficulty: '\u96be\u5ea6',
  majorThreshold: '\u91cd\u5ea6\u4f24\u5bb3\u9608\u503c',
  severeThreshold: '\u4e25\u91cd\u4f24\u5bb3\u9608\u503c',
  hp: '\u751f\u547d\u70b9',
  stress: '\u538b\u529b\u70b9',
  attackHit: '\u653b\u51fb\u547d\u4e2d',
  attackWeapon: '\u653b\u51fb\u6b66\u5668',
  attackRange: '\u653b\u51fb\u8303\u56f4',
  attackDamage: '\u653b\u51fb\u4f24\u5bb3',
  attackType: '\u653b\u51fb\u5c5e\u6027',
  experience: '\u7ecf\u5386',
  source: '\u6765\u6e90',
  currentHp: '_currentHp',
  currentStress: '_currentStress',
} as const

type RawBattlePanelEntry = {
  id: string
  data: Record<string, unknown>
}

type BattleTrait = {
  name: string
  originalName: string
  type: string
  description: string
}

type BattleMonster = {
  id: string
  name: string
  originalName: string
  tier: string
  kind: string
  type: string
  intro: string
  tactics: string
  difficulty: number
  majorThreshold: number
  severeThreshold: number
  hpMax: number
  stressMax: number
  attackHit: string
  attackWeapon: string
  attackRange: string
  attackDamage: string
  attackType: string
  experience: string
  source: string
  initialHpMarked: number
  initialStressMarked: number
  traits: BattleTrait[]
}

type BattlePanelState = Record<string, { hpMarked: number; stressMarked: number }>

function getStorageKey(roomId: string) {
  return `gm-panel:battle-panel:${roomId}`
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  const numeric = Number.parseInt(asText(value, `${fallback}`), 10)
  return Number.isFinite(numeric) ? numeric : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function renderInlineMarkdown(text: string) {
  const nodes: React.ReactNode[] = []
  const pattern = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const matched = match[0]
    const index = match.index ?? 0

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index))
    }

    if (matched.startsWith('***') && matched.endsWith('***')) {
      nodes.push(
        <strong key={`bold-italic-${index}`} style={{ fontWeight: 800, color: '#1f2937' }}>
          <em style={{ fontStyle: 'italic' }}>{matched.slice(3, -3)}</em>
        </strong>,
      )
    } else if (matched.startsWith('**') && matched.endsWith('**')) {
      nodes.push(
        <strong key={`bold-${index}`} style={{ fontWeight: 800, color: '#1f2937' }}>
          {matched.slice(2, -2)}
        </strong>,
      )
    } else if (matched.startsWith('*') && matched.endsWith('*')) {
      nodes.push(
        <em key={`italic-${index}`} style={{ fontStyle: 'italic' }}>
          {matched.slice(1, -1)}
        </em>,
      )
    }

    lastIndex = index + matched.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

function renderSimpleMarkdown(text: string) {
  return text.split(/\r?\n/).map((line, index, lines) => (
    <React.Fragment key={`line-${index}`}>
      {renderInlineMarkdown(line)}
      {index < lines.length - 1 && <br />}
    </React.Fragment>
  ))
}

function normalizeExport(entries: RawBattlePanelEntry[]): BattleMonster[] {
  return entries
    .map((entry) => {
      const data = entry.data
      const traits = Array.isArray(data[FIELD.traits])
        ? (data[FIELD.traits] as Array<Record<string, unknown>>).map((trait) => ({
          name: asText(trait[FIELD.traitName]),
          originalName: asText(trait[FIELD.traitOriginalName]),
          type: asText(trait[FIELD.traitType]),
          description: asText(trait[FIELD.traitDescription]),
        }))
        : []

      return {
        id: asText(data.id, entry.id),
        name: asText(data[FIELD.name], '\u672a\u547d\u540d\u602a\u7269'),
        originalName: asText(data[FIELD.originalName]),
        tier: asText(data[FIELD.tier]),
        kind: asText(data[FIELD.kind]),
        type: asText(data[FIELD.type]),
        intro: asText(data[FIELD.intro]),
        tactics: asText(data[FIELD.tactics]),
        difficulty: asNumber(data[FIELD.difficulty]),
        majorThreshold: asNumber(data[FIELD.majorThreshold]),
        severeThreshold: asNumber(data[FIELD.severeThreshold]),
        hpMax: asNumber(data[FIELD.hp]),
        stressMax: asNumber(data[FIELD.stress]),
        attackHit: asText(data[FIELD.attackHit]),
        attackWeapon: asText(data[FIELD.attackWeapon]),
        attackRange: asText(data[FIELD.attackRange]),
        attackDamage: asText(data[FIELD.attackDamage]),
        attackType: asText(data[FIELD.attackType]),
        experience: asText(data[FIELD.experience]),
        source: asText(data[FIELD.source]),
        initialHpMarked: asNumber(data[FIELD.currentHp]),
        initialStressMarked: asNumber(data[FIELD.currentStress]),
        traits,
      }
    })
    .filter((monster) => monster.id)
}

function buildBattleState(monsters: BattleMonster[], existing: BattlePanelState = {}): BattlePanelState {
  return Object.fromEntries(monsters.map((monster) => {
    const previous = existing[monster.id]
    return [
      monster.id,
      {
        hpMarked: clamp(typeof previous?.hpMarked === 'number' ? previous.hpMarked : monster.initialHpMarked, 0, monster.hpMax),
        stressMarked: clamp(typeof previous?.stressMarked === 'number' ? previous.stressMarked : monster.initialStressMarked, 0, monster.stressMax),
      },
    ]
  }))
}

const defaultMonsterEntries: RawBattlePanelEntry[] = []

export function FloatingBattlePanel({ roomId }: { roomId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [monsterEntries, setMonsterEntries] = useState<RawBattlePanelEntry[]>(defaultMonsterEntries)
  const [stateByMonsterId, setStateByMonsterId] = useState<BattlePanelState>({})
  const [statusMessage, setStatusMessage] = useState('')
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const monsters = useMemo(() => normalizeExport(monsterEntries), [monsterEntries])

  useEffect(() => {
    const nextMonsters = normalizeExport(defaultMonsterEntries)
    setMonsterEntries(defaultMonsterEntries)

    try {
      const storedState = localStorage.getItem(getStorageKey(roomId))
      setStateByMonsterId(buildBattleState(nextMonsters, storedState ? JSON.parse(storedState) as BattlePanelState : {}))
    } catch {
      setStateByMonsterId(buildBattleState(nextMonsters))
    }
  }, [roomId])

  useEffect(() => {
    if (!Object.keys(stateByMonsterId).length) return
    localStorage.setItem(getStorageKey(roomId), JSON.stringify(stateByMonsterId))
  }, [roomId, stateByMonsterId])

  function updateTrack(monsterId: string, key: 'hpMarked' | 'stressMarked', nextValue: number, max: number) {
    setStateByMonsterId((current) => ({
      ...current,
      [monsterId]: {
        ...(current[monsterId] ?? { hpMarked: 0, stressMarked: 0 }),
        [key]: clamp(nextValue, 0, max),
      },
    }))
  }

  async function handleImportChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const parsed = JSON.parse(await file.text()) as RawBattlePanelEntry[]
      if (!Array.isArray(parsed)) throw new Error('JSON 必须是数组')

      const nextMonsters = normalizeExport(parsed)
      if (!nextMonsters.length) throw new Error('没有读取到怪物数据')

      setMonsterEntries(parsed)
      setStateByMonsterId((current) => buildBattleState(nextMonsters, current))
      setStatusMessage(`已在本地导入 ${nextMonsters.length} 张怪物卡`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? `导入失败：${error.message}` : '导入失败：无法读取 JSON')
    }
  }

  const cards = useMemo(() => monsters.map((monster) => {
    const localState = stateByMonsterId[monster.id] ?? {
      hpMarked: clamp(monster.initialHpMarked, 0, monster.hpMax),
      stressMarked: clamp(monster.initialStressMarked, 0, monster.stressMax),
    }

    return { monster, localState }
  }), [monsters, stateByMonsterId])

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 84,
          zIndex: 60,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          border: '1px solid rgba(139, 224, 213, 0.38)',
          background: 'linear-gradient(135deg, #27185a, #180f3b)',
          color: '#8be0d5',
          boxShadow: '0 14px 28px rgba(24, 15, 59, 0.24)',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        <Swords size={16} />
        {'\u6218\u6597\u9762\u677f'}
      </button>

      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleImportChange}
      />

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title={'\u6218\u6597\u9762\u677f'} maxWidth={1380}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '0 4px',
              color: '#5c4f41',
              fontSize: 13,
              lineHeight: 1.6,
              flexWrap: 'wrap',
            }}
          >
            <div>
              {statusMessage && (
                <div style={{ color: '#0f766e', fontWeight: 700 }}>{statusMessage}</div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4a357e', fontWeight: 700 }}>
                <Shield size={14} />
                {cards.length} {'\u4e2a\u602a\u7269\u5361'}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload size={14} /> {'\u5bfc\u5165\u672c\u5730 JSON'}
              </button>
            </div>
          </div>

          <div
            style={{
              maxHeight: '78vh',
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 16,
                alignItems: 'start',
              }}
            >
              {cards.map(({ monster, localState }) => (
                <BattleMonsterCard
                  key={monster.id}
                  monster={monster}
                  hpMarked={localState.hpMarked}
                  stressMarked={localState.stressMarked}
                  onHpChange={(value) => updateTrack(monster.id, 'hpMarked', value, monster.hpMax)}
                  onStressChange={(value) => updateTrack(monster.id, 'stressMarked', value, monster.stressMax)}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}

function BattleMonsterCard(props: {
  monster: BattleMonster
  hpMarked: number
  stressMarked: number
  onHpChange: (value: number) => void
  onStressChange: (value: number) => void
}) {
  const { monster, hpMarked, stressMarked, onHpChange, onStressChange } = props

  return (
    <article
      style={{
        display: 'grid',
        gap: 10,
        border: '2px solid rgba(139, 224, 213, 0.26)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(232,228,242,0.96))',
        boxShadow: '0 18px 42px rgba(35, 20, 68, 0.14)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 14px 0 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#27185a', lineHeight: 1.2 }}>{monster.name}</div>
            {monster.originalName && (
              <div style={{ marginTop: 3, fontSize: 11, color: '#94a3b8', letterSpacing: '0.08em' }}>{monster.originalName}</div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#4a357e' }}>{'\u4f4d\u9636'} {monster.tier} {monster.kind}</div>
            <div style={{ marginTop: 3, fontSize: 11, color: '#94a3b8' }}>{monster.type}</div>
          </div>
        </div>

        {monster.intro && (
          <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: '#475569' }}>{renderSimpleMarkdown(monster.intro)}</div>
        )}

        {monster.tactics && (
          <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, color: '#334155' }}>
            <strong style={{ color: '#1f2937' }}>{'\u52a8\u673a\u4e0e\u6218\u672f\uff1a'}</strong> {renderSimpleMarkdown(monster.tactics)}
          </div>
        )}
      </div>

      <div style={{ margin: '0 14px', padding: 12, background: 'rgba(39, 24, 90, 0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, fontWeight: 800, color: '#1f2937' }}>
          <span>{'\u96be\u5ea6'} {monster.difficulty}</span>
          <span>{'\u9608\u503c'} {monster.majorThreshold} / {monster.severeThreshold}</span>
        </div>

        <TrackRow label={'\u751f\u547d'} count={monster.hpMax} marked={hpMarked} color="#d14836" onChange={onHpChange} />
        <TrackRow label={'\u538b\u529b'} count={monster.stressMax} marked={stressMarked} color="#8b5cf6" onChange={onStressChange} />

        {monster.experience && (
          <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6, color: '#334155' }}>
            <strong style={{ color: '#1f2937' }}>{'\u7ecf\u5386\uff1a'}</strong> {renderSimpleMarkdown(monster.experience)}
          </div>
        )}
      </div>

      {(monster.attackHit || monster.attackWeapon || monster.attackRange || monster.attackDamage || monster.attackType) && (
        <div
          style={{
            margin: '0 14px',
            padding: '10px 12px',
            borderLeft: '3px solid #8be0d5',
            background: 'linear-gradient(90deg, rgba(139,224,213,0.20), rgba(251,251,255,0.78))',
            color: '#117768',
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {'\u653b\u51fb'}{monster.attackHit} | {monster.attackWeapon}·{monster.attackRange} | {monster.attackDamage} {monster.attackType}
        </div>
      )}

      <div style={{ display: 'grid', gap: 8, padding: '0 14px 14px 14px' }}>
        {monster.traits.map((trait) => (
          <div key={`${monster.id}-${trait.name}`} style={{ border: '1px solid rgba(39, 24, 90, 0.14)', background: 'rgba(251,251,255,0.86)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '7px 10px',
                borderBottom: trait.description ? '1px solid rgba(148, 163, 184, 0.16)' : 'none',
              }}
            >
              <div style={{ minWidth: 0, fontSize: 13, fontWeight: 800, color: '#1f2937' }}>{trait.name}</div>
              <div style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{trait.type}</div>
            </div>
            {trait.description && (
              <div style={{ padding: '9px 10px', fontSize: 12, lineHeight: 1.7, color: '#475569', whiteSpace: 'pre-wrap' }}>
                {renderSimpleMarkdown(trait.description)}
              </div>
            )}
          </div>
        ))}

        {monster.source && (
          <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>{'\u6765\u6e90\uff1a'}{monster.source}</div>
        )}
      </div>
    </article>
  )
}

function TrackRow(props: {
  label: string
  count: number
  marked: number
  color: string
  onChange: (value: number) => void
}) {
  const { label, count, marked, color, onChange } = props

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
      <div style={{ width: 32, flexShrink: 0, fontSize: 13, fontWeight: 800, color: '#1f2937' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {Array.from({ length: count }, (_, index) => {
          const step = index + 1
          const active = step <= marked
          return (
            <button
              key={`${label}-${step}`}
              type="button"
              onClick={() => onChange(marked === step ? step - 1 : step)}
              title={`${label}${step}`}
              style={{
                width: 20,
                height: 20,
                border: `1px solid ${active ? color : 'rgba(100, 116, 139, 0.4)'}`,
                background: active ? color : 'white',
                cursor: 'pointer',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
