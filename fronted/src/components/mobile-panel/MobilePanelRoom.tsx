import React, { useEffect, useState } from 'react'
import type {
  MobilePanelCharacterEntry,
  MobilePanelExperience,
} from '@dhgc/shared'
import { BookText, Clock3, MoreHorizontal, Pencil, Plus, RefreshCw, ScrollText, Shield, Swords, Trash2, UserPlus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '@/store/useStore'

const MAX_EXPERIENCES = 6

type ExperienceDraft = {
  id: string
  name: string
  value: string
}

function buildEmptyExperienceDrafts(): ExperienceDraft[] {
  return Array.from({ length: MAX_EXPERIENCES }, (_, index) => ({
    id: `draft_${index}`,
    name: '',
    value: '',
  }))
}

function buildExperienceDrafts(source?: MobilePanelExperience[]): ExperienceDraft[] {
  const drafts = buildEmptyExperienceDrafts()
  source?.slice(0, MAX_EXPERIENCES).forEach((item, index) => {
    drafts[index] = {
      id: item.id || `draft_${index}`,
      name: item.name,
      value: item.value,
    }
  })
  return drafts
}

function normalizeExperiences(drafts: ExperienceDraft[]): MobilePanelExperience[] {
  return drafts
    .map((item, index) => ({
      id: item.id || `exp_${index}`,
      name: item.name.trim(),
      value: item.value.trim(),
    }))
    .filter((item) => item.name || item.value)
}

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'divider' }

function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const normalized = source.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const lines = normalized.split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index].trim()

    if (!line) {
      index += 1
      continue
    }

    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
      blocks.push({ type: 'divider' })
      index += 1
      continue
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      })
      index += 1
      continue
    }

    const quoteMatch = line.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      const quoteLines: string[] = [quoteMatch[1]]
      index += 1
      while (index < lines.length) {
        const nextMatch = lines[index].trim().match(/^>\s?(.*)$/)
        if (!nextMatch) break
        quoteLines.push(nextMatch[1])
        index += 1
      }
      blocks.push({ type: 'quote', text: quoteLines.join('\n').trim() })
      continue
    }

    const unorderedMatch = line.match(/^[-*]\s+(.*)$/)
    if (unorderedMatch) {
      const items: string[] = [unorderedMatch[1].trim()]
      index += 1
      while (index < lines.length) {
        const nextMatch = lines[index].trim().match(/^[-*]\s+(.*)$/)
        if (!nextMatch) break
        items.push(nextMatch[1].trim())
        index += 1
      }
      blocks.push({ type: 'list', ordered: false, items })
      continue
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      const items: string[] = [orderedMatch[1].trim()]
      index += 1
      while (index < lines.length) {
        const nextMatch = lines[index].trim().match(/^\d+\.\s+(.*)$/)
        if (!nextMatch) break
        items.push(nextMatch[1].trim())
        index += 1
      }
      blocks.push({ type: 'list', ordered: true, items })
      continue
    }

    const paragraphLines = [line]
    index += 1
    while (index < lines.length) {
      const nextLine = lines[index].trim()
      if (!nextLine) {
        index += 1
        break
      }
      if (
        /^(#{1,4})\s+/.test(nextLine)
        || /^>\s?/.test(nextLine)
        || /^[-*]\s+/.test(nextLine)
        || /^\d+\.\s+/.test(nextLine)
        || /^---+$/.test(nextLine)
        || /^\*\*\*+$/.test(nextLine)
      ) {
        break
      }
      paragraphLines.push(nextLine)
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') })
  }

  return blocks
}

function renderMarkdownInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const pattern = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const full = match[0]
    const index = match.index ?? 0
    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index))
    }

    if (full.startsWith('***') && full.endsWith('***')) {
      nodes.push(
        <strong key={`${index}-bold-italic`} style={{ fontWeight: 800 }}>
          <em style={{ fontStyle: 'italic' }}>{full.slice(3, -3)}</em>
        </strong>,
      )
    } else if (full.startsWith('**') && full.endsWith('**')) {
      nodes.push(<strong key={`${index}-bold`}>{full.slice(2, -2)}</strong>)
    } else if (full.startsWith('*') && full.endsWith('*')) {
      nodes.push(<em key={`${index}-italic`}>{full.slice(1, -1)}</em>)
    } else if (full.startsWith('`') && full.endsWith('`')) {
      nodes.push(
        <code
          key={`${index}-code`}
          style={{
            padding: '1px 5px',
            borderRadius: 6,
            background: 'rgba(113, 88, 52, 0.1)',
            border: '1px solid rgba(113, 88, 52, 0.14)',
            fontSize: '0.92em',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          }}
        >
          {full.slice(1, -1)}
        </code>,
      )
    } else {
      const linkMatch = full.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        nodes.push(
          <a
            key={`${index}-link`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#8b5e34', textDecoration: 'underline', textUnderlineOffset: 2 }}
          >
            {linkMatch[1]}
          </a>,
        )
      } else {
        nodes.push(full)
      }
    }

    lastIndex = index + full.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length ? nodes : [text]
}

