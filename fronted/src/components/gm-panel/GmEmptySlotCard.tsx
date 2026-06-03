import type { GmPanelThemeDefinition } from '@/components/gm-panel/gmPanelThemes'

export function GmEmptySlotCard({ canImport, onImport, theme }: { canImport: boolean; onImport: () => void; theme: GmPanelThemeDefinition }) {
  if (!canImport) {
    return (
      <div
        style={{
          minHeight: 680,
          border: `2px dashed ${theme.colors.emptySlotBorder}`,
          background: theme.colors.emptySlotBackground,
          color: theme.colors.emptySlotText,
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
        border: `2px dashed ${theme.colors.emptySlotBorder}`,
        background: theme.colors.emptySlotBackground,
        color: theme.colors.statusText,
        cursor: 'pointer',
        fontSize: 15,
        fontWeight: 800,
      }}
    >
      导入 HTML 角色卡
    </button>
  )
}
