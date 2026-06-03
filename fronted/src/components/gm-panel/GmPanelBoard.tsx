import React, { useEffect, useRef, useState } from 'react'
import type { GmPanelCharacterSheetEntry } from '@dhgc/shared'
import { ChevronLeft, ChevronRight, FileUp, Trash2 } from 'lucide-react'
import { FloatingBattlePanel } from '@/components/gm-panel/FloatingBattlePanel'
import { getGmPanelTheme } from '@/components/gm-panel/gmPanelThemes'
import { GmActivityLogPanel } from '@/components/gm-panel/GmActivityLogPanel'
import { GmEmptySlotCard } from '@/components/gm-panel/GmEmptySlotCard'
import { GmFearTracker } from '@/components/gm-panel/GmFearTracker'
import { GmHtmlSheetCard } from '@/components/gm-panel/GmHtmlSheetCard'
import { GmImportPendingToast } from '@/components/gm-panel/GmImportPendingToast'
import type { ImportPendingState, ResourceMessage, SheetDocState } from '@/components/gm-panel/gmPanelTypes'
import { FloatingNotebook } from '@/components/notebook/FloatingNotebook'
import { Modal } from '@/components/ui/Modal'
import { fetchGmSheetHtml } from '@/lib/realtime'
import { useStore } from '@/store/useStore'
import { buildGmSheetSrcDoc, getGmSheetResourceSnapshot } from '@/utils/gmPanelHtml'

const SHEETS_PER_PAGE = 2

const SRD_CHARACTER_SHEET_ERROR = '请使用srd车卡器导出的角色卡'

function isSrdCharacterSheetHtml(html: string) {
  const head = html.slice(0, 20_000)
  return /<html\b[^>]*\bdata-version=["']1\.0["'][^>]*\bdata-exporter=["']daggerheart-character-sheet["']/i.test(head)
    && /<meta\b[^>]*\bname=["']generator["'][^>]*\bcontent=["']Daggerheart Character Sheet Exporter v1\.0["']/i.test(head)
    && /\b(?:window\s*\.\s*)?characterData\s*=/.test(html)
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
  const replayFailureReloadsRef = useRef<Record<string, string>>({})

  if (!room || room.room_type !== 'gm-panel' || !room.gm_panel) return null

  const panel = room.gm_panel
  const theme = getGmPanelTheme(room.settings.gm_panel_theme)
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

      // srcDoc iframes have a null origin, so '*' is the only valid target here
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
        if (replayFailureReloadsRef.current[entry.id] === entry.html_updated_at) return
        replayFailureReloadsRef.current[entry.id] = entry.html_updated_at

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
      if (!isSrdCharacterSheetHtml(html)) {
        throw new Error(SRD_CHARACTER_SHEET_ERROR)
      }

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
        background: theme.colors.pageBackground,
      }}
    >
      <div style={{ minWidth: 1320, padding: 20, display: 'grid', gap: 18 }}>
        <GmFearTracker
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
          theme={theme}
        />

        <section
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            padding: 16,
            border: `1px solid ${theme.colors.surfaceBorder}`,
            background: theme.colors.surfaceBackground,
            boxShadow: theme.colors.surfaceShadow,
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
                  border: `1px solid ${theme.colors.statusBorder}`,
                  background: theme.colors.statusBackground,
                  color: theme.colors.statusText,
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
            <div style={{ minWidth: 84, textAlign: 'center', fontSize: 13, fontWeight: 800, color: theme.colors.pageIndicator }}>
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
              <GmHtmlSheetCard
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
                theme={theme}
              />
            ) : (
              <GmEmptySlotCard
                key={`empty-${currentPage}-${index}`}
                canImport={!isImportPending}
                onImport={() => importInputRef.current?.click()}
                theme={theme}
              />
            )
          ))}
        </section>

        <GmActivityLogPanel logs={panel.activity_log} theme={theme} />
      </div>

      <FloatingBattlePanel roomId={room.room_id} />
      <FloatingNotebook roomId={room.room_id} />
      {pendingImport && <GmImportPendingToast pendingImport={pendingImport} theme={theme} />}

      <input ref={importInputRef} type="file" accept=".html,text/html" style={{ display: 'none' }} onChange={handleImportChange} />
      <input ref={replaceInputRef} type="file" accept=".html,text/html" style={{ display: 'none' }} onChange={handleReplaceChange} />

      <Modal open={Boolean(deleteTargetEntry)} onClose={closeDeleteConfirm} title="删除角色卡" maxWidth={460}>
        {deleteTargetEntry && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: theme.colors.dialogText }}>
              {deleteConfirmStep === 1
                ? `这将永久删除「${deleteTargetEntry.parsed_sheet.character_name || deleteTargetEntry.source_file_name}」。删除后无法恢复。`
                : `请再次确认：角色卡「${deleteTargetEntry.parsed_sheet.character_name || deleteTargetEntry.source_file_name}」会立刻从当前房间状态中移除。`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={closeDeleteConfirm}>
                取消
              </button>
              {deleteConfirmStep === 1 ? (
                <button
                  className="btn"
                  onClick={confirmDeleteStepOne}
                  style={{
                    background: theme.colors.fearActionBackground,
                    borderColor: theme.colors.fearActionBorder,
                    color: theme.colors.fearActionText,
                  }}
                >
                  我知道了，继续
                </button>
              ) : (
                <button
                  className="btn"
                  onClick={handleDeleteSheet}
                  style={{
                    background: theme.colors.fearActionBackground,
                    borderColor: theme.colors.fearActionBorder,
                    color: theme.colors.fearActionText,
                  }}
                >
                  <Trash2 size={14} /> 确认永久删除
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
