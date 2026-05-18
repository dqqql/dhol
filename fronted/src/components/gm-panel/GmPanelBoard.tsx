import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  GmPanelCharacterSheetEntry,
  GmPanelResourceKey,
  ResourceTrackerCountdown,
  ResourceTrackerSheet,
} from '@dhgc/shared'
import { BookOpen, ChevronLeft, ChevronRight, Edit3, FileUp, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { FloatingNotebook } from '@/components/notebook/FloatingNotebook'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '@/store/useStore'
import { buildSheetFromImportedCharacterData, cloneSheet, extractCharacterDataFromHtml, getTrackFilledCount } from '@/utils/gmPanel'

const ATTRIBUTES: Array<{ key: keyof ResourceTrackerSheet['stats']['attributes']; label: string }> = [
  { key: 'agility', label: '敏捷' },
  { key: 'strength', label: '力量' },
  { key: 'finesse', label: '灵巧' },
  { key: 'instinct', label: '本能' },
  { key: 'presence', label: '风度' },
  { key: 'knowledge', label: '知识' },
]

export function GmPanelBoard() {
  const {
    room,
    importGmCharacter,
    replaceGmCharacter,
    updateGmSheet,
    updateGmResource,
    updateGmFear,
    createGmCountdown,
    updateGmCountdown,
    deleteGmCountdown,
    moveGmSheet,
    updateGmCardsPerPage,
    addToast,
  } = useStore()
  const [currentPage, setCurrentPage] = useState(0)
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null)
  const [editingSheet, setEditingSheet] = useState<ResourceTrackerSheet | null>(null)
  const [countdownName, setCountdownName] = useState('')
  const [countdownMax, setCountdownMax] = useState('6')
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)

  if (!room || room.room_type !== 'gm-panel' || !room.gm_panel) return null

  const panel = room.gm_panel
  const orderedSheets = panel.sheet_order
    .map((sheetId) => panel.sheets.find((sheet) => sheet.id === sheetId) ?? null)
    .filter((sheet): sheet is GmPanelCharacterSheetEntry => Boolean(sheet))
  const pageCount = Math.max(1, Math.ceil(Math.max(orderedSheets.length, panel.cards_per_page) / panel.cards_per_page))
  const visibleSheets = orderedSheets.slice(currentPage * panel.cards_per_page, (currentPage + 1) * panel.cards_per_page)
  const slotEntries = Array.from({ length: panel.cards_per_page }, (_, index) => visibleSheets[index] ?? null)

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(0, pageCount - 1)))
  }, [pageCount])

  function openEditor(entry: GmPanelCharacterSheetEntry) {
    setEditingSheetId(entry.id)
    setEditingSheet(cloneSheet(entry.parsed_sheet))
  }

  function closeEditor() {
    setEditingSheetId(null)
    setEditingSheet(null)
  }

  async function handleFileImport(file: File, targetSheetId?: string | null) {
    try {
      const html = await file.text()
      const rawCharacterData = extractCharacterDataFromHtml(html)
      buildSheetFromImportedCharacterData(rawCharacterData, file.name)

      if (targetSheetId) {
        replaceGmCharacter(targetSheetId, file.name, rawCharacterData)
      } else {
        importGmCharacter(file.name, rawCharacterData)
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : '角色卡导入失败。', 'error')
    }
  }

  async function handleImportChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await handleFileImport(file)
  }

  async function handleReplaceChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const targetSheetId = replaceTargetId
    event.target.value = ''
    setReplaceTargetId(null)
    if (!file || !targetSheetId) return
    await handleFileImport(file, targetSheetId)
  }

  function saveEditor() {
    if (!editingSheetId || !editingSheet) return
    updateGmSheet(editingSheetId, editingSheet)
    closeEditor()
  }

  function submitCountdown() {
    const max = Math.max(2, Math.min(12, Number.parseInt(countdownMax, 10) || 6))
    createGmCountdown(countdownName.trim() || `进度钟 ${panel.countdowns.length + 1}`, max)
    setCountdownName('')
    setCountdownMax('6')
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: 'linear-gradient(180deg, #fffaf5 0%, #f5efe6 100%)',
      }}
    >
      <div style={{ padding: 20, display: 'grid', gap: 18 }}>
        <section
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            alignItems: 'start',
          }}
        >
          <FearPanel value={panel.fear.value} max={panel.fear.max} onChange={updateGmFear} />
          <CountdownPanel
            countdowns={panel.countdowns}
            draftName={countdownName}
            draftMax={countdownMax}
            onDraftNameChange={setCountdownName}
            onDraftMaxChange={setCountdownMax}
            onSubmit={submitCountdown}
            onUpdate={updateGmCountdown}
            onDelete={deleteGmCountdown}
          />
        </section>

        <section
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            padding: 16,
            borderRadius: 18,
            border: '1px solid rgba(124, 79, 49, 0.12)',
            background: 'rgba(255,255,255,0.86)',
            boxShadow: '0 16px 40px rgba(31, 41, 55, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => importInputRef.current?.click()}>
              <FileUp size={14} /> 导入角色卡 HTML
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 700 }}>每页卡数</span>
              <select
                className="input"
                value={panel.cards_per_page}
                onChange={(event) => updateGmCardsPerPage(Number(event.target.value))}
                style={{ width: 88 }}
              >
                {[2, 3, 4].map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}>
              <ChevronLeft size={14} /> 上一页
            </button>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#7c4f31' }}>
              第 {currentPage + 1} / {pageCount} 页
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage((page) => Math.min(pageCount - 1, page + 1))}>
              下一页 <ChevronRight size={14} />
            </button>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 999,
                border: '1px solid rgba(124, 79, 49, 0.14)',
                background: 'rgba(255, 247, 237, 0.9)',
                color: '#7c4f31',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <BookOpen size={14} />
              本地笔记已启用
            </div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: `repeat(auto-fit, minmax(${panel.cards_per_page >= 4 ? 280 : 320}px, 1fr))`,
          }}
        >
          {slotEntries.map((entry, index) => (
            entry ? (
              <CharacterSheetCard
                key={entry.id}
                entry={entry}
                isFirst={index === 0 && currentPage === 0}
                isLast={index === visibleSheets.length - 1 && currentPage === pageCount - 1}
                onMoveLeft={() => moveGmSheet(entry.id, 'left')}
                onMoveRight={() => moveGmSheet(entry.id, 'right')}
                onReplace={() => {
                  setReplaceTargetId(entry.id)
                  replaceInputRef.current?.click()
                }}
                onEdit={() => openEditor(entry)}
                onUpdateResource={(resourceKey, nextValue) => updateGmResource(entry.id, resourceKey, nextValue)}
              />
            ) : (
              <EmptySlotCard
                key={`empty-${currentPage}-${index}`}
                onImport={() => importInputRef.current?.click()}
              />
            )
          ))}
        </section>

        <ActivityLogPanel logs={panel.activity_log} />
      </div>

      <FloatingNotebook roomId={room.room_id} />

      <input ref={importInputRef} type="file" accept=".html,text/html" style={{ display: 'none' }} onChange={handleImportChange} />
      <input ref={replaceInputRef} type="file" accept=".html,text/html" style={{ display: 'none' }} onChange={handleReplaceChange} />

      <Modal open={Boolean(editingSheet)} onClose={closeEditor} title="编辑角色卡" maxWidth={980}>
        {editingSheet && (
          <SheetEditor
            sheet={editingSheet}
            onChange={setEditingSheet}
            onCancel={closeEditor}
            onSave={saveEditor}
          />
        )}
      </Modal>
    </div>
  )
}

