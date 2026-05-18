import React, { useEffect, useRef, useState } from 'react'
import type { GmPanelCharacterSheetEntry, GmPanelResourceKey, ResourceTrackerCountdown } from '@dhgc/shared'
import { BookOpen, ChevronLeft, ChevronRight, FileUp, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { FloatingNotebook } from '@/components/notebook/FloatingNotebook'
import { Modal } from '@/components/ui/Modal'
import { fetchGmSheetHtml } from '@/lib/realtime'
import { useStore } from '@/store/useStore'
import { buildGmSheetSrcDoc, getGmSheetResourceSnapshot } from '@/utils/gmPanelHtml'

const SHEETS_PER_PAGE = 2

type SheetDocState = {
  htmlUpdatedAt: string
  srcDoc: string
  loading: boolean
  error?: string
}

type ResourceMessage = {
  type: 'dhol-gm-resource-change'
  sheetId: string
  resourceKey: GmPanelResourceKey
  value: number | boolean[]
}

export function GmPanelBoard() {
  const {
    room,
    currentPlayerId,
    importGmCharacter,
    replaceGmCharacter,
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
  const [draftCountdownName, setDraftCountdownName] = useState('')
  const [draftCountdownMax, setDraftCountdownMax] = useState('6')
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)
  const [sheetDocs, setSheetDocs] = useState<Record<string, SheetDocState>>({})
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})
  const sheetDocsRef = useRef<Record<string, SheetDocState>>({})

  if (!room || room.room_type !== 'gm-panel' || !room.gm_panel) return null

  const panel = room.gm_panel
  const isHost = room.host_player_id === currentPlayerId
  const orderedSheets = panel.sheet_order
    .map((sheetId) => panel.sheets.find((sheet) => sheet.id === sheetId) ?? null)
    .filter((sheet): sheet is GmPanelCharacterSheetEntry => Boolean(sheet))
  const pageCount = Math.max(1, Math.ceil(Math.max(orderedSheets.length, SHEETS_PER_PAGE) / SHEETS_PER_PAGE))
  const visibleSheets = orderedSheets.slice(currentPage * SHEETS_PER_PAGE, (currentPage + 1) * SHEETS_PER_PAGE)
  const visibleSheetSignature = visibleSheets.map((entry) => `${entry.id}:${entry.html_updated_at}`).join('|')
  const slotEntries = Array.from({ length: SHEETS_PER_PAGE }, (_, index) => visibleSheets[index] ?? null)

  useEffect(() => {
    if (panel.cards_per_page !== SHEETS_PER_PAGE) {
      updateGmCardsPerPage(SHEETS_PER_PAGE)
    }
  }, [panel.cards_per_page, updateGmCardsPerPage])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, Math.max(0, pageCount - 1)))
  }, [pageCount])

  useEffect(() => {
    sheetDocsRef.current = sheetDocs
  }, [sheetDocs])

  useEffect(() => {
    let disposed = false

    visibleSheets.forEach((entry) => {
      const cached = sheetDocsRef.current[entry.id]
      if (cached?.loading) return
      if (cached?.htmlUpdatedAt === entry.html_updated_at && cached.srcDoc) return

      setSheetDocs((current) => ({
        ...current,
        [entry.id]: {
          htmlUpdatedAt: entry.html_updated_at,
          srcDoc: current[entry.id]?.srcDoc ?? '',
          loading: true,
        },
      }))

      fetchGmSheetHtml(room.invite_code, entry.id)
        .then((html) => {
          if (disposed) return
          setSheetDocs((current) => ({
            ...current,
            [entry.id]: {
              htmlUpdatedAt: entry.html_updated_at,
              srcDoc: buildGmSheetSrcDoc(entry.id, html),
              loading: false,
            },
          }))
        })
        .catch((error) => {
          if (disposed) return
          setSheetDocs((current) => ({
            ...current,
            [entry.id]: {
              htmlUpdatedAt: entry.html_updated_at,
              srcDoc: current[entry.id]?.srcDoc ?? '',
              loading: false,
              error: error instanceof Error ? error.message : '角色卡 HTML 加载失败。',
            },
          }))
        })
    })

    return () => {
      disposed = true
    }
  }, [room.invite_code, visibleSheetSignature])

  useEffect(() => {
    visibleSheets.forEach((entry) => {
      const iframe = iframeRefs.current[entry.id]
      if (!iframe?.contentWindow) return

      iframe.contentWindow.postMessage({
        type: 'dhol-gm-sync-resources',
        sheetId: entry.id,
        resources: getGmSheetResourceSnapshot(entry),
      }, '*')
    })
  }, [visibleSheets, sheetDocs])

  useEffect(() => {
    function handleMessage(event: MessageEvent<ResourceMessage>) {
      const message = event.data
      if (!message || message.type !== 'dhol-gm-resource-change') return

      if (message.resourceKey === 'hope') {
        if (typeof message.value === 'number') {
          updateGmResource(message.sheetId, 'hope', message.value)
        }
        return
      }

      if (!Array.isArray(message.value)) return
      updateGmResource(message.sheetId, message.resourceKey, message.value.map(Boolean))
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [updateGmResource])

  async function handleImport(file: File, targetSheetId?: string | null) {
    try {
      const html = await file.text()
      if (targetSheetId) {
        replaceGmCharacter(targetSheetId, file.name, html)
      } else {
        importGmCharacter(file.name, html)
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : '角色卡导入失败。', 'error')
    }
  }

  async function handleImportChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await handleImport(file)
  }

  async function handleReplaceChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const targetSheetId = replaceTargetId
    event.target.value = ''
    setReplaceTargetId(null)
    if (!file || !targetSheetId) return
    await handleImport(file, targetSheetId)
  }

  function submitCountdown() {
    const max = Math.max(2, Math.min(12, Number.parseInt(draftCountdownMax, 10) || 6))
    createGmCountdown(draftCountdownName.trim() || `进度钟 ${panel.countdowns.length + 1}`, max)
    setDraftCountdownName('')
    setDraftCountdownMax('6')
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
      <div style={{ minWidth: 1320, padding: 20, display: 'grid', gap: 18 }}>
        <TrackerFearBar
          value={panel.fear.value}
          max={panel.fear.max}
          countdowns={panel.countdowns}
          editable={isHost}
          draftName={draftCountdownName}
          draftMax={draftCountdownMax}
          onDraftNameChange={setDraftCountdownName}
          onDraftMaxChange={setDraftCountdownMax}
          onChange={updateGmFear}
          onCreateCountdown={submitCountdown}
          onUpdateCountdown={updateGmCountdown}
          onDeleteCountdown={deleteGmCountdown}
        />

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
            background: 'rgba(255,255,255,0.9)',
            boxShadow: '0 16px 40px rgba(31, 41, 55, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {isHost && (
              <button className="btn btn-primary" onClick={() => importInputRef.current?.click()}>
                <FileUp size={14} /> 导入 HTML 角色卡
              </button>
            )}

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
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
              固定 4 列原卡视图
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}>
              <ChevronLeft size={14} /> 上一页
            </button>
            <div style={{ minWidth: 84, textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#7c4f31' }}>
              {currentPage + 1} / {pageCount}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage((page) => Math.min(pageCount - 1, page + 1))}>
              下一页 <ChevronRight size={14} />
            </button>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            alignItems: 'start',
          }}
        >
          {slotEntries.map((entry, index) => (
            entry ? (
              <HtmlSheetCard
                key={entry.id}
                entry={entry}
                sheetState={sheetDocs[entry.id]}
                canManage={isHost}
                isFirst={index === 0 && currentPage === 0}
                isLast={index === visibleSheets.length - 1 && currentPage === pageCount - 1}
                onMoveLeft={() => moveGmSheet(entry.id, 'left')}
                onMoveRight={() => moveGmSheet(entry.id, 'right')}
                onReplace={() => {
                  setReplaceTargetId(entry.id)
                  replaceInputRef.current?.click()
                }}
                onIframeReady={(iframe) => {
                  iframeRefs.current[entry.id] = iframe
                  iframe.contentWindow?.postMessage({
                    type: 'dhol-gm-sync-resources',
                    sheetId: entry.id,
                    resources: getGmSheetResourceSnapshot(entry),
                  }, '*')
                }}
              />
            ) : (
              <EmptySlotCard
                key={`empty-${currentPage}-${index}`}
                canImport={isHost}
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
    </div>
  )
}

function HtmlSheetCard(props: {
  entry: GmPanelCharacterSheetEntry
  sheetState?: SheetDocState
  canManage: boolean
  isFirst: boolean
  isLast: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
  onReplace: () => void
  onIframeReady: (iframe: HTMLIFrameElement) => void
}) {
  const { entry, sheetState, canManage, isFirst, isLast, onMoveLeft, onMoveRight, onReplace, onIframeReady } = props

  return (
    <article
      style={{
        minWidth: 0,
        borderRadius: 20,
        border: '1px solid rgba(124, 79, 49, 0.12)',
        background: 'rgba(255,255,255,0.92)',
        boxShadow: '0 18px 36px rgba(31, 41, 55, 0.08)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: 14,
          borderBottom: '1px solid rgba(124, 79, 49, 0.12)',
          background: 'linear-gradient(180deg, rgba(255,251,235,0.92), rgba(255,255,255,0.96))',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1f2937', marginBottom: 4 }}>
            {entry.parsed_sheet.character_name || '未命名角色'}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#7c4f31',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {entry.parsed_sheet.summary_line || entry.source_file_name}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: '#9ca3af',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {entry.source_file_name}
          </div>
        </div>

        {canManage && (
          <div style={{ display: 'grid', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={onReplace}>
              <RefreshCw size={13} /> 替换
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
        )}
      </div>

      <div style={{ position: 'relative', height: 'calc(100vh - 280px)', minHeight: 680, background: '#f8f5ef' }}>
        {sheetState?.srcDoc ? (
          <iframe
            title={`${entry.parsed_sheet.character_name}-sheet`}
            srcDoc={sheetState.srcDoc}
            onLoad={(event) => onIframeReady(event.currentTarget)}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              background: '#f8f5ef',
            }}
          />
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', color: '#9ca3af', fontSize: 13 }}>
            {sheetState?.loading ? '正在加载角色卡…' : '等待角色卡内容…'}
          </div>
        )}

        {(sheetState?.loading || sheetState?.error) && (
          <div
            style={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              maxWidth: '70%',
              padding: '8px 10px',
              borderRadius: 12,
              background: sheetState.error ? 'rgba(127,29,29,0.9)' : 'rgba(124,79,49,0.85)',
              color: 'white',
              fontSize: 12,
              lineHeight: 1.5,
              boxShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
            }}
          >
            {sheetState.error ?? '正在同步最新 HTML…'}
          </div>
        )}
      </div>
    </article>
  )
}

function EmptySlotCard({ canImport, onImport }: { canImport: boolean; onImport: () => void }) {
  if (!canImport) {
    return (
      <div
        style={{
          minHeight: 680,
          borderRadius: 20,
          border: '2px dashed rgba(124, 79, 49, 0.18)',
          background: 'rgba(255,255,255,0.56)',
          color: '#a8a29e',
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        等待 GM 导入角色卡
      </div>
    )
  }

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
      导入 HTML 角色卡
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
      <div style={{ display: 'grid', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
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

function TrackerFearBar(props: {
  value: number
  max: number
  countdowns: ResourceTrackerCountdown[]
  editable: boolean
  draftName: string
  draftMax: string
  onDraftNameChange: (value: string) => void
  onDraftMaxChange: (value: string) => void
  onChange: (value: number) => void
  onCreateCountdown: () => void
  onUpdateCountdown: (countdownId: string, value: number) => void
  onDeleteCountdown: (countdownId: string) => void
}) {
  const {
    value,
    max,
    countdowns,
    editable,
    draftName,
    draftMax,
    onDraftNameChange,
    onDraftMaxChange,
    onChange,
    onCreateCountdown,
    onUpdateCountdown,
    onDeleteCountdown,
  } = props

  const [showCreator, setShowCreator] = useState(false)
  const [visibleStart, setVisibleStart] = useState(0)
  const visibleCount = 6
  const maxStart = Math.max(0, countdowns.length - visibleCount)
  const visibleCountdowns = countdowns.slice(visibleStart, visibleStart + visibleCount)
  const hasOverflow = countdowns.length > visibleCount

  useEffect(() => {
    setVisibleStart((current) => Math.min(current, maxStart))
  }, [maxStart])

  useEffect(() => {
    if (!editable) {
      setShowCreator(false)
    }
  }, [editable])

  function handleCreateCountdown() {
    onCreateCountdown()
    setShowCreator(false)
  }

  return (
    <>
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
                  {'GM \u8d44\u6e90'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e11d48' }}>{'\u6050\u60e7\u70b9'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: 54, lineHeight: 0.95, fontWeight: 900, color: '#5b1021' }}>{value}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#f43f5e' }}>/ {max}</span>
              </div>
              {editable && (
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, color: '#fb7185' }}>
                  {'\u70b9\u51fb\u4e0b\u65b9\u523b\u5ea6\u5373\u53ef\u628a\u6050\u60e7\u70b9\u8bbe\u7f6e\u5230\u5bf9\u5e94\u6570\u503c\u3002'}
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
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1f2937' }}>{'\u8fdb\u5ea6\u949f'}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 20 }}>
                  {hasOverflow && (
                    <>
                      <IconButton title={'\u4e0a\u4e00\u4e2a\u8fdb\u5ea6\u949f'} onClick={() => setVisibleStart((current) => Math.max(0, current - 1))} disabled={visibleStart === 0}>
                        <ChevronLeft size={14} />
                      </IconButton>
                      <IconButton
                        title={'\u4e0b\u4e00\u4e2a\u8fdb\u5ea6\u949f'}
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
                    alignItems: 'flex-start',
                    overflowX: 'auto',
                    paddingBottom: 4,
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
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>
                          {countdown.value} / {countdown.max}
                        </div>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => onDeleteCountdown(countdown.id)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#f97316',
                              cursor: 'pointer',
                              padding: 0,
                              marginLeft: 'auto',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Array.from({ length: countdown.max }, (_, index) => {
                          const step = index + 1
                          const active = step <= countdown.value
                          return (
                            <button
                              key={step}
                              type="button"
                              disabled={!editable}
                              onClick={() => editable && onUpdateCountdown(countdown.id, step)}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 8,
                                border: active ? '1px solid rgba(180, 83, 9, 0.42)' : '1px solid rgba(245, 158, 11, 0.24)',
                                background: active ? '#d97706' : 'rgba(255,255,255,0.82)',
                                color: active ? 'white' : '#d97706',
                                fontSize: 12,
                                fontWeight: 800,
                                cursor: editable ? 'pointer' : 'default',
                              }}
                            >
                              {step}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#9ca3af' }}>{'\u8fd8\u6ca1\u6709\u8fdb\u5ea6\u949f\u3002'}</div>
              )}
            </div>
          </div>

          {editable && (
            <div
              style={{
                display: 'grid',
                gap: 8,
                minWidth: 220,
                width: 276,
                maxWidth: '100%',
              }}
            >
              <button
                className="btn btn-sm"
                onClick={() => onChange(Math.max(0, value - 1))}
                style={{
                  background: '#16a34a',
                  borderColor: '#16a34a',
                  color: 'white',
                }}
              >
                {'- \u6697\u5f71\u6d88\u6563'}
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
                {'+ \u6050\u60e7\u6ecb\u751f'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onChange(0)}>
                <RefreshCw size={13} /> {'\u91cd\u7f6e'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreator(true)}>
                {'\u7ba1\u7406\u8fdb\u5ea6\u949f'}
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

      <Modal open={showCreator} onClose={() => setShowCreator(false)} title={'\u7ba1\u7406\u8fdb\u5ea6\u949f'} maxWidth={420}>
        <div style={{ display: 'grid', gap: 12 }}>
          <input
            className="input"
            value={draftName}
            onChange={(event) => onDraftNameChange(event.target.value)}
            placeholder={'\u65b0\u7684\u8fdb\u5ea6\u949f\u540d\u79f0'}
          />
          <input
            className="input"
            value={draftMax}
            onChange={(event) => onDraftMaxChange(event.target.value)}
            placeholder="6"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowCreator(false)}>
              {'\u53d6\u6d88'}
            </button>
            <button className="btn btn-primary" onClick={handleCreateCountdown}>
              <Plus size={14} /> {'\u6dfb\u52a0'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
function IconButton(props: {
  children: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
}) {
  const { children, title, onClick, disabled = false } = props

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

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