function renderMarkdownText(text: string) {
  return text.split('\n').map((line, index) => (
    <React.Fragment key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {renderMarkdownInline(line)}
    </React.Fragment>
  ))
}

function getCharacterTitle(entry: MobilePanelCharacterEntry) {
  if (entry.custom.display_name) return entry.custom.display_name

  const parts = [
    entry.decoded.specialCards.profession?.title,
    entry.decoded.specialCards.subclass?.title,
    entry.decoded.specialCards.ancestry1?.title,
    entry.decoded.specialCards.ancestry2?.title,
    entry.decoded.specialCards.community?.title,
  ].filter(Boolean)

  return parts.length ? `${parts.join('-')} LV${entry.decoded.level}` : `角色 LV${entry.decoded.level}`
}

function getIdentityLine(entry: MobilePanelCharacterEntry) {
  return [
    `LV${entry.decoded.level}`,
    entry.decoded.specialCards.profession?.title,
    entry.decoded.specialCards.subclass?.title,
    [entry.decoded.specialCards.ancestry1?.title, entry.decoded.specialCards.ancestry2?.title].filter(Boolean).join('/'),
    entry.decoded.specialCards.community?.title,
  ].filter(Boolean).join(' / ')
}

function toggleTrackValue(track: boolean[], index: number) {
  return track.map((value, currentIndex) => (currentIndex === index ? !value : value))
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(113, 88, 52, 0.14)',
        display: 'grid',
        gap: 4,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 900 }}>{value}</div>
    </div>
  )
}

