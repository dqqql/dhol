import { ChevronLeft, ChevronRight, RefreshCw, Trash2 } from 'lucide-react'
import type { GmPanelCharacterSheetEntry } from '@dhgc/shared'
import type { GmPanelThemeDefinition } from '@/components/gm-panel/gmPanelThemes'
import type { SheetDocState } from '@/components/gm-panel/gmPanelTypes'

export function GmHtmlSheetCard(props: {
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
  theme: GmPanelThemeDefinition
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
    theme,
  } = props

  return (
    <article
      style={{
        minWidth: 0,
        border: `1px solid ${theme.colors.sheetCardBorder}`,
        background: theme.colors.sheetCardBackground,
        boxShadow: theme.colors.sheetCardShadow,
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
          borderBottom: `1px solid ${theme.colors.sheetHeaderBorder}`,
          background: theme.colors.sheetHeaderBackground,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: theme.colors.sheetTitle, marginBottom: 4 }}>
            {entry.parsed_sheet.character_name || '未命名角色'}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: theme.colors.sheetAccent,
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
              color: theme.colors.sheetMeta,
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
                  background: theme.colors.dangerSoftBackground,
                  borderColor: theme.colors.dangerSoftBorder,
                  color: theme.colors.dangerSoftText,
                }}
                title="永久删除这张角色卡"
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

      <div style={{ position: 'relative', height: 'calc(100vh - 280px)', minHeight: 680, background: theme.colors.sheetViewport }}>
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
              background: theme.colors.sheetViewport,
            }}
          />
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', color: theme.colors.logEmpty, fontSize: 13 }}>
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
              background: sheetState.error ? theme.colors.syncErrorBackground : theme.colors.syncBackground,
              color: theme.colors.syncText,
              fontSize: 12,
              lineHeight: 1.5,
              boxShadow: theme.colors.syncShadow,
            }}
          >
            {sheetState.error ?? '正在同步最新 HTML…'}
          </div>
        )}
      </div>
    </article>
  )
}
