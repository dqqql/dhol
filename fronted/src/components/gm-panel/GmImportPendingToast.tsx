import type { GmPanelThemeDefinition } from '@/components/gm-panel/gmPanelThemes'
import type { ImportPendingState } from '@/components/gm-panel/gmPanelTypes'

export function GmImportPendingToast({ pendingImport, theme }: { pendingImport: ImportPendingState; theme: GmPanelThemeDefinition }) {
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
        border: `1px solid ${theme.colors.statusBorder}`,
        background: theme.colors.surfaceBackground,
        color: theme.colors.statusText,
        boxShadow: theme.colors.surfaceShadow,
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
