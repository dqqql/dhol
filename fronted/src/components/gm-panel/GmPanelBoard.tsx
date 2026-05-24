import React, { useEffect, useRef, useState } from 'react'
import type { GmPanelCharacterSheetEntry, GmPanelResourceKey, ResourceTrackerCountdown } from '@dhgc/shared'
import { ChevronLeft, ChevronRight, FileUp, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { FloatingBattlePanel } from '@/components/gm-panel/FloatingBattlePanel'
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

type ResourceChangeMessage = {
  type: 'dhol-gm-resource-change'
  sheetId: string
  resourceKey: GmPanelResourceKey
  value: number | boolean[]
  index?: number | null
}

type ResourceReplayFailedMessage = {
  type: 'dhol-gm-resource-replay-failed'
  sheetId: string
}

type ResourceMessage = ResourceChangeMessage | ResourceReplayFailedMessage

type ImportPendingState = {
  fileName: string
  mode: 'import' | 'replace'
  previousSheetCount: number
  previousHtmlUpdatedAt?: string
  targetSheetId?: string
}

export function GmPanelBoard() {
  const {
    room,
    importGmCharacter,
    replaceGmCharacter,
    deleteGmCharacter,
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
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<1 | 2>(1)
  const [sheetDocs, setSheetDocs] = useState<Record<string, SheetDocState>>({})
  const [pendingImport, setPendingImport] = useState<ImportPendingState | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({})
  const sheetDocsRef = useRef<Record<string, SheetDocState>>({})

  if (!room || room.room_type !== 'gm-panel' || !room.gm_panel) return null

  const panel = room.gm_panel
  const inviteCode = room.invite_code
  const orderedSheets = panel.sheet_order
    .map((sheetId) => panel.sheets.find((sheet) => sheet.id === sheetId) ?? null)
    .filter((sheet): sheet is GmPanelCharacterSheetEntry => Boolean(sheet))
  const pageCount = Math.max(1, Math.ceil(Math.max(orderedSheets.length, SHEETS_PER_PAGE) / SHEETS_PER_PAGE))
  const visibleSheets = orderedSheets.slice(currentPage * SHEETS_PER_PAGE, (currentPage + 1) * SHEETS_PER_PAGE)
  const visibleSheetSignature = visibleSheets.map((entry) => `${entry.id}:${entry.html_updated_at}`).join('|')
  const slotEntries = Array.from({ length: SHEETS_PER_PAGE }, (_, index) => visibleSheets[index] ?? null)
  const deleteTargetEntry = deleteTargetId
    ? panel.sheets.find((sheet) => sheet.id === deleteTargetId) ?? null
    : null
  const isImportPending = Boolean(pendingImport)

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
    if (!pendingImport) return

    if (pendingImport.mode === 'import' && panel.sheets.length > pendingImport.previousSheetCount) {
      setPendingImport(null)
      return
    }

    if (pendingImport.mode === 'replace' && pendingImport.targetSheetId) {
      const target = panel.sheets.find((sheet) => sheet.id === pendingImport.targetSheetId)
      if (target && target.html_updated_at !== pendingImport.previousHtmlUpdatedAt) {
        setPendingImport(null)
      }
    }
  }, [panel.sheets, pendingImport])

  useEffect(() => {
    if (!pendingImport) return

    const timer = window.setTimeout(() => {
      setPendingImport(null)
    }, 30_000)

    return () => window.clearTimeout(timer)
  }, [pendingImport])

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

      fetchGmSheetHtml(inviteCode, entry.id)
        .then((html) => {
          if (disposed) return
          setSheetDocs((current) => ({
            ...current,
            [entry.id]: {
              htmlUpdatedAt: entry.html_updated_at,
              srcDoc: buildGmSheetSrcDoc(entry.id, html, getGmSheetResourceSnapshot(entry)),
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
  }, [inviteCode, visibleSheetSignature])

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
      if (!message) return

      if (message.type === 'dhol-gm-resource-replay-failed') {
        const entry = panel.sheets.find((sheet) => sheet.id === message.sheetId)
        if (!entry) return

        setSheetDocs((current) => ({
          ...current,
          [entry.id]: {
            htmlUpdatedAt: entry.html_updated_at,
            srcDoc: current[entry.id]?.srcDoc ?? '',
            loading: true,
          },
        }))

        fetchGmSheetHtml(inviteCode, entry.id)
          .then((html) => {
            setSheetDocs((current) => ({
              ...current,
              [entry.id]: {
                htmlUpdatedAt: entry.html_updated_at,
                srcDoc: buildGmSheetSrcDoc(entry.id, html, getGmSheetResourceSnapshot(entry)),
                loading: false,
              },
            }))
          })
          .catch((error) => {
            setSheetDocs((current) => ({
              ...current,
              [entry.id]: {
                htmlUpdatedAt: entry.html_updated_at,
                srcDoc: current[entry.id]?.srcDoc ?? '',
                loading: false,
                error: error instanceof Error ? error.message : '角色卡 HTML 重新载入失败。',
              },
            }))
          })
        return
      }

      if (message.type !== 'dhol-gm-resource-change') return

      if (message.resourceKey === 'hope') {
        if (typeof message.value === 'number') {
          updateGmResource(message.sheetId, 'hope', message.value)
        }
        return
      }

      if (!Array.isArray(message.value)) return
      const messageValue = message.value.map(Boolean)

      updateGmResource(message.sheetId, message.resourceKey, messageValue)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [panel.sheets, inviteCode, updateGmResource])

  async function handleImport(file: File, targetSheetId?: string | null) {
    const previousTarget = targetSheetId
      ? panel.sheets.find((sheet) => sheet.id === targetSheetId) ?? null
      : null

    setPendingImport({
      fileName: file.name,
      mode: targetSheetId ? 'replace' : 'import',
      previousSheetCount: panel.sheets.length,
      previousHtmlUpdatedAt: previousTarget?.html_updated_at,
      targetSheetId: targetSheetId ?? undefined,
    })

    try {
      const html = await file.text()
      if (targetSheetId) {
        replaceGmCharacter(targetSheetId, file.name, html)
      } else {
        importGmCharacter(file.name, html)
      }
    } catch (error) {
      setPendingImport(null)
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

  function openDeleteConfirm(sheetId: string) {
    setDeleteTargetId(sheetId)
    setDeleteConfirmStep(1)
  }

  function closeDeleteConfirm() {
    setDeleteTargetId(null)
    setDeleteConfirmStep(1)
  }

  function confirmDeleteStepOne() {
    setDeleteConfirmStep(2)
  }

  function handleDeleteSheet() {
    if (!deleteTargetId) return
    deleteGmCharacter(deleteTargetId)
    closeDeleteConfirm()
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
          editable
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
                       border: '1px solid rgba(184, 134, 11, 0.1)',
            background: 'rgba(254, 253, 249, 0.92)',
            boxShadow: '0 16px 40px rgba(60, 30, 0, 0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={isImportPending} onClick={() => importInputRef.current?.click()}>
              <FileUp size={14} /> 导入 HTML 角色卡
            </button>
            {pendingImport && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  padding: '7px 10px',
                  border: '1px solid rgba(184, 134, 11, 0.2)',
                  background: 'rgba(255, 251, 235, 0.86)',
                  color: '#7c4f31',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {pendingImport.mode === 'replace' ? '正在替换角色卡' : '正在导入角色卡'}：{pendingImport.fileName}
              </div>
            )}
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
                canManage
                actionsDisabled={isImportPending}
                isFirst={index === 0 && currentPage === 0}
                isLast={index === visibleSheets.length - 1 && currentPage === pageCount - 1}
                onMoveLeft={() => moveGmSheet(entry.id, 'left')}
                onMoveRight={() => moveGmSheet(entry.id, 'right')}
                onReplace={() => {
                  if (isImportPending) return
                  setReplaceTargetId(entry.id)
                  replaceInputRef.current?.click()
                }}
                onDelete={() => openDeleteConfirm(entry.id)}
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
                canImport={!isImportPending}
                onImport={() => importInputRef.current?.click()}
              />
            )
          ))}
        </section>

        <ActivityLogPanel logs={panel.activity_log} />
      </div>

      <FloatingBattlePanel roomId={room.room_id} />
      <FloatingNotebook roomId={room.room_id} />
      {pendingImport && <ImportPendingToast pendingImport={pendingImport} />}

      <input ref={importInputRef} type="file" accept=".html,text/html" style={{ display: 'none' }} onChange={handleImportChange} />
      <input ref={replaceInputRef} type="file" accept=".html,text/html" style={{ display: 'none' }} onChange={handleReplaceChange} />

      <Modal open={Boolean(deleteTargetEntry)} onClose={closeDeleteConfirm} title={'\u5220\u9664\u89d2\u8272\u5361'} maxWidth={460}>
        {deleteTargetEntry && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: '#4b5563' }}>
              {deleteConfirmStep === 1
                ? `\u8fd9\u5c06\u6c38\u4e45\u5220\u9664\u300c${deleteTargetEntry.parsed_sheet.character_name || deleteTargetEntry.source_file_name}\u300d\u3002\u5220\u9664\u540e\u65e0\u6cd5\u6062\u590d\u3002`
                : `\u8bf7\u518d\u6b21\u786e\u8ba4\uff1a\u89d2\u8272\u5361\u300c${deleteTargetEntry.parsed_sheet.character_name || deleteTargetEntry.source_file_name}\u300d\u4f1a\u7acb\u523b\u4ece\u5f53\u524d\u623f\u95f4\u72b6\u6001\u4e2d\u79fb\u9664\u3002`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={closeDeleteConfirm}>
                {'\u53d6\u6d88'}
              </button>
              {deleteConfirmStep === 1 ? (
                <button
                  className="btn"
                  onClick={confirmDeleteStepOne}
                  style={{
                    background: 'linear-gradient(180deg, #f97316, #ea580c)',
                    borderColor: '#ea580c',
                    color: 'white',
                  }}
                >
                  {'\u6211\u77e5\u9053\u4e86\uff0c\u7ee7\u7eed'}
                </button>
              ) : (
                <button
                  className="btn"
                  onClick={handleDeleteSheet}
                  style={{
                    background: 'linear-gradient(180deg, #b91c1c, #991b1b)',
                    borderColor: '#991b1b',
                    color: 'white',
                  }}
                >
                  <Trash2 size={14} /> {'\u786e\u8ba4\u6c38\u4e45\u5220\u9664'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ImportPendingToast({ pendingImport }: { pendingImport: ImportPendingState }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 22,
        bottom: 22,
        zIndex: 50,
        display: 'grid',
        gap: 4,
        minWidth: 260,
        maxWidth: 360,
        padding: '12px 14px',
        border: '1px solid rgba(184, 134, 11, 0.24)',
        background: 'linear-gradient(180deg, rgba(255,251,235,0.98), rgba(254,243,199,0.96))',
        color: '#7c4f31',
        boxShadow: '0 18px 44px rgba(60, 30, 0, 0.18)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900 }}>
        {pendingImport.mode === 'replace' ? '正在替换角色卡' : '正在导入角色卡'}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {pendingImport.fileName}
      </div>
    </div>
  )
}

function HtmlSheetCard(props: {
  entry: GmPanelCharacterSheetEntry
  sheetState?: SheetDocState
  canManage: boolean
  actionsDisabled?: boolean
  isFirst: boolean
  isLast: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
  onReplace: () => void
  onDelete: () => void
  onIframeReady: (iframe: HTMLIFrameElement) => void
}) {
  const {
    entry,
    sheetState,
    canManage,
    actionsDisabled = false,
    isFirst,
    isLast,
    onMoveLeft,
    onMoveRight,
    onReplace,
    onDelete,
    onIframeReady,
  } = props

  return (
    <article
      style={{
        minWidth: 0,
               border: '1px solid rgba(184, 134, 11, 0.1)',
        background: 'rgba(254, 253, 249, 0.94)',
        boxShadow: '0 18px 40px rgba(60, 30, 0, 0.07)',
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
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary btn-sm" disabled={actionsDisabled} onClick={onReplace}>
                <RefreshCw size={13} /> 替换
              </button>
              <button
                className="btn btn-sm"
                onClick={onDelete}
                style={{
                  background: 'linear-gradient(180deg, #fee2e2, #fecaca)',
                  borderColor: '#fca5a5',
                  color: '#b91c1c',
                }}
                title={'\u6c38\u4e45\u5220\u9664\u8fd9\u5f20\u89d2\u8272\u5361'}
              >
                <Trash2 size={13} /> 删除
              </button>
            </div>
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
                   border: '2px dashed rgba(184, 134, 11, 0.14)',
          background: 'rgba(254, 253, 249, 0.5)',
          color: '#a8a29e',
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        等待导入角色卡
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onImport}
      style={{
        minHeight: 680,
               border: '2px dashed rgba(184, 134, 11, 0.2)',
        background: 'rgba(254, 253, 249, 0.56)',
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
        padding: 18,
               border: '1px solid rgba(184, 134, 11, 0.08)',
        background: 'rgba(254, 253, 249, 0.92)',
        boxShadow: '0 16px 40px rgba(60, 30, 0, 0.06)',
      }}
    >
      <div style={{ marginBottom: 12, fontSize: 15, fontWeight: 800, color: '#29211b', letterSpacing: '0.01em' }}>活动记录</div>
      <div style={{ display: 'grid', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
        {logs.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9ca3af' }}>还没有记录。</div>
        ) : (
          [...logs].reverse().map((log) => (
            <div key={log.id} style={{ padding: 12, background: '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.18)' }}>
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
          padding: 20,
                   border: '1px solid rgba(185, 28, 28, 0.12)',
          background: 'linear-gradient(180deg, rgba(254, 242, 242, 0.96), rgba(255, 251, 245, 0.97))',
          boxShadow: '0 20px 48px rgba(185, 28, 28, 0.06), inset 0 1px 0 rgba(255,255,255,0.7)',
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
                    padding: '5px 12px',
                                       background: 'linear-gradient(135deg, #b91c1c, #991b1b)',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    boxShadow: '0 4px 12px rgba(185, 28, 28, 0.15)',
                  }}
                >
                  {'\u6050\u60e7\u70b9'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 64, lineHeight: 0.9, fontWeight: 900, color: '#7f1d1d', letterSpacing: '-0.03em' }}>{value}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#b91c1c' }}>/ {max}</span>
              </div>
              {editable && (
                <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: '#c2410c' }}>
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
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#29211b', letterSpacing: '0.01em' }}>{'\u8fdb\u5ea6\u949f'}</div>
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
                        padding: 14,
                                               border: '1px solid rgba(184, 134, 11, 0.2)',
                        background: 'linear-gradient(180deg, rgba(255,251,240,0.97), rgba(255,247,235,0.94))',
                        boxShadow: '0 4px 16px rgba(184, 134, 11, 0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
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
                                width: 28,
                                height: 28,
                                                               border: active ? '1px solid rgba(154, 109, 10, 0.45)' : '1px solid rgba(184, 134, 11, 0.18)',
                                background: active ? 'linear-gradient(135deg, #b8860b, #92400e)' : 'rgba(255,255,255,0.85)',
                                color: active ? 'white' : '#92400e',
                                fontSize: 12,
                                fontWeight: 800,
                                cursor: editable ? 'pointer' : 'default',
                                boxShadow: active ? '0 2px 8px rgba(184, 134, 11, 0.2)' : 'none',
                                transition: 'all var(--transition-fast)',
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
                  background: 'linear-gradient(180deg, #16a34a, #15803d)',
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
                  background: 'linear-gradient(180deg, #b91c1c, #991b1b)',
                  borderColor: '#b91c1c',
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
                  height: 44,
                                   border: active ? '1px solid rgba(185,28,28,0.4)' : '1px solid rgba(185,28,28,0.14)',
                  background: active ? `rgba(185, 28, 28, ${opacity})` : 'rgba(255,255,255,0.5)',
                  color: active ? 'white' : '#991b1b',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: editable ? 'pointer' : 'default',
                  boxShadow: active ? `0 2px 8px rgba(185,28,28,${opacity * 0.3})` : 'none',
                  transition: 'all var(--transition-fast)',
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