function TrackDots({
  label,
  values,
  onToggle,
}: {
  label: string
  values: boolean[]
  onToggle: (index: number) => void
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {values.map((value, index) => (
          <button
            key={`${label}-${index}`}
            type="button"
            onClick={() => onToggle(index)}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: `1px solid ${value ? '#8b5e34' : 'rgba(113, 88, 52, 0.2)'}`,
              background: value ? 'linear-gradient(180deg, #c99b63, #8b5e34)' : 'rgba(255,255,255,0.82)',
              color: value ? '#fff7ee' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  )
}

function NumberAdjuster({
  label,
  value,
  min = 0,
  max,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 14px',
        border: '1px solid rgba(113, 88, 52, 0.14)',
        background: 'rgba(255,255,255,0.88)',
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)' }}>{value}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => onChange(Math.max(min, value - 1))}>-</button>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={() => onChange(max == null ? value + 1 : Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  )
}

function handleCardKeyActivate(event: React.KeyboardEvent<HTMLElement>, onActivate: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onActivate()
  }
}

export function MobilePanelRoom() {
  const {
    room,
    importMobileCharacter,
    replaceMobileCharacter,
    deleteMobileCharacter,
    updateMobileCharacterCustom,
    updateMobileResource,
    updateMobileFear,
    createMobileCountdown,
    updateMobileCountdown,
    deleteMobileCountdown,
    addToast,
  } = useStore()

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isLogOpen, setIsLogOpen] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null)
  const [replacingCharacterId, setReplacingCharacterId] = useState<string | null>(null)
  const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null)
  const [draftCode, setDraftCode] = useState('')
  const [draftDisplayName, setDraftDisplayName] = useState('')
  const [draftExperiences, setDraftExperiences] = useState<ExperienceDraft[]>(buildEmptyExperienceDrafts())
  const [replaceCode, setReplaceCode] = useState('')
  const [countdownName, setCountdownName] = useState('')
  const [countdownMax, setCountdownMax] = useState('6')
  const [activeCharacterMenuId, setActiveCharacterMenuId] = useState<string | null>(null)

  const panel = room?.room_type === 'mobile-panel' ? room.mobile_panel : null
  const orderedCharacters = panel
    ? panel.character_order
      .map((characterId) => panel.characters.find((item) => item.id === characterId) ?? null)
      .filter((item): item is MobilePanelCharacterEntry => Boolean(item))
    : []
  const selectedCharacter = panel && selectedCharacterId
    ? panel.characters.find((item) => item.id === selectedCharacterId) ?? null
    : null
  const editingCharacter = panel && editingCharacterId
    ? panel.characters.find((item) => item.id === editingCharacterId) ?? null
    : null
  const replacingCharacter = panel && replacingCharacterId
    ? panel.characters.find((item) => item.id === replacingCharacterId) ?? null
    : null
  const deletingCharacter = panel && deletingCharacterId
    ? panel.characters.find((item) => item.id === deletingCharacterId) ?? null
    : null

  useEffect(() => {
    if (!editingCharacter) return
    setDraftDisplayName(editingCharacter.custom.display_name)
    setDraftExperiences(buildExperienceDrafts(editingCharacter.custom.experiences))
  }, [editingCharacter])

  useEffect(() => {
    if (!isAddOpen) return
    setDraftCode('')
    setDraftDisplayName('')
    setDraftExperiences(buildEmptyExperienceDrafts())
  }, [isAddOpen])

  useEffect(() => {
    if (!replacingCharacterId) {
      setReplaceCode('')
    }
  }, [replacingCharacterId])

  useEffect(() => {
    if (!activeCharacterMenuId) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-mobile-actions-root="true"]')) return
      setActiveCharacterMenuId(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [activeCharacterMenuId])

  function updateExperience(index: number, key: 'name' | 'value', value: string) {
    setDraftExperiences((current) => current.map((item, currentIndex) => (
      currentIndex === index ? { ...item, [key]: value } : item
    )))
  }

  function submitCreateCharacter() {
    if (!draftCode.trim()) {
      addToast('请输入角色码。', 'error')
      return
    }

    importMobileCharacter(draftCode.trim(), draftDisplayName.trim(), normalizeExperiences(draftExperiences))
    setIsAddOpen(false)
    addToast('角色码已提交导入。', 'success')
  }

  function submitEditCharacter() {
    if (!editingCharacter) return
    updateMobileCharacterCustom(editingCharacter.id, draftDisplayName.trim(), normalizeExperiences(draftExperiences))
    setEditingCharacterId(null)
    addToast('角色自定义信息已更新。', 'success')
  }

  function submitReplaceCharacter() {
    if (!replacingCharacter) return
    if (!replaceCode.trim()) {
      addToast('请输入新的角色码。', 'error')
      return
    }

    replaceMobileCharacter(replacingCharacter.id, replaceCode.trim())
    setReplacingCharacterId(null)
    addToast('新的角色码已提交。', 'success')
  }

  function submitCountdown() {
    if (!panel) return
    createMobileCountdown(
      countdownName.trim() || `进度钟 ${panel.countdowns.length + 1}`,
      Math.max(2, Math.min(12, Number.parseInt(countdownMax, 10) || 6)),
    )
    setCountdownName('')
    setCountdownMax('6')
  }

  function closeActionMenus() {
    setActiveCharacterMenuId(null)
  }

  function openAddCharacter() {
    closeActionMenus()
    setIsAddOpen(true)
  }

  function openActivityLog() {
    closeActionMenus()
    setIsLogOpen(true)
  }

  function openEditCharacter(characterId: string) {
    closeActionMenus()
    setEditingCharacterId(characterId)
  }

  function openReplaceCharacter(characterId: string) {
    closeActionMenus()
    setReplacingCharacterId(characterId)
  }

  function openDeleteCharacter(characterId: string) {
    closeActionMenus()
    setDeletingCharacterId(characterId)
  }

  if (!panel) return null

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorY: 'contain',
        touchAction: 'pan-y',
        background: 'linear-gradient(180deg, #f7efe5 0%, #efe0ca 38%, #ead8bf 100%)',
        padding: '18px 14px 28px',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            alignItems: 'start',
          }}
        >
          <section
            style={{
              padding: 16,
              background: 'linear-gradient(145deg, rgba(76,41,21,0.92), rgba(120,72,38,0.88))',
              color: '#fff5ea',
              border: '1px solid rgba(255,236,214,0.2)',
              boxShadow: '0 18px 40px rgba(86, 52, 28, 0.18)',
              display: 'grid',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, letterSpacing: '0.08em', fontWeight: 800, color: 'rgba(255,245,234,0.78)' }}>MOBILE PANEL</div>
                <div style={{ marginTop: 4, fontSize: 24, fontWeight: 950 }}>恐惧点与进度钟</div>
                <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.7, color: 'rgba(255,245,234,0.76)' }}>
                  管理全队共享资源，也可以同时浏览角色列表。
                </div>
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  border: '1px solid rgba(255,245,234,0.2)',
                  background: 'rgba(255,245,234,0.08)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <Clock3 size={14} />
                {panel.countdowns.length} 个进度钟
              </div>
            </div>

            <NumberAdjuster
              label="恐惧点"
              value={panel.fear.value}
              max={panel.fear.max}
              onChange={updateMobileFear}
            />

            <div style={{ display: 'grid', gap: 10 }}>
              {panel.countdowns.length ? panel.countdowns.map((countdown) => (
                <div
                  key={countdown.id}
                  style={{
                    padding: 12,
                    background: 'rgba(255,245,234,0.1)',
                    border: '1px solid rgba(255,245,234,0.14)',
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{countdown.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,245,234,0.72)' }}>{countdown.value}/{countdown.max}</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => deleteMobileCountdown(countdown.id)}>
                      <Trash2 size={13} /> 删除
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={countdown.max}
                    value={countdown.value}
                    onChange={(event) => updateMobileCountdown(countdown.id, Number(event.target.value))}
                  />
                </div>
              )) : (
                <div
                  style={{
                    padding: '14px 16px',
                    border: '1px dashed rgba(255,245,234,0.26)',
                    background: 'rgba(255,245,234,0.06)',
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: 'rgba(255,245,234,0.78)',
                  }}
                >
                  还没有进度钟。你可以先在下方创建一个新的共享倒计时。
                </div>
              )}

              <div
                style={{
                  padding: 12,
                  background: 'rgba(255,245,234,0.1)',
                  border: '1px dashed rgba(255,245,234,0.28)',
                  display: 'grid',
                  gap: 10,
                }}
              >
                <input
                  className="input"
                  value={countdownName}
                  onChange={(event) => setCountdownName(event.target.value)}
                  placeholder="新进度钟名称"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    value={countdownMax}
                    onChange={(event) => setCountdownMax(event.target.value)}
                    placeholder="最大值"
                    inputMode="numeric"
                  />
                  <button className="btn btn-primary" type="button" onClick={submitCountdown}>
                    <Plus size={14} /> 添加
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section
            style={{
              padding: 16,
              background: 'rgba(255,250,244,0.78)',
              border: '1px solid rgba(113, 88, 52, 0.12)',
              boxShadow: '0 12px 30px rgba(118, 83, 36, 0.08)',
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)' }}>角色列表</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  点击卡片查看详情。角色管理操作仍然收在每张卡片右上角的菜单里。
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} data-mobile-actions-root="true">
                <button className="btn btn-secondary btn-sm" type="button" onClick={openActivityLog}>
                  <ScrollText size={14} /> 活动日志
                </button>
                <button className="btn btn-primary btn-sm" type="button" onClick={openAddCharacter}>
                  <UserPlus size={14} /> 添加角色
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {orderedCharacters.length ? orderedCharacters.map((entry) => {
                const isMenuOpen = activeCharacterMenuId === entry.id

                return (
                  <div
                    key={entry.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      closeActionMenus()
                      setSelectedCharacterId(entry.id)
                    }}
                    onKeyDown={(event) => handleCardKeyActivate(event, () => setSelectedCharacterId(entry.id))}
                    style={{
                      padding: 14,
                      textAlign: 'left',
                      border: '1px solid rgba(113, 88, 52, 0.14)',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(251,243,232,0.92))',
                      boxShadow: '0 8px 18px rgba(118, 83, 36, 0.06)',
                      cursor: 'pointer',
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>{getCharacterTitle(entry)}</div>
                        <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{getIdentityLine(entry)}</div>
                      </div>

                      <div style={{ position: 'relative' }} data-mobile-actions-root="true">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          aria-label={`${getCharacterTitle(entry)} 的角色操作`}
                          onClick={(event) => {
                            event.stopPropagation()
                            setActiveCharacterMenuId((current) => current === entry.id ? null : entry.id)
                          }}
                        >
                          <MoreHorizontal size={14} />
                        </button>

                        {isMenuOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 8px)',
                              right: 0,
                              zIndex: 8,
                              minWidth: 156,
                              padding: 8,
                              border: '1px solid rgba(113, 88, 52, 0.18)',
                              background: 'rgba(255,252,247,0.98)',
                              boxShadow: '0 14px 30px rgba(118, 83, 36, 0.14)',
                              display: 'grid',
                              gap: 6,
                            }}
                          >
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => openEditCharacter(entry.id)}>
                              <Pencil size={12} /> 编辑信息
                            </button>
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => openReplaceCharacter(entry.id)}>
                              <RefreshCw size={12} /> 替换角色码
                            </button>
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => openDeleteCharacter(entry.id)}>
                              <Trash2 size={12} /> 删除角色
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                      <StatPill label="希望" value={`${entry.tracker.hopeCurrent}/${entry.decoded.resources.hopeMax}`} />
                      <StatPill label="生命" value={`${entry.tracker.hp.filter(Boolean).length}/${entry.tracker.hp.length}`} />
                      <StatPill label="压力" value={`${entry.tracker.stress.filter(Boolean).length}/${entry.tracker.stress.length}`} />
                      <StatPill label="护甲槽" value={`${entry.tracker.armor_slots.filter(Boolean).length}/${entry.tracker.armor_slots.length}`} />
                      <StatPill label="金币" value={entry.tracker.goldCurrent} />
                      <StatPill label="领域卡" value={entry.decoded.domains.length} />
                    </div>
                  </div>
                )
              }) : (
                <div
                  style={{
                    padding: 22,
                    border: '1px dashed rgba(113, 88, 52, 0.24)',
                    color: 'var(--text-secondary)',
                    background: 'rgba(255,255,255,0.58)',
                    textAlign: 'center',
                    lineHeight: 1.8,
                  }}
                >
                  还没有角色。点击右下角的悬浮按钮，就可以添加角色或查看活动日志。
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <Modal open={isAddOpen} onClose={() => setIsAddOpen(false)} title="添加角色" maxWidth={640}>
        <div style={{ display: 'grid', gap: 14 }}>
          <textarea
            className="input"
            value={draftCode}
            onChange={(event) => setDraftCode(event.target.value)}
            placeholder="粘贴角色码"
            rows={5}
            style={{ resize: 'vertical', fontFamily: 'monospace' }}
          />
          <input className="input" value={draftDisplayName} onChange={(event) => setDraftDisplayName(event.target.value)} placeholder="自定义角色名称（可选）" />
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>经历列表</div>
            {draftExperiences.map((item, index) => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
                <input className="input" value={item.name} onChange={(event) => updateExperience(index, 'name', event.target.value)} placeholder={`经历 ${index + 1}`} />
                <input className="input" value={item.value} onChange={(event) => updateExperience(index, 'value', event.target.value)} placeholder="加值" />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" type="button" onClick={() => setIsAddOpen(false)}>取消</button>
            <button className="btn btn-primary" type="button" onClick={submitCreateCharacter}>
              <UserPlus size={14} /> 导入角色
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(selectedCharacter)} onClose={() => setSelectedCharacterId(null)} title={selectedCharacter ? getCharacterTitle(selectedCharacter) : '角色详情'} maxWidth={720}>
        {selectedCharacter && (
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{getIdentityLine(selectedCharacter)}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <StatPill label="闪避" value={selectedCharacter.decoded.evasion} />
              <StatPill label="护甲值" value={selectedCharacter.decoded.armor} />
              <StatPill label="重伤阈值" value={selectedCharacter.decoded.damageThresholds.minor} />
              <StatPill label="严重阈值" value={selectedCharacter.decoded.damageThresholds.major} />
              <StatPill label="熟练值" value={selectedCharacter.decoded.proficiency} />
              <StatPill label="金币" value={selectedCharacter.tracker.goldCurrent} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <StatPill label="敏捷" value={selectedCharacter.decoded.attributes.agility} />
              <StatPill label="力量" value={selectedCharacter.decoded.attributes.strength} />
              <StatPill label="灵巧" value={selectedCharacter.decoded.attributes.finesse} />
              <StatPill label="本能" value={selectedCharacter.decoded.attributes.instinct} />
              <StatPill label="风度" value={selectedCharacter.decoded.attributes.presence} />
              <StatPill label="知识" value={selectedCharacter.decoded.attributes.knowledge} />
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>资源追踪</div>
                <NumberAdjuster
                  label={`希望点 / ${selectedCharacter.decoded.resources.hopeMax}`}
                  value={selectedCharacter.tracker.hopeCurrent}
                  max={selectedCharacter.decoded.resources.hopeMax}
                  onChange={(value) => updateMobileResource(selectedCharacter.id, 'hopeCurrent', value)}
                />
                <NumberAdjuster
                  label="金币"
                  value={selectedCharacter.tracker.goldCurrent}
                  onChange={(value) => updateMobileResource(selectedCharacter.id, 'goldCurrent', value)}
                />
                <TrackDots
                  label={`生命点 / ${selectedCharacter.decoded.resources.hpMax}`}
                  values={selectedCharacter.tracker.hp}
                  onToggle={(index) => updateMobileResource(selectedCharacter.id, 'hp', toggleTrackValue(selectedCharacter.tracker.hp, index))}
                />
                <TrackDots
                  label={`压力点 / ${selectedCharacter.decoded.resources.stressMax}`}
                  values={selectedCharacter.tracker.stress}
                  onToggle={(index) => updateMobileResource(selectedCharacter.id, 'stress', toggleTrackValue(selectedCharacter.tracker.stress, index))}
                />
                <TrackDots
                  label={`护甲槽 / ${selectedCharacter.decoded.resources.armorMax}`}
                  values={selectedCharacter.tracker.armor_slots}
                  onToggle={(index) => updateMobileResource(selectedCharacter.id, 'armor_slots', toggleTrackValue(selectedCharacter.tracker.armor_slots, index))}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <SectionCard icon={<Shield size={14} />} title="职业与社群">
                {selectedCharacter.decoded.specialCards.profession && (
                  <InfoBlock title={selectedCharacter.decoded.specialCards.profession.title} body={selectedCharacter.decoded.specialCards.profession.text} />
                )}
                {selectedCharacter.decoded.specialCards.profession?.hopeFeature && (
                  <InfoBlock title="希望特性" body={selectedCharacter.decoded.specialCards.profession.hopeFeature} />
                )}
                {selectedCharacter.decoded.specialCards.subclass && (
                  <InfoBlock title={selectedCharacter.decoded.specialCards.subclass.title} body={selectedCharacter.decoded.specialCards.subclass.text} />
                )}
                {selectedCharacter.decoded.specialCards.community && (
                  <InfoBlock title={selectedCharacter.decoded.specialCards.community.title} body={selectedCharacter.decoded.specialCards.community.text} />
                )}
              </SectionCard>

              <SectionCard icon={<Swords size={14} />} title="种族与领域">
                {selectedCharacter.decoded.specialCards.ancestry1 && (
                  <InfoBlock title={selectedCharacter.decoded.specialCards.ancestry1.title} body={selectedCharacter.decoded.specialCards.ancestry1.text} />
                )}
                {selectedCharacter.decoded.specialCards.ancestry2 && (
                  <InfoBlock title={selectedCharacter.decoded.specialCards.ancestry2.title} body={selectedCharacter.decoded.specialCards.ancestry2.text} />
                )}
                {selectedCharacter.decoded.domains.map((domain) => (
                  <InfoBlock key={domain.id} title={domain.title} body={domain.text} />
                ))}
              </SectionCard>

              <SectionCard icon={<BookText size={14} />} title="经历">
                {selectedCharacter.custom.experiences.length ? selectedCharacter.custom.experiences.map((experience) => (
                  <div
                    key={experience.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.84)',
                      border: '1px solid rgba(113, 88, 52, 0.12)',
                    }}
                  >
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{experience.name || '未命名经历'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700 }}>{experience.value || '-'}</div>
                  </div>
                )) : (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>暂未填写自定义经历。</div>
                )}
              </SectionCard>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(editingCharacter)} onClose={() => setEditingCharacterId(null)} title="编辑角色信息" maxWidth={640}>
        <div style={{ display: 'grid', gap: 14 }}>
          <input className="input" value={draftDisplayName} onChange={(event) => setDraftDisplayName(event.target.value)} placeholder="自定义角色名称" />
          {draftExperiences.map((item, index) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
              <input className="input" value={item.name} onChange={(event) => updateExperience(index, 'name', event.target.value)} placeholder={`经历 ${index + 1}`} />
              <input className="input" value={item.value} onChange={(event) => updateExperience(index, 'value', event.target.value)} placeholder="加值" />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" type="button" onClick={() => setEditingCharacterId(null)}>取消</button>
            <button className="btn btn-primary" type="button" onClick={submitEditCharacter}>
              <Pencil size={14} /> 保存
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(replacingCharacter)} onClose={() => setReplacingCharacterId(null)} title="替换角色码" maxWidth={640}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            替换后会保留当前角色的自定义名称、经历和已追踪的资源进度，并按新角色的上限自动裁剪。
          </div>
          <textarea
            className="input"
            value={replaceCode}
            onChange={(event) => setReplaceCode(event.target.value)}
            placeholder="粘贴新的 dhc3_ 或旧版 dhc2_ 角色码"
            rows={5}
            style={{ resize: 'vertical', fontFamily: 'monospace' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" type="button" onClick={() => setReplacingCharacterId(null)}>取消</button>
            <button className="btn btn-primary" type="button" onClick={submitReplaceCharacter}>
              <RefreshCw size={14} /> 替换
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(deletingCharacter)} onClose={() => setDeletingCharacterId(null)} title="删除角色" maxWidth={520}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
            {deletingCharacter ? `确认删除「${getCharacterTitle(deletingCharacter)}」吗？此操作会立刻同步给房间内所有成员。` : ''}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" type="button" onClick={() => setDeletingCharacterId(null)}>取消</button>
            <button
              className="btn btn-primary"
              type="button"
              style={{ background: 'linear-gradient(180deg, #b12d3f, #8f1f34)', borderColor: '#8f1f34' }}
              onClick={() => {
                if (!deletingCharacter) return
                deleteMobileCharacter(deletingCharacter.id)
                setDeletingCharacterId(null)
                addToast('角色已删除。', 'success')
              }}
            >
              <Trash2 size={14} /> 删除
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={isLogOpen} onClose={() => setIsLogOpen(false)} title="活动日志" maxWidth={640}>
        <div style={{ display: 'grid', gap: 10, maxHeight: '70vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
          {panel.activity_log.length ? [...panel.activity_log].reverse().map((item) => (
            <div
              key={item.id}
              style={{
                padding: 12,
                border: '1px solid rgba(113, 88, 52, 0.12)',
                background: 'rgba(255,255,255,0.84)',
                display: 'grid',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{item.actor_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleString()}</div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{item.message}</div>
            </div>
          )) : (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>还没有活动记录。</div>
          )}
        </div>
      </Modal>
    </div>
  )
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: 14,
        background: 'rgba(250, 243, 233, 0.72)',
        border: '1px solid rgba(113, 88, 52, 0.12)',
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' }}>
        {icon}
        {title}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>{children}</div>
    </section>
  )
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  const blocks = parseMarkdownBlocks(body)

  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.82)',
        border: '1px solid rgba(113, 88, 52, 0.12)',
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ display: 'grid', gap: 8, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
        {blocks.length ? blocks.map((block, index) => {
          if (block.type === 'heading') {
            return (
              <div
                key={`${title}-heading-${index}`}
                style={{
                  fontSize: block.level <= 2 ? 14 : 13,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                }}
              >
                {renderMarkdownInline(block.text)}
              </div>
            )
          }

          if (block.type === 'divider') {
            return <div key={`${title}-divider-${index}`} style={{ height: 1, background: 'rgba(113, 88, 52, 0.16)' }} />
          }

          if (block.type === 'quote') {
            return (
              <blockquote
                key={`${title}-quote-${index}`}
                style={{
                  margin: 0,
                  padding: '4px 0 4px 12px',
                  borderLeft: '3px solid rgba(139, 94, 52, 0.35)',
                  color: 'var(--text-secondary)',
                }}
              >
                {renderMarkdownText(block.text)}
              </blockquote>
            )
          }

          if (block.type === 'list') {
            const ListTag = block.ordered ? 'ol' : 'ul'
            return (
              <ListTag
                key={`${title}-list-${index}`}
                style={{
                  margin: 0,
                  paddingLeft: block.ordered ? 20 : 18,
                  display: 'grid',
                  gap: 4,
                }}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${title}-list-${index}-${itemIndex}`}>{renderMarkdownText(item)}</li>
                ))}
              </ListTag>
            )
          }

          return (
            <p key={`${title}-paragraph-${index}`} style={{ margin: 0 }}>
              {renderMarkdownText(block.text)}
            </p>
          )
        }) : '无文本内容。'}
      </div>
    </div>
  )
}