function FearPanel({ value, max, onChange }: { value: number; max: number; onChange: (value: number) => void }) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 20,
        border: '1px solid rgba(225, 29, 72, 0.18)',
        background: 'linear-gradient(180deg, rgba(255,241,242,0.98), rgba(255,247,237,0.96))',
        boxShadow: '0 18px 36px rgba(225, 29, 72, 0.08)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#e11d48', marginBottom: 6 }}>GM 资源</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 46, fontWeight: 900, color: '#4c0519', lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#fb7185' }}>/ {max}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onChange(Math.max(0, value - 1))}>-1</button>
          <button className="btn btn-primary btn-sm" onClick={() => onChange(Math.min(max, value + 1))}>+1</button>
          <button className="btn btn-secondary btn-sm" onClick={() => onChange(0)}>
            <RefreshCw size={13} /> 重置
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${max}, minmax(20px, 1fr))`, gap: 6 }}>
        {Array.from({ length: max }, (_, index) => {
          const step = index + 1
          const active = step <= value
          return (
            <button
              key={step}
              type="button"
              onClick={() => onChange(step)}
              style={{
                height: 18,
                borderRadius: 999,
                border: '1px solid rgba(225, 29, 72, 0.14)',
                background: active ? '#e11d48' : 'rgba(255,255,255,0.74)',
                cursor: 'pointer',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function CountdownPanel(props: {
  countdowns: ResourceTrackerCountdown[]
  draftName: string
  draftMax: string
  onDraftNameChange: (value: string) => void
  onDraftMaxChange: (value: string) => void
  onSubmit: () => void
  onUpdate: (countdownId: string, value: number) => void
  onDelete: (countdownId: string) => void
}) {
  const {
    countdowns,
    draftName,
    draftMax,
    onDraftNameChange,
    onDraftMaxChange,
    onSubmit,
    onUpdate,
    onDelete,
  } = props

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 20,
        border: '1px solid rgba(124, 79, 49, 0.12)',
        background: 'rgba(255,255,255,0.92)',
        boxShadow: '0 18px 36px rgba(31, 41, 55, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1f2937' }}>进度钟</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>{countdowns.length} 个</div>
      </div>

      <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
        {countdowns.map((countdown) => (
          <div
            key={countdown.id}
            style={{
              padding: 12,
              borderRadius: 14,
              border: '1px solid rgba(245, 158, 11, 0.18)',
              background: 'linear-gradient(180deg, rgba(255,251,235,0.96), rgba(255,247,237,0.92))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>{countdown.name}</div>
              <button type="button" onClick={() => onDelete(countdown.id)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => onUpdate(countdown.id, Math.max(0, countdown.value - 1))}>-</button>
              <div style={{ minWidth: 72, textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#7c4f31' }}>
                {countdown.value} / {countdown.max}
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => onUpdate(countdown.id, Math.min(countdown.max, countdown.value + 1))}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px auto', gap: 8 }}>
        <input className="input" value={draftName} onChange={(event) => onDraftNameChange(event.target.value)} placeholder="新进度钟名称" />
        <input className="input" value={draftMax} onChange={(event) => onDraftMaxChange(event.target.value)} placeholder="6" />
        <button className="btn btn-secondary" onClick={onSubmit}>
          <Plus size={14} /> 新增
        </button>
      </div>
    </div>
  )
}

function CharacterSheetCard(props: {
  entry: GmPanelCharacterSheetEntry
  isFirst: boolean
  isLast: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
  onReplace: () => void
  onEdit: () => void
  onUpdateResource: (resourceKey: GmPanelResourceKey, nextValue: number | boolean[]) => void
}) {
  const { entry, isFirst, isLast, onMoveLeft, onMoveRight, onReplace, onEdit, onUpdateResource } = props
  const sheet = entry.parsed_sheet

  return (
    <article
      style={{
        minHeight: 680,
        maxHeight: 'calc(100vh - 290px)',
        overflowY: 'auto',
        padding: 16,
        borderRadius: 20,
        border: '1px solid rgba(124, 79, 49, 0.12)',
        background: 'rgba(255,255,255,0.92)',
        boxShadow: '0 18px 36px rgba(31, 41, 55, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1f2937', marginBottom: 6 }}>
            {sheet.character_name}
          </div>
          <div style={{ fontSize: 13, color: '#7c4f31', fontWeight: 700, marginBottom: 4 }}>{sheet.summary_line || '暂无摘要'}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{entry.source_file_name}</div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={onReplace}>
            <RefreshCw size={13} /> 替换
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onEdit}>
            <Edit3 size={13} /> 编辑
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" disabled={isFirst} onClick={onMoveLeft}>
              <ChevronLeft size={13} />
            </button>
            <button className="btn btn-secondary btn-sm" disabled={isLast} onClick={onMoveRight}>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <HopePanel
            value={sheet.resources.hope}
            max={sheet.resources.hope_max}
            onChange={(value) => onUpdateResource('hope', value)}
          />
          <ResourceCountCard
            title="熟练"
            count={`${getTrackFilledCount(sheet.resources.proficiency)}/${sheet.resources.proficiency.length}`}
          >
            <SquareTrack value={sheet.resources.proficiency} onChange={(value) => onUpdateResource('proficiency', value)} />
          </ResourceCountCard>
          <ResourceCountCard
            title="生命"
            count={`${getTrackFilledCount(sheet.resources.hp)}/${sheet.resources.hp_max}`}
          >
            <SquareTrack value={sheet.resources.hp} onChange={(value) => onUpdateResource('hp', value)} />
          </ResourceCountCard>
          <ResourceCountCard
            title="压力"
            count={`${getTrackFilledCount(sheet.resources.stress)}/${sheet.resources.stress_max}`}
          >
            <CircleTrack value={sheet.resources.stress} onChange={(value) => onUpdateResource('stress', value)} />
          </ResourceCountCard>
          <ResourceCountCard
            title="护甲槽"
            count={`${getTrackFilledCount(sheet.resources.armor_slots)}/${sheet.resources.armor_max}`}
          >
            <SquareTrack value={sheet.resources.armor_slots} onChange={(value) => onUpdateResource('armor_slots', value)} />
          </ResourceCountCard>
          <GoldPanel value={sheet.resources.gold} onChange={(value) => onUpdateResource('gold', value)} />
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: '1px solid rgba(124, 79, 49, 0.12)',
            background: 'linear-gradient(180deg, rgba(255,251,235,0.9), rgba(255,255,255,0.96))',
          }}
        >
          <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 800, color: '#7c4f31' }}>基础数值</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <Field label="等级" value={sheet.identity.level} />
            <Field label="闪避" value={sheet.stats.evasion} />
            <Field label="护甲值" value={sheet.stats.armor_value} />
            <Field label="重伤阈值" value={sheet.stats.minor_threshold} />
            <Field label="严重阈值" value={sheet.stats.major_threshold} />
            <Field label="主属性" value={sheet.identity.primary_trait} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 10 }}>
            {ATTRIBUTES.map((attribute) => (
              <Field key={attribute.key} label={attribute.label} value={sheet.stats.attributes[attribute.key]} />
            ))}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: '1px solid rgba(124, 79, 49, 0.12)',
            background: 'rgba(255,255,255,0.96)',
          }}
        >
          <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 800, color: '#7c4f31' }}>叙事摘要</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <SummaryRow label="种族" value={sheet.identity.ancestry} />
            <SummaryRow label="职业" value={sheet.identity.profession} />
            <SummaryRow label="社群" value={sheet.identity.community} />
            <SummaryRow label="子职业" value={sheet.identity.subclass} />
            <SummaryRow label="背景" value={sheet.narrative.background} />
            <SummaryRow label="外貌" value={sheet.narrative.appearance} />
            <SummaryRow label="动机" value={sheet.narrative.motivation} />
            <SummaryRow label="角色笔记" value={sheet.narrative.notes} />
          </div>
        </div>
      </div>
    </article>
  )
}

function EmptySlotCard({ onImport }: { onImport: () => void }) {
  return (
    <button
      type="button"
      onClick={onImport}
      style={{
        minHeight: 680,
        borderRadius: 20,
        border: '2px dashed rgba(124, 79, 49, 0.22)',
        background: 'rgba(255,255,255,0.56)',
        color: '#7c4f31',
        cursor: 'pointer',
        fontSize: 15,
        fontWeight: 800,
      }}
    >
      导入角色卡
    </button>
  )
}

function ActivityLogPanel({ logs }: { logs: Array<{ id: string; created_at: string; actor_name: string; message: string }> }) {
  return (
    <section
      style={{
        padding: 16,
        borderRadius: 18,
        border: '1px solid rgba(124, 79, 49, 0.12)',
        background: 'rgba(255,255,255,0.9)',
        boxShadow: '0 16px 40px rgba(31, 41, 55, 0.08)',
      }}
    >
      <div style={{ marginBottom: 12, fontSize: 15, fontWeight: 800, color: '#1f2937' }}>活动记录</div>
      <div style={{ display: 'grid', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
        {logs.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9ca3af' }}>还没有记录。</div>
        ) : (
          [...logs].reverse().map((log) => (
            <div key={log.id} style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#7c4f31' }}>{log.actor_name}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{formatTime(log.created_at)}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#1f2937' }}>{log.message}</div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function SheetEditor(props: {
  sheet: ResourceTrackerSheet
  onChange: (sheet: ResourceTrackerSheet) => void
  onCancel: () => void
  onSave: () => void
}) {
  const { sheet, onChange, onCancel, onSave } = props

  const update = <T extends keyof ResourceTrackerSheet>(key: T, value: ResourceTrackerSheet[T]) => {
    onChange({ ...sheet, [key]: value })
  }

  const updateIdentity = (key: keyof ResourceTrackerSheet['identity'], value: string) => {
    update('identity', { ...sheet.identity, [key]: value })
  }

  const updateStatsField = (key: Exclude<keyof ResourceTrackerSheet['stats'], 'attributes'>, value: string) => {
    update('stats', { ...sheet.stats, [key]: value })
  }

  const updateAttribute = (key: keyof ResourceTrackerSheet['stats']['attributes'], value: string) => {
    update('stats', {
      ...sheet.stats,
      attributes: { ...sheet.stats.attributes, [key]: value },
    })
  }

  const updateEquipment = (key: keyof ResourceTrackerSheet['equipment'], value: string) => {
    update('equipment', { ...sheet.equipment, [key]: value })
  }

  const updateNarrativeField = (key: Exclude<keyof ResourceTrackerSheet['narrative'], 'experiences'>, value: string) => {
    update('narrative', { ...sheet.narrative, [key]: value })
  }

  const updateExperience = (index: number, key: 'name' | 'value', value: string) => {
    update('narrative', {
      ...sheet.narrative,
      experiences: sheet.narrative.experiences.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      )),
    })
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <EditorField label="角色名" value={sheet.character_name} onChange={(value) => update('character_name', value)} />
        <EditorField label="摘要" value={sheet.summary_line} onChange={(value) => update('summary_line', value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <EditorField label="等级" value={sheet.identity.level} onChange={(value) => updateIdentity('level', value)} />
        <EditorField label="闪避" value={sheet.stats.evasion} onChange={(value) => updateStatsField('evasion', value)} />
        <EditorField label="护甲值" value={sheet.stats.armor_value} onChange={(value) => updateStatsField('armor_value', value)} />
        <EditorField label="重伤阈值" value={sheet.stats.minor_threshold} onChange={(value) => updateStatsField('minor_threshold', value)} />
        <EditorField label="严重阈值" value={sheet.stats.major_threshold} onChange={(value) => updateStatsField('major_threshold', value)} />
        <EditorField label="主属性" value={sheet.identity.primary_trait} onChange={(value) => updateIdentity('primary_trait', value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <EditorField label="种族" value={sheet.identity.ancestry} onChange={(value) => updateIdentity('ancestry', value)} />
        <EditorField label="职业" value={sheet.identity.profession} onChange={(value) => updateIdentity('profession', value)} />
        <EditorField label="社群" value={sheet.identity.community} onChange={(value) => updateIdentity('community', value)} />
        <EditorField label="子职业" value={sheet.identity.subclass} onChange={(value) => updateIdentity('subclass', value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {ATTRIBUTES.map((attribute) => (
          <EditorField
            key={attribute.key}
            label={attribute.label}
            value={sheet.stats.attributes[attribute.key]}
            onChange={(value) => updateAttribute(attribute.key, value)}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <EditorField label="主武器" value={sheet.equipment.primary_weapon_name} onChange={(value) => updateEquipment('primary_weapon_name', value)} />
        <EditorField label="副武器" value={sheet.equipment.secondary_weapon_name} onChange={(value) => updateEquipment('secondary_weapon_name', value)} />
        <EditorField label="主武器属性/范围" value={sheet.equipment.primary_weapon_trait} onChange={(value) => updateEquipment('primary_weapon_trait', value)} />
        <EditorField label="副武器属性/范围" value={sheet.equipment.secondary_weapon_trait} onChange={(value) => updateEquipment('secondary_weapon_trait', value)} />
        <EditorField label="主武器伤害" value={sheet.equipment.primary_weapon_damage} onChange={(value) => updateEquipment('primary_weapon_damage', value)} />
        <EditorField label="副武器伤害" value={sheet.equipment.secondary_weapon_damage} onChange={(value) => updateEquipment('secondary_weapon_damage', value)} />
        <EditorField label="主武器特性" value={sheet.equipment.primary_weapon_feature} onChange={(value) => updateEquipment('primary_weapon_feature', value)} />
        <EditorField label="副武器特性" value={sheet.equipment.secondary_weapon_feature} onChange={(value) => updateEquipment('secondary_weapon_feature', value)} />
        <EditorField label="护甲名称" value={sheet.equipment.armor_name} onChange={(value) => updateEquipment('armor_name', value)} />
        <EditorField label="基础护甲" value={sheet.equipment.armor_base_score} onChange={(value) => updateEquipment('armor_base_score', value)} />
        <EditorField label="护甲阈值" value={sheet.equipment.armor_threshold} onChange={(value) => updateEquipment('armor_threshold', value)} />
        <EditorField label="护甲特性" value={sheet.equipment.armor_feature} onChange={(value) => updateEquipment('armor_feature', value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {sheet.narrative.experiences.map((item, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
            <EditorField label={`经历 ${index + 1}`} value={item.name} onChange={(value) => updateExperience(index, 'name', value)} />
            <EditorField label="值" value={item.value} onChange={(value) => updateExperience(index, 'value', value)} />
          </div>
        ))}
      </div>

      <EditorArea label="背景" value={sheet.narrative.background} onChange={(value) => updateNarrativeField('background', value)} />
      <EditorArea label="外貌" value={sheet.narrative.appearance} onChange={(value) => updateNarrativeField('appearance', value)} />
      <EditorArea label="动机" value={sheet.narrative.motivation} onChange={(value) => updateNarrativeField('motivation', value)} />
      <EditorArea label="角色笔记" value={sheet.narrative.notes} onChange={(value) => updateNarrativeField('notes', value)} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-secondary" onClick={onCancel}>取消</button>
        <button className="btn btn-primary" onClick={onSave}>保存</button>
      </div>
    </div>
  )
}

function EditorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function EditorArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{label}</span>
      <textarea
        className="input"
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ minHeight: 110, resize: 'vertical', paddingTop: 10 }}
      />
    </label>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#64748b' }}>{label}</div>
      <div
        style={{
          minHeight: 34,
          padding: '8px 10px',
          borderRadius: 10,
          border: '1px solid rgba(148, 163, 184, 0.2)',
          background: 'white',
          color: value ? '#0f172a' : '#94a3b8',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {value || '-'}
      </div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 700, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: value ? '#1f2937' : '#94a3b8', whiteSpace: 'pre-wrap' }}>
        {value || '未填写'}
      </div>
    </div>
  )
}

function ResourceCountCard(props: { title: string; count: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: '1px solid rgba(124, 79, 49, 0.12)',
        background: 'linear-gradient(180deg, rgba(255,251,235,0.9), rgba(255,255,255,0.96))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#7c4f31' }}>{props.title}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{props.count}</span>
      </div>
      {props.children}
    </div>
  )
}

function HopePanel({ value, max, onChange }: { value: number; max: number; onChange: (value: number) => void }) {
  return (
    <ResourceCountCard title="希望" count={`${value}/${max}`}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {Array.from({ length: max }, (_, index) => {
          const filled = index < value
          return (
            <button
              key={index}
              type="button"
              onClick={() => onChange(filled && index === value - 1 ? index : index + 1)}
              style={{
                width: 18,
                height: 18,
                transform: 'rotate(45deg)',
                border: '2px solid #7c4f31',
                background: filled ? '#7c4f31' : 'white',
                cursor: 'pointer',
              }}
            />
          )
        })}
      </div>
    </ResourceCountCard>
  )
}

function SquareTrack({ value, onChange }: { value: boolean[]; onChange: (value: boolean[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {value.map((filled, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onChange(updateTrack(value, index))}
          style={{
            width: 14,
            height: 14,
            border: '1px solid rgba(124, 79, 49, 0.8)',
            background: filled ? '#7c4f31' : 'white',
            cursor: 'pointer',
          }}
        />
      ))}
    </div>
  )
}

function CircleTrack({ value, onChange }: { value: boolean[]; onChange: (value: boolean[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {value.map((filled, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onChange(updateTrack(value, index))}
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '1px solid rgba(124, 79, 49, 0.8)',
            background: filled ? '#7c4f31' : 'white',
            cursor: 'pointer',
          }}
        />
      ))}
    </div>
  )
}

function GoldPanel({ value, onChange }: { value: boolean[]; onChange: (value: boolean[]) => void }) {
  const filled = getTrackFilledCount(value)

  return (
    <ResourceCountCard title="金币" count={`${filled}/${value.length}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onChange(updateTrackByCount(value, Math.max(0, filled - 1)))}>-</button>
        <div style={{ minWidth: 64, textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#7c4f31' }}>{filled}</div>
        <button className="btn btn-primary btn-sm" onClick={() => onChange(updateTrackByCount(value, Math.min(value.length, filled + 1)))}>+</button>
      </div>
    </ResourceCountCard>
  )
}

function updateTrack(track: boolean[], index: number) {
  const shouldDecrease = track[index] && track.slice(index + 1).every((item) => !item)
  return track.map((_, itemIndex) => (shouldDecrease ? itemIndex < index : itemIndex <= index))
}

function updateTrackByCount(track: boolean[], filledCount: number) {
  return track.map((_, index) => index < filledCount)
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
