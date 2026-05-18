import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ResourceTrackerCharacterColumn,
  ResourceTrackerCountdown,
  ResourceTrackerResourceChangeRequest,
  ResourceTrackerResourceKey,
  ResourceTrackerSheet,
} from '@dhgc/shared'
import { Check, ChevronLeft, ChevronRight, Edit3, Plus, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '@/store/useStore'
import { buildTrackerSheetFromCharacterJson, cloneTrackerSheet, getTrackFilledCount } from '@/utils/resourceTracker'

const ATTRIBUTES: Array<{ key: keyof ResourceTrackerSheet['stats']['attributes']; label: string }> = [
  { key: 'agility', label: '敏捷' },
  { key: 'strength', label: '力量' },
  { key: 'finesse', label: '灵巧' },
  { key: 'instinct', label: '本能' },
  { key: 'presence', label: '风度' },
  { key: 'knowledge', label: '知识' },
]

const SURFACE_BORDER = '1px solid rgba(15, 23, 42, 0.08)'
const SURFACE_SHADOW = '0 12px 28px rgba(15, 23, 42, 0.08)'

export function ResourceTrackerBoard() {
  const {
    room,
    currentPlayerId,
    importTrackerCharacter,
    updateTrackerSheet,
    updateTrackerResource,
    updateTrackerFear,
    createTrackerCountdown,
    updateTrackerCountdown,
    deleteTrackerCountdown,
    moveTrackerColumn,
    approveTrackerResourceRequest,
    rejectTrackerResourceRequest,
    addToast,
  } = useStore()
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingSheet, setEditingSheet] = useState<ResourceTrackerSheet | null>(null)
  const [isUploadDragging, setIsUploadDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (!room || room.room_type !== 'resource-tracker' || !room.resource_tracker) return null

  const tracker = room.resource_tracker
  const isHost = room.host_player_id === currentPlayerId
  const myColumn = tracker.columns.find((column) => column.owner_player_id === currentPlayerId) ?? null
  const orderedColumns = tracker.column_order
    .map((columnId) => tracker.columns.find((column) => column.id === columnId) ?? null)
    .filter((column): column is ResourceTrackerCharacterColumn => Boolean(column))

  async function importCharacterFile(file: File) {
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const sheet = buildTrackerSheetFromCharacterJson(parsed, file.name)
      importTrackerCharacter(file.name, sheet)
      addToast(`成功导入 ${sheet.character_name}。`, 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : '角色卡导入失败', 'error')
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await importCharacterFile(file)
  }

  async function handleUploadDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsUploadDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    await importCharacterFile(file)
  }

  function openEditor(column: ResourceTrackerCharacterColumn) {
    setEditingColumnId(column.id)
    setEditingSheet(cloneTrackerSheet(column.sheet))
  }

  function closeEditor() {
    setEditingColumnId(null)
    setEditingSheet(null)
  }

  function saveEditor() {
    if (!editingColumnId || !editingSheet) return
    updateTrackerSheet(editingColumnId, editingSheet)
    closeEditor()
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'auto',
        background: 'linear-gradient(180deg, #eef2f7 0%, #e9edf4 100%)',
      }}
    >
      <div
        style={{
          minHeight: '100%',
          padding: '22px 22px 160px',
          boxSizing: 'border-box',
        }}
      >
        <TrackerFearBar
          value={tracker.fear.value}
          max={tracker.fear.max}
          countdowns={tracker.countdowns}
          editable={isHost}
          onChange={updateTrackerFear}
          onCreateCountdown={createTrackerCountdown}
          onUpdateCountdown={updateTrackerCountdown}
          onDeleteCountdown={deleteTrackerCountdown}
        />

        {!isHost && !myColumn && (
          <div
            style={{
              width: 420,
              maxWidth: '100%',
              margin: '28px auto 0',
              padding: 18,
              borderRadius: 18,
              background: 'rgba(255,255,255,0.9)',
              border: isUploadDragging
                ? '1px dashed rgba(37, 99, 235, 0.55)'
                : '1px dashed rgba(226, 62, 87, 0.28)',
              textAlign: 'left',
              transform: isUploadDragging ? 'translateY(-2px)' : 'none',
              transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
              boxShadow: isUploadDragging
                ? '0 16px 30px rgba(37, 99, 235, 0.12)'
                : SURFACE_SHADOW,
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setIsUploadDragging(true)
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
              setIsUploadDragging(false)
            }}
            onDrop={handleUploadDrop}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>上传角色卡</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: '#64748b', marginBottom: 14 }}>
              选择或拖动上传json格式的角色卡
            </div>
            <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> 上传角色卡 JSON
            </button>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 18,
            alignItems: 'flex-start',
            marginTop: 18,
            minWidth: 'max-content',
          }}
        >
          {orderedColumns.map((column, index) => {
            const owner = room.players.find((player) => player.id === column.owner_player_id)
            const canEdit = isHost || column.owner_player_id === currentPlayerId

            return (
              <ColumnCard
                key={column.id}
                column={column}
                ownerName={owner?.nickname ?? '玩家'}
                ownerColor={owner?.color ?? '#f43f5e'}
                isHost={isHost}
                canEdit={canEdit}
                isFirst={index === 0}
                isLast={index === orderedColumns.length - 1}
                onMoveLeft={() => moveTrackerColumn(column.id, 'left')}
                onMoveRight={() => moveTrackerColumn(column.id, 'right')}
                onOpenEditor={() => openEditor(column)}
                onUpdateSheet={(nextSheet) => updateTrackerSheet(column.id, nextSheet)}
                onResourceChange={(resourceKey, nextValue) => updateTrackerResource(column.id, resourceKey, nextValue)}
              />
            )
          })}
        </div>
      </div>

      {isHost && tracker.pending_resource_requests.length > 0 && (
        <PendingPanel
          requests={tracker.pending_resource_requests}
          columns={tracker.columns}
          onApprove={approveTrackerResourceRequest}
          onReject={rejectTrackerResourceRequest}
        />
      )}

      <ActivityPanel logs={tracker.activity_log} />

      <input ref={fileInputRef} type="file" accept=".json" onChange={handleUpload} style={{ display: 'none' }} />

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

function FearBar({
  value,
  max,
  editable,
  onChange,
}: {
  value: number
  max: number
  editable: boolean
  onChange: (value: number) => void
}) {
  return (
    <section
      style={{
        padding: 16,
        borderRadius: 18,
        border: '1px solid rgba(251, 113, 133, 0.28)',
        background: 'linear-gradient(90deg, rgba(255,241,242,0.98), rgba(255,248,235,0.96))',
        boxShadow: '0 10px 26px rgba(251, 113, 133, 0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: 999,
                background: '#e11d48',
                color: 'white',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.02em',
              }}
            >
              GM 资源
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#e11d48' }}>恐惧点</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 48, lineHeight: 1, fontWeight: 900, color: '#4c0519' }}>{value}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f43f5e' }}>/ {max}</span>
          </div>
          {editable && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#ef4444' }}>点击进度格可设置当前恐惧点。</div>
          )}
        </div>

        {editable && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-sm"
              onClick={() => onChange(Math.max(0, value - 1))}
              style={{
                background: '#16a34a',
                borderColor: '#16a34a',
                color: 'white',
              }}
            >
              - 暗影消散
            </button>
            <button
              className="btn btn-sm"
              onClick={() => onChange(Math.min(max, value + 1))}
              style={{
                background: '#e11d48',
                borderColor: '#e11d48',
                color: 'white',
              }}
            >
              + 恐惧滋生
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onChange(0)}>
              <RotateCcw size={13} /> 重置
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${max}, minmax(56px, 1fr))`,
          gap: 8,
        }}
      >
        {Array.from({ length: max }).map((_, index) => {
          const step = index + 1
          const active = step <= value
          const opacity = 0.12 + (index / Math.max(1, max - 1)) * 0.88

          return (
            <button
              key={step}
              type="button"
              disabled={!editable}
              onClick={() => editable && onChange(step)}
              style={{
                height: 42,
                borderRadius: 10,
                border: active ? '1px solid rgba(244,63,94,0.35)' : '1px solid rgba(251,113,133,0.2)',
                background: active ? `rgba(225, 29, 72, ${opacity})` : 'rgba(255,255,255,0.45)',
                color: active ? 'white' : '#e11d48',
                fontSize: 13,
                fontWeight: 800,
                cursor: editable ? 'pointer' : 'default',
              }}
            >
              {step}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function TrackerFearBar({
  value,
  max,
  countdowns,
  editable,
  onChange,
  onCreateCountdown,
  onUpdateCountdown,
  onDeleteCountdown,
}: {
  value: number
  max: number
  countdowns: ResourceTrackerCountdown[]
  editable: boolean
  onChange: (value: number) => void
  onCreateCountdown: (name: string, max: number) => void
  onUpdateCountdown: (countdownId: string, value: number) => void
  onDeleteCountdown: (countdownId: string) => void
}) {
  const [showCreator, setShowCreator] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftMax, setDraftMax] = useState('6')
  const [visibleStart, setVisibleStart] = useState(0)
  const visibleCount = 6
  const maxStart = Math.max(0, countdowns.length - visibleCount)
  const visibleCountdowns = countdowns.slice(visibleStart, visibleStart + visibleCount)
  const activeCountdown = visibleCountdowns[0] ?? null
  const hasOverflow = countdowns.length > visibleCount

  useEffect(() => {
    setVisibleStart((current) => Math.min(current, maxStart))
  }, [maxStart])

  useEffect(() => {
    if (!editable) setShowCreator(false)
  }, [editable])

  function submitCountdown() {
    const normalizedName = draftName.trim() || `倒计时 ${countdowns.length + 1}`
    const parsedMax = Number.parseInt(draftMax, 10)
    const normalizedMax = Number.isFinite(parsedMax) ? Math.min(12, Math.max(2, parsedMax)) : 6
    onCreateCountdown(normalizedName, normalizedMax)
    setDraftName('')
    setDraftMax('6')
    setShowCreator(false)
  }

  return (
    <section
      style={{
        padding: 14,
        borderRadius: 22,
        border: '1px solid rgba(251, 146, 60, 0.18)',
        background: 'linear-gradient(180deg, rgba(255,246,244,0.98), rgba(255,251,245,0.96))',
        boxShadow: '0 18px 40px rgba(251, 113, 133, 0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 18,
            alignItems: 'flex-start',
            flex: '1 1 720px',
            minWidth: 0,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              width: 180,
              maxWidth: '100%',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: '#e11d48',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                }}
              >
                GM 资源
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e11d48' }}>恐惧点</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontSize: 54, lineHeight: 0.95, fontWeight: 900, color: '#5b1021' }}>{value}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#f43f5e' }}>/ {max}</span>
            </div>
            {editable && (
              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, color: '#fb7185' }}>
                点击进度格可设置当前恐惧点。
              </div>
            )}
          </div>

          <div
            style={{
              flex: '1 1 420px',
              minWidth: 280,
              paddingTop: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1f2937' }}>进度钟</div>
                {editable && (
                <button
                  type="button"
                  onClick={() => setShowCreator((current) => !current)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#6b7280',
                    cursor: 'pointer',
                  }}
                >
                  <Edit3 size={12} /> 管理
                </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 20 }}>
                {hasOverflow && (
                  <>
                    <IconButton title="上一个倒计时" onClick={() => setVisibleStart((current) => Math.max(0, current - 1))} disabled={visibleStart === 0}>
                      <ChevronLeft size={14} />
                    </IconButton>
                    <IconButton
                      title="下一个倒计时"
                      onClick={() => setVisibleStart((current) => Math.min(maxStart, current + 1))}
                      disabled={visibleStart >= maxStart}
                    >
                      <ChevronRight size={14} />
                    </IconButton>
                  </>
                )}
                {countdowns.length > visibleCount && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>
                    {visibleStart + 1}-{Math.min(visibleStart + visibleCount, countdowns.length)} / {countdowns.length}
                  </div>
                )}
              </div>
            </div>

            {visibleCountdowns.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'nowrap',
                  gap: 10,
                  alignItems: 'start',
                }}
              >
                {visibleCountdowns.map((countdown) => (
                  <div
                    key={countdown.id}
                    style={{
                      width: 'fit-content',
                      maxWidth: '100%',
                      flex: '0 0 auto',
                      padding: 12,
                      borderRadius: 14,
                      border: '1px solid rgba(245, 158, 11, 0.28)',
                      background: 'linear-gradient(180deg, rgba(255,251,235,0.96), rgba(255,247,237,0.92))',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#92400e',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {countdown.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#b45309' }}>
                          {countdown.value}
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#d97706' }}> / {countdown.max}</span>
                        </div>
                        {editable && (
                          <IconButton title="删除倒计时" onClick={() => onDeleteCountdown(countdown.id)}>
                            <Trash2 size={14} />
                          </IconButton>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
                      {Array.from({ length: countdown.max }).map((_, index) => {
                        const step = index + 1
                        const filled = step <= countdown.value
                        const nextValue = countdown.value === step ? step - 1 : step
                        const showConnector = index < countdown.max - 1
                        const connectorFilled = step < countdown.value

                        return editable ? (
                          <div
                            key={`${countdown.id}-${step}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => onUpdateCountdown(countdown.id, nextValue)}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                border: filled ? '2px solid rgba(245, 158, 11, 0.92)' : '2px solid rgba(253, 230, 138, 0.95)',
                                background: filled ? 'radial-gradient(circle at 35% 35%, #fde68a, #fbbf24 58%, #f59e0b)' : 'rgba(255,255,255,0.95)',
                                boxShadow: filled ? '0 3px 8px rgba(245, 158, 11, 0.22)' : 'none',
                                cursor: 'pointer',
                              }}
                            />
                            {showConnector && (
                              <div
                                style={{
                                  width: 12,
                                  height: 2,
                                  marginInline: 2,
                                  borderRadius: 999,
                                  background: connectorFilled ? 'rgba(245, 158, 11, 0.72)' : 'rgba(253, 230, 138, 0.9)',
                                }}
                              />
                            )}
                          </div>
                        ) : (
                          <div
                            key={`${countdown.id}-${step}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 999,
                                border: filled ? '2px solid rgba(245, 158, 11, 0.92)' : '2px solid rgba(253, 230, 138, 0.95)',
                                background: filled ? 'radial-gradient(circle at 35% 35%, #fde68a, #fbbf24 58%, #f59e0b)' : 'rgba(255,255,255,0.95)',
                                boxShadow: filled ? '0 3px 8px rgba(245, 158, 11, 0.22)' : 'none',
                              }}
                            />
                            {showConnector && (
                              <div
                                style={{
                                  width: 12,
                                  height: 2,
                                  marginInline: 2,
                                  borderRadius: 999,
                                  background: connectorFilled ? 'rgba(245, 158, 11, 0.72)' : 'rgba(253, 230, 138, 0.9)',
                                }}
                              />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  minHeight: 28,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#c08457',
                }}
              >
                {editable ? '还没有进度钟，点击“管理”新增。' : 'GM 还没有添加进度钟。'}
              </div>
            )}
          </div>
        </div>

        {editable && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
            <button
              className="btn btn-sm"
              onClick={() => onChange(Math.max(0, value - 1))}
              style={{
                background: '#16a34a',
                borderColor: '#16a34a',
                color: 'white',
                minHeight: 30,
                paddingInline: 14,
                boxShadow: '0 6px 18px rgba(22, 163, 74, 0.18)',
              }}
            >
              - 暗影消散
            </button>
            <button
              className="btn btn-sm"
              onClick={() => onChange(Math.min(max, value + 1))}
              style={{
                background: '#e11d48',
                borderColor: '#e11d48',
                color: 'white',
                minHeight: 30,
                paddingInline: 14,
                boxShadow: '0 6px 18px rgba(225, 29, 72, 0.2)',
              }}
            >
              + 恐惧滋生
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => onChange(0)} style={{ minHeight: 30, paddingInline: 12 }}>
              <RotateCcw size={13} /> 重置
            </button>
          </div>
        )}
      </div>

      {showCreator && editable && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 16,
            border: '1px solid rgba(251, 191, 36, 0.28)',
            background: 'linear-gradient(180deg, rgba(255,251,235,0.94), rgba(255,247,237,0.96))',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#7c2d12' }}>倒计时管理</div>
              {activeCountdown && (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9a3412' }}>
                  当前: {activeCountdown.name}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {hasOverflow && (
                <>
                  <IconButton title="上一个倒计时" onClick={() => setVisibleStart((current) => Math.max(0, current - 1))} disabled={visibleStart === 0}>
                    <ChevronLeft size={14} />
                  </IconButton>
                  <IconButton
                    title="下一个倒计时"
                    onClick={() => setVisibleStart((current) => Math.min(maxStart, current + 1))}
                    disabled={visibleStart >= maxStart}
                  >
                    <ChevronRight size={14} />
                  </IconButton>
                </>
              )}
              {activeCountdown && (
                <button className="btn btn-secondary btn-sm" onClick={() => onDeleteCountdown(activeCountdown.id)}>
                  <Trash2 size={14} /> 删除当前倒计时
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="倒计时名称"
              style={{
                flex: '1 1 220px',
                minWidth: 180,
                height: 36,
                borderRadius: 10,
                border: '1px solid rgba(15, 23, 42, 0.12)',
                background: 'white',
                padding: '0 12px',
                fontSize: 13,
              }}
            />
            <input
              value={draftMax}
              onChange={(event) => setDraftMax(event.target.value)}
              type="number"
              min={2}
              max={12}
              placeholder="上限"
              style={{
                width: 92,
                height: 36,
                borderRadius: 10,
                border: '1px solid rgba(15, 23, 42, 0.12)',
                background: 'white',
                padding: '0 12px',
                fontSize: 13,
              }}
            />
            <button className="btn btn-primary btn-sm" onClick={submitCountdown}>
              <Plus size={14} /> 新增倒计时
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${max}, minmax(56px, 1fr))`,
          gap: 8,
        }}
      >
        {Array.from({ length: max }).map((_, index) => {
          const step = index + 1
          const active = step <= value
          const opacity = 0.12 + (index / Math.max(1, max - 1)) * 0.88

          return (
            <button
              key={step}
              type="button"
              disabled={!editable}
              onClick={() => editable && onChange(step)}
              style={{
                height: 36,
                borderRadius: 10,
                border: active ? '1px solid rgba(244, 63, 94, 0.28)' : '1px solid rgba(252, 165, 165, 0.18)',
                background: active ? `rgba(244, 63, 94, ${Math.min(0.22 + index * 0.08, 0.74)})` : 'rgba(255,255,255,0.58)',
                color: active ? 'white' : '#f43f5e',
                fontSize: 13,
                fontWeight: 800,
                cursor: editable ? 'pointer' : 'default',
                boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.22)' : 'none',
              }}
            >
              {step}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ColumnCard({
  column,
  ownerName,
  ownerColor,
  isHost,
  canEdit,
  isFirst,
  isLast,
  onMoveLeft,
  onMoveRight,
  onOpenEditor,
  onUpdateSheet,
  onResourceChange,
}: {
  column: ResourceTrackerCharacterColumn
  ownerName: string
  ownerColor: string
  isHost: boolean
  canEdit: boolean
  isFirst: boolean
  isLast: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
  onOpenEditor: () => void
  onUpdateSheet: (sheet: ResourceTrackerSheet) => void
  onResourceChange: (resourceKey: ResourceTrackerResourceKey, nextValue: number | boolean[]) => void
}) {
  const { sheet } = column

  return (
    <section
      style={{
        width: 442,
        padding: 12,
        flexShrink: 0,
        borderRadius: 14,
        border: SURFACE_BORDER,
        background: 'rgba(255,255,255,0.92)',
        boxShadow: SURFACE_SHADOW,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div
          style={{
            flex: 1,
            minHeight: 32,
            padding: '7px 12px',
            borderRadius: 8,
            border: '1px solid rgba(15, 23, 42, 0.12)',
            background: 'white',
            fontSize: 16,
            fontWeight: 800,
            color: '#0f172a',
          }}
        >
          {sheet.character_name || '未命名角色'}
        </div>
        {isHost && (
          <>
            <IconButton title="左移" onClick={onMoveLeft} disabled={isFirst}>
              <ChevronLeft size={14} />
            </IconButton>
            <IconButton title="右移" onClick={onMoveRight} disabled={isLast}>
              <ChevronRight size={14} />
            </IconButton>
          </>
        )}
        {canEdit && (
          <IconButton title="编辑角色卡" onClick={onOpenEditor}>
            <Edit3 size={14} />
          </IconButton>
        )}
      </div>

      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>
        {sheet.summary_line || '未填写角色摘要'}
      </div>

      <div
        style={{
          height: 1,
          background: 'rgba(15, 23, 42, 0.08)',
          margin: '10px 0 12px',
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
        <StatField label="等级" value={sheet.identity.level} />
        <StatField label="闪避" value={sheet.stats.evasion} />
        <StatField label="护甲" value={sheet.stats.armor_value} />
        <StatField label="重伤" value={sheet.stats.minor_threshold} />
        <StatField label="严重" value={sheet.stats.major_threshold} />
      </div>

      <SectionTitle title="属性" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {ATTRIBUTES.map((attribute) => (
          <AttributeField key={attribute.key} label={attribute.label} value={sheet.stats.attributes[attribute.key]} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <ResourcePanel title="希望" count={`${sheet.resources.hope}/${sheet.resources.hope_max}`}>
          <HopeTrack
            value={sheet.resources.hope}
            max={sheet.resources.hope_max}
            editable={canEdit}
            onChange={(nextValue) => onResourceChange('hope', nextValue)}
          />
        </ResourcePanel>

        <ResourcePanel title="熟练" count={`${getTrackFilledCount(sheet.resources.proficiency)}/${sheet.resources.proficiency.length}`}>
          <CircleTrack
            value={sheet.resources.proficiency}
            editable={canEdit}
            onChange={(nextValue) => onResourceChange('proficiency', nextValue)}
          />
        </ResourcePanel>

        <ResourcePanel title="生命" count={`${getTrackFilledCount(sheet.resources.hp)}/${sheet.resources.hp_max}`}>
          <SquareTrack
            value={sheet.resources.hp}
            editable={canEdit}
            onChange={(nextValue) => onResourceChange('hp', nextValue)}
          />
        </ResourcePanel>

        <ResourcePanel title="压力" count={`${getTrackFilledCount(sheet.resources.stress)}/${sheet.resources.stress_max}`}>
          <SquareTrack
            value={sheet.resources.stress}
            editable={canEdit}
            onChange={(nextValue) => onResourceChange('stress', nextValue)}
          />
        </ResourcePanel>
      </div>

      <div style={{ marginTop: 12 }}>
        <GoldPanel
          value={sheet.resources.gold}
          editable={canEdit}
          onChange={(nextValue) => onResourceChange('gold', nextValue)}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <EditableNotesPanel
          value={sheet.narrative.notes}
          editable={canEdit}
          onSave={(notes) => onUpdateSheet({
            ...sheet,
            narrative: {
              ...sheet.narrative,
              notes,
            },
          })}
        />
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
        {ownerName} · {sheet.file_name || '未记录文件名'}
      </div>
      <div
        style={{
          marginTop: 6,
          height: 3,
          borderRadius: 999,
          background: ownerColor,
          opacity: 0.32,
        }}
      />
    </section>
  )
}

function PendingPanel({
  requests,
  columns,
  onApprove,
  onReject,
}: {
  requests: ResourceTrackerResourceChangeRequest[]
  columns: ResourceTrackerCharacterColumn[]
  onApprove: (requestId: string) => void
  onReject: (requestId: string) => void
}) {
  return (
    <aside
      style={{
        position: 'fixed',
        top: 154,
        right: 22,
        width: 328,
        zIndex: 30,
        padding: 14,
        maxHeight: 'calc(100vh - 330px)',
        overflow: 'auto',
        borderRadius: 16,
        border: SURFACE_BORDER,
        background: 'rgba(255,255,255,0.94)',
        boxShadow: SURFACE_SHADOW,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>待审批的资源修改</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {requests.map((request) => {
          const column = columns.find((item) => item.id === request.column_id)
          return (
            <div
              key={request.id}
              style={{
                padding: 12,
                borderRadius: 12,
                border: '1px solid rgba(15, 23, 42, 0.08)',
                background: 'rgba(248,250,252,0.96)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                {request.requested_by_name} {'->'} {column?.sheet.character_name ?? '角色'}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>
                {getResourceLabel(request.resource_key)}: {formatResourceValue(request.current_value)} {'->'} {formatResourceValue(request.next_value)}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn btn-primary btn-sm" onClick={() => onApprove(request.id)}>
                  <Check size={13} /> 批准
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => onReject(request.id)}>
                  <X size={13} /> 拒绝
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function ActivityPanel({ logs }: { logs: Array<{ id: string; created_at: string; message: string }> }) {
  const recentLogs = useMemo(() => logs.slice(-18).reverse(), [logs])
  const latestLogId = logs.at(-1)?.id ?? null
  const latestLogMessage = logs.at(-1)?.message ?? ''
  const [isCollapsed, setIsCollapsed] = useState(logs.length === 0)
  const hideTimerRef = useRef<number | null>(null)
  const previousLatestLogIdRef = useRef<string | null>(latestLogId)

  useEffect(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }

    if (!latestLogId) {
      setIsCollapsed(true)
      previousLatestLogIdRef.current = latestLogId
      return
    }

    const hasNewLog = previousLatestLogIdRef.current !== latestLogId
    if (hasNewLog) {
      setIsCollapsed(false)
    }

    hideTimerRef.current = window.setTimeout(() => {
      setIsCollapsed(true)
      hideTimerRef.current = null
    }, 9000)

    previousLatestLogIdRef.current = latestLogId

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }
  }, [latestLogId])

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={() => setIsCollapsed(false)}
        style={{
          position: 'fixed',
          right: 22,
          bottom: 20,
          zIndex: 25,
          maxWidth: 320,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 999,
          border: SURFACE_BORDER,
          background: 'rgba(255,255,255,0.94)',
          boxShadow: '0 18px 34px rgba(15, 23, 42, 0.14)',
          backdropFilter: 'blur(14px)',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: latestLogId ? '#f43f5e' : '#cbd5e1',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
          变更记录
        </span>
        <span
          style={{
            fontSize: 12,
            color: '#64748b',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {latestLogMessage || '暂无新消息'}
        </span>
      </button>
    )
  }

  return (
    <aside
      style={{
        position: 'fixed',
        right: 22,
        bottom: 20,
        width: 372,
        maxHeight: 250,
        overflow: 'auto',
        zIndex: 25,
        padding: 14,
        borderRadius: 18,
        border: SURFACE_BORDER,
        background: 'rgba(255,255,255,0.92)',
        boxShadow: '0 18px 34px rgba(15, 23, 42, 0.14)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>变更记录</div>
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          收起
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recentLogs.length === 0 && (
          <div style={{ fontSize: 12, lineHeight: 1.6, color: '#94a3b8' }}>
            资源修改和关键数值变更会以聊天记录的形式显示在这里。
          </div>
        )}
        {recentLogs.map((log) => (
          <div
            key={log.id}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(248,250,252,1))',
              border: '1px solid rgba(15,23,42,0.06)',
            }}
          >
            <div style={{ fontSize: 12, lineHeight: 1.6, color: '#334155' }}>{log.message}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
              {new Date(log.created_at).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

function SheetEditor({
  sheet,
  onChange,
  onCancel,
  onSave,
}: {
  sheet: ResourceTrackerSheet
  onChange: (sheet: ResourceTrackerSheet) => void
  onCancel: () => void
  onSave: () => void
}) {
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
      attributes: {
        ...sheet.stats.attributes,
        [key]: value,
      },
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <Field label="角色名" value={sheet.character_name} onChange={(value) => update('character_name', value)} />
        <Field label="摘要" value={sheet.summary_line} onChange={(value) => update('summary_line', value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <Field label="等级" value={sheet.identity.level} onChange={(value) => updateIdentity('level', value)} />
        <Field label="闪避" value={sheet.stats.evasion} onChange={(value) => updateStatsField('evasion', value)} />
        <Field label="护甲值" value={sheet.stats.armor_value} onChange={(value) => updateStatsField('armor_value', value)} />
        <Field label="重伤阈值" value={sheet.stats.minor_threshold} onChange={(value) => updateStatsField('minor_threshold', value)} />
        <Field label="严重阈值" value={sheet.stats.major_threshold} onChange={(value) => updateStatsField('major_threshold', value)} />
        <Field label="主属性" value={sheet.identity.primary_trait} onChange={(value) => updateIdentity('primary_trait', value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <Field label="种族" value={sheet.identity.ancestry} onChange={(value) => updateIdentity('ancestry', value)} />
        <Field label="职业" value={sheet.identity.profession} onChange={(value) => updateIdentity('profession', value)} />
        <Field label="社群" value={sheet.identity.community} onChange={(value) => updateIdentity('community', value)} />
        <Field label="子职业" value={sheet.identity.subclass} onChange={(value) => updateIdentity('subclass', value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {ATTRIBUTES.map((attribute) => (
          <Field
            key={attribute.key}
            label={attribute.label}
            value={sheet.stats.attributes[attribute.key]}
            onChange={(value) => updateAttribute(attribute.key, value)}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Field label="主武器名称" value={sheet.equipment.primary_weapon_name} onChange={(value) => updateEquipment('primary_weapon_name', value)} />
        <Field label="副武器名称" value={sheet.equipment.secondary_weapon_name} onChange={(value) => updateEquipment('secondary_weapon_name', value)} />
        <Field label="主武器属性/范围" value={sheet.equipment.primary_weapon_trait} onChange={(value) => updateEquipment('primary_weapon_trait', value)} />
        <Field label="副武器属性/范围" value={sheet.equipment.secondary_weapon_trait} onChange={(value) => updateEquipment('secondary_weapon_trait', value)} />
        <Field label="主武器伤害" value={sheet.equipment.primary_weapon_damage} onChange={(value) => updateEquipment('primary_weapon_damage', value)} />
        <Field label="副武器伤害" value={sheet.equipment.secondary_weapon_damage} onChange={(value) => updateEquipment('secondary_weapon_damage', value)} />
        <Field label="主武器特性" value={sheet.equipment.primary_weapon_feature} onChange={(value) => updateEquipment('primary_weapon_feature', value)} />
        <Field label="副武器特性" value={sheet.equipment.secondary_weapon_feature} onChange={(value) => updateEquipment('secondary_weapon_feature', value)} />
        <Field label="护甲名称" value={sheet.equipment.armor_name} onChange={(value) => updateEquipment('armor_name', value)} />
        <Field label="基础护甲" value={sheet.equipment.armor_base_score} onChange={(value) => updateEquipment('armor_base_score', value)} />
        <Field label="护甲阈值" value={sheet.equipment.armor_threshold} onChange={(value) => updateEquipment('armor_threshold', value)} />
        <Field label="护甲特性" value={sheet.equipment.armor_feature} onChange={(value) => updateEquipment('armor_feature', value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {sheet.narrative.experiences.map((item, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 88px', gap: 8 }}>
            <Field label={`经历 ${index + 1}`} value={item.name} onChange={(value) => updateExperience(index, 'name', value)} />
            <Field label="值" value={item.value} onChange={(value) => updateExperience(index, 'value', value)} />
          </div>
        ))}
      </div>

      <FieldArea label="背景" value={sheet.narrative.background} onChange={(value) => updateNarrativeField('background', value)} />
      <FieldArea label="外貌" value={sheet.narrative.appearance} onChange={(value) => updateNarrativeField('appearance', value)} />
      <FieldArea label="动机" value={sheet.narrative.motivation} onChange={(value) => updateNarrativeField('motivation', value)} />
      <FieldArea label="笔记" value={sheet.narrative.notes} onChange={(value) => updateNarrativeField('notes', value)} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-secondary" onClick={onCancel}>取消</button>
        <button className="btn btn-primary" onClick={onSave}>保存</button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function FieldArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{label}</span>
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

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ marginTop: 12, marginBottom: 8, fontSize: 13, fontWeight: 800, color: '#334155' }}>
      {title}
    </div>
  )
}

function StatField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}>{label}</div>
      <DisplayInput value={value} placeholder="-" align="left" />
    </div>
  )
}

function AttributeField({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 8,
        borderRadius: 10,
        border: '1px solid rgba(15, 23, 42, 0.08)',
        background: 'linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,0.95))',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>{label}</div>
      <div
        style={{
          minHeight: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: '1px solid rgba(15, 23, 42, 0.1)',
          background: 'white',
          fontSize: 18,
          fontWeight: 900,
          color: '#0f172a',
        }}
      >
        {value || '-'}
      </div>
    </div>
  )
}

function ResourcePanel({
  title,
  count,
  children,
}: {
  title: string
  count?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        minHeight: 82,
        padding: 10,
        borderRadius: 10,
        border: '1px solid rgba(15, 23, 42, 0.08)',
        background: 'linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,0.95))',
      }}
    >
      <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 800, color: '#475569' }}>
        {title}
        {count && <span style={{ marginLeft: 4, color: '#94a3b8', fontWeight: 700 }}>{count}</span>}
      </div>
      {children}
    </div>
  )
}

function GoldPanel({
  value,
  editable,
  onChange,
}: {
  value: boolean[]
  editable: boolean
  onChange: (value: boolean[]) => void
}) {
  const coinTrack = value.slice(0, 10)
  const bagTrack = value.slice(10, 20)
  const chestFilled = Boolean(value[20])

  function updateGoldSegment(start: number, length: number, offset: number) {
    const segment = value.slice(start, start + length)
    const nextSegment = updateTrack(segment, offset)
    const nextValue = [...value]
    nextSegment.forEach((filled, index) => {
      nextValue[start + index] = filled
    })
    onChange(nextValue)
  }

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: '1px solid rgba(15, 23, 42, 0.08)',
        background: 'linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,0.98))',
      }}
    >
      <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 800, color: '#334155' }}>金币</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1.4fr 0.7fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div>
          <div style={{ marginBottom: 8, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569' }}>把</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {coinTrack.map((filled, index) => (
              <button
                key={index}
                type="button"
                disabled={!editable}
                onClick={() => editable && updateGoldSegment(0, 10, index)}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px solid rgba(51,65,85,0.85)',
                  background: filled ? '#334155' : 'white',
                  cursor: editable ? 'pointer' : 'default',
                  justifySelf: 'center',
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 8, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569' }}>袋</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {bagTrack.map((filled, index) => (
              <button
                key={index}
                type="button"
                disabled={!editable}
                onClick={() => editable && updateGoldSegment(10, 10, index)}
                style={{
                  width: 18,
                  height: 18,
                  border: '2px solid rgba(51,65,85,0.85)',
                  background: filled ? '#334155' : 'white',
                  cursor: editable ? 'pointer' : 'default',
                  justifySelf: 'center',
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 8, textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#475569' }}>箱</div>
          <button
            type="button"
            disabled={!editable}
            onClick={() => {
              if (!editable) return
              const nextValue = [...value]
              nextValue[20] = !chestFilled
              onChange(nextValue)
            }}
            style={{
              width: 38,
              height: 46,
              margin: '0 auto',
              display: 'block',
              border: '2px solid rgba(51,65,85,0.85)',
              background: chestFilled ? '#334155' : 'white',
              cursor: editable ? 'pointer' : 'default',
            }}
          />
        </div>
      </div>
    </div>
  )
}

function EditableNotesPanel({
  value,
  editable,
  onSave,
}: {
  value: string
  editable: boolean
  onSave: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  function commit() {
    if (!editable) return
    const nextValue = draft.trim()
    if (nextValue === value) return
    onSave(nextValue)
  }

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: '1px solid rgba(15, 23, 42, 0.08)',
        background: 'linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,0.98))',
      }}
    >
      <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 800, color: '#334155' }}>笔记</div>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        placeholder="写下这名角色的临时备注、状态、线索或待办。"
        disabled={!editable}
        style={{
          width: '100%',
          minHeight: 118,
          resize: 'vertical',
          padding: '10px 12px',
          boxSizing: 'border-box',
          borderRadius: 10,
          border: '1px solid rgba(15, 23, 42, 0.12)',
          background: editable ? 'white' : 'rgba(255,255,255,0.85)',
          color: '#0f172a',
          fontSize: 13,
          lineHeight: 1.6,
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
    </div>
  )
}

function WeaponPanel({
  title,
  lines,
  placeholders,
}: {
  title: string
  lines: string[]
  placeholders: string[]
}) {
  return (
    <div>
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 800, color: '#334155' }}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {lines.map((line, index) => (
          <DisplayInput key={index} value={line} placeholder={placeholders[index] ?? '未填写'} />
        ))}
      </div>
    </div>
  )
}

function DisplayBlock({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        border: '1px solid rgba(15, 23, 42, 0.08)',
        background: 'rgba(248,250,252,0.9)',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: value ? '#0f172a' : '#94a3b8', whiteSpace: 'pre-wrap' }}>
        {value || '未填写'}
      </div>
    </div>
  )
}

function DisplayInput({
  value,
  placeholder,
  align = 'left',
}: {
  value: string
  placeholder?: string
  align?: 'left' | 'center'
}) {
  return (
    <div
      style={{
        minHeight: 30,
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        borderRadius: 8,
        border: '1px solid rgba(15, 23, 42, 0.1)',
        background: 'white',
        fontSize: 13,
        fontWeight: value ? 700 : 500,
        color: value ? '#0f172a' : '#94a3b8',
      }}
    >
      {value || placeholder || '未填写'}
    </div>
  )
}

function IconButton({
  children,
  title,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: '1px solid rgba(15, 23, 42, 0.1)',
        background: disabled ? 'rgba(248,250,252,0.9)' : 'white',
        color: disabled ? '#cbd5e1' : '#64748b',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function HopeTrack({
  value,
  max,
  editable,
  onChange,
}: {
  value: number
  max: number
  editable: boolean
  onChange: (value: number) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingLeft: 2, paddingTop: 2 }}>
      {Array.from({ length: max }).map((_, index) => {
        const filled = index < value
        return (
          <button
            key={index}
            type="button"
            disabled={!editable}
            onClick={() => editable && onChange(filled && index === value - 1 ? index : index + 1)}
            style={{
              width: 18,
              height: 18,
              transform: 'rotate(45deg)',
              border: '2px solid #334155',
              background: filled ? '#334155' : 'white',
              cursor: editable ? 'pointer' : 'default',
            }}
          />
        )
      })}
    </div>
  )
}

function SquareTrack({
  value,
  editable,
  onChange,
}: {
  value: boolean[]
  editable: boolean
  onChange: (value: boolean[]) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
      }}
    >
      {value.map((filled, index) => (
        <button
          key={index}
          type="button"
          disabled={!editable}
          onClick={() => editable && onChange(updateTrack(value, index))}
          style={{
            width: 14,
            height: 14,
            border: '1px solid rgba(51,65,85,0.85)',
            background: filled ? '#334155' : 'white',
            cursor: editable ? 'pointer' : 'default',
          }}
        />
      ))}
    </div>
  )
}

function CircleTrack({
  value,
  editable,
  onChange,
}: {
  value: boolean[]
  editable: boolean
  onChange: (value: boolean[]) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {value.map((filled, index) => (
        <button
          key={index}
          type="button"
          disabled={!editable}
          onClick={() => editable && onChange(updateTrack(value, index))}
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '1px solid rgba(51,65,85,0.85)',
            background: filled ? '#334155' : 'white',
            cursor: editable ? 'pointer' : 'default',
          }}
        />
      ))}
    </div>
  )
}

function updateTrack(track: boolean[], index: number) {
  const shouldDecrease = track[index] && track.slice(index + 1).every((item) => !item)
  return track.map((_, itemIndex) => (shouldDecrease ? itemIndex < index : itemIndex <= index))
}

function getResourceLabel(resourceKey: ResourceTrackerResourceKey) {
  switch (resourceKey) {
    case 'hope':
      return '希望点'
    case 'proficiency':
      return '熟练'
    case 'hp':
      return '生命'
    case 'stress':
      return '压力'
    case 'armor_slots':
      return '护甲槽'
    case 'gold':
      return '金币'
  }
}

function formatResourceValue(value: number | boolean[]) {
  if (Array.isArray(value)) {
    if (value.length === 21) {
      const hand = value.slice(0, 10).filter(Boolean).length
      const bag = value.slice(10, 20).filter(Boolean).length
      const chest = value[20] ? 1 : 0
      return `把 ${hand}/10，袋 ${bag}/10，箱 ${chest}/1`
    }
    return `${value.filter(Boolean).length}/${value.length}`
  }
  return String(value)
}
