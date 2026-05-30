import type { GmPanelTheme } from '@dhgc/shared'

export interface GmPanelThemeDefinition {
  id: GmPanelTheme
  label: string
  summary: string
  preview: {
    hope: string
    fear: string
    base: string
  }
  colors: {
    pageBackground: string
    surfaceBorder: string
    surfaceBackground: string
    surfaceShadow: string
    statusBorder: string
    statusBackground: string
    statusText: string
    pageIndicator: string
    dialogText: string
    dangerSoftBackground: string
    dangerSoftBorder: string
    dangerSoftText: string
    sheetCardBorder: string
    sheetCardBackground: string
    sheetCardShadow: string
    sheetHeaderBorder: string
    sheetHeaderBackground: string
    sheetTitle: string
    sheetAccent: string
    sheetMeta: string
    sheetViewport: string
    syncBackground: string
    syncErrorBackground: string
    syncText: string
    syncShadow: string
    emptySlotBorder: string
    emptySlotBackground: string
    emptySlotText: string
    logBorder: string
    logBackground: string
    logShadow: string
    logTitle: string
    logEmpty: string
    logItemBackground: string
    logItemBorder: string
    logActor: string
    logTime: string
    logText: string
    fearPanelBorder: string
    fearPanelBackground: string
    fearPanelShadow: string
    fearBadgeBackground: string
    fearBadgeText: string
    fearBadgeShadow: string
    fearValue: string
    fearValueMuted: string
    fearHint: string
    countdownTitle: string
    countdownOverflow: string
    countdownCardBorder: string
    countdownCardBackground: string
    countdownCardShadow: string
    countdownName: string
    countdownValue: string
    countdownDelete: string
    countdownStepActiveBorder: string
    countdownStepActiveBackground: string
    countdownStepActiveText: string
    countdownStepActiveShadow: string
    countdownStepInactiveBorder: string
    countdownStepInactiveBackground: string
    countdownStepInactiveText: string
    hopeActionBackground: string
    hopeActionBorder: string
    hopeActionText: string
    fearActionBackground: string
    fearActionBorder: string
    fearActionText: string
    fearTrackActiveBorder: string
    fearTrackActiveText: string
    fearTrackInactiveBorder: string
    fearTrackInactiveBackground: string
    fearTrackInactiveText: string
    fearTrackActiveRgb: string
    iconBorder: string
    iconBackground: string
    iconBackgroundDisabled: string
    iconText: string
    iconTextDisabled: string
  }
}

export const GM_PANEL_THEMES: GmPanelThemeDefinition[] = [
  {
    id: 'violet-mint',
    label: '暮紫薄荷',
    summary: '希望是薄荷微光，恐惧是绯红回响。',
    preview: { hope: '#8be0d5', fear: '#b12d3f', base: '#27185a' },
    colors: {
      pageBackground: 'radial-gradient(circle at 12% 4%, rgba(139,224,213,0.14), transparent 22%), radial-gradient(circle at 88% 10%, rgba(109,91,208,0.14), transparent 24%), linear-gradient(180deg, #f6f4fb 0%, #d9d4eb 100%)',
      surfaceBorder: 'rgba(139, 224, 213, 0.26)',
      surfaceBackground: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(232,228,242,0.88))',
      surfaceShadow: '0 18px 44px rgba(35, 20, 68, 0.10)',
      statusBorder: 'rgba(139, 224, 213, 0.32)',
      statusBackground: 'rgba(239, 252, 250, 0.88)',
      statusText: '#4a357e',
      pageIndicator: '#4a357e',
      dialogText: '#4b5563',
      dangerSoftBackground: 'linear-gradient(180deg, #fde7eb, #f7c8d0)',
      dangerSoftBorder: '#eaa3ae',
      dangerSoftText: '#b91c1c',
      sheetCardBorder: 'rgba(139, 224, 213, 0.28)',
      sheetCardBackground: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(232,228,242,0.94))',
      sheetCardShadow: '0 18px 42px rgba(35, 20, 68, 0.12)',
      sheetHeaderBorder: 'rgba(128, 96, 35, 0.18)',
      sheetHeaderBackground: 'linear-gradient(90deg, rgba(24,15,59,0.94), rgba(39,24,90,0.86))',
      sheetTitle: '#f7f2ff',
      sheetAccent: '#8be0d5',
      sheetMeta: 'rgba(247,242,255,0.58)',
      sheetViewport: '#f0edf8',
      syncBackground: 'rgba(124,79,49,0.85)',
      syncErrorBackground: 'rgba(127,29,29,0.9)',
      syncText: '#ffffff',
      syncShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
      emptySlotBorder: 'rgba(184, 134, 11, 0.18)',
      emptySlotBackground: 'rgba(251, 251, 255, 0.62)',
      emptySlotText: '#7c719a',
      logBorder: 'rgba(139, 224, 213, 0.24)',
      logBackground: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(232,228,242,0.90))',
      logShadow: '0 16px 40px rgba(35, 20, 68, 0.10)',
      logTitle: '#29211b',
      logEmpty: '#9ca3af',
      logItemBackground: 'rgba(251,251,255,0.82)',
      logItemBorder: 'rgba(39, 24, 90, 0.14)',
      logActor: '#4a357e',
      logTime: '#94a3b8',
      logText: '#1f2937',
      fearPanelBorder: 'rgba(177, 45, 63, 0.22)',
      fearPanelBackground: 'linear-gradient(180deg, rgba(24,15,59,0.97), rgba(39,24,90,0.93))',
      fearPanelShadow: '0 22px 54px rgba(35, 20, 68, 0.22), inset 0 1px 0 rgba(255,255,255,0.10)',
      fearBadgeBackground: 'linear-gradient(135deg, #b12d3f, #8f1f34)',
      fearBadgeText: '#f7f2ff',
      fearBadgeShadow: '0 4px 12px rgba(185, 28, 28, 0.15)',
      fearValue: '#f7f2ff',
      fearValueMuted: '#ffccd4',
      fearHint: 'rgba(247,242,255,0.72)',
      countdownTitle: '#8be0d5',
      countdownOverflow: '#9ca3af',
      countdownCardBorder: 'rgba(139, 224, 213, 0.26)',
      countdownCardBackground: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(232,228,242,0.96))',
      countdownCardShadow: '0 6px 18px rgba(35, 20, 68, 0.10), inset 0 1px 0 rgba(255,255,255,0.8)',
      countdownName: '#27185a',
      countdownValue: '#6d5bd0',
      countdownDelete: '#b12d3f',
      countdownStepActiveBorder: 'rgba(139, 224, 213, 0.58)',
      countdownStepActiveBackground: 'linear-gradient(135deg, #8be0d5, #2f9d91)',
      countdownStepActiveText: '#171027',
      countdownStepActiveShadow: '0 2px 10px rgba(47, 157, 145, 0.24)',
      countdownStepInactiveBorder: 'rgba(39, 24, 90, 0.16)',
      countdownStepInactiveBackground: 'rgba(255,255,255,0.92)',
      countdownStepInactiveText: '#4a357e',
      hopeActionBackground: 'linear-gradient(180deg, #8be0d5, #2f9d91)',
      hopeActionBorder: '#16a34a',
      hopeActionText: '#171027',
      fearActionBackground: 'linear-gradient(180deg, #b12d3f, #8f1f34)',
      fearActionBorder: '#8f1f34',
      fearActionText: '#f7f2ff',
      fearTrackActiveBorder: 'rgba(185,28,28,0.4)',
      fearTrackActiveText: '#f7f2ff',
      fearTrackInactiveBorder: 'rgba(185,28,28,0.14)',
      fearTrackInactiveBackground: 'rgba(255,255,255,0.10)',
      fearTrackInactiveText: '#ffccd4',
      fearTrackActiveRgb: '177, 45, 63',
      iconBorder: 'rgba(15, 23, 42, 0.1)',
      iconBackground: '#ffffff',
      iconBackgroundDisabled: 'rgba(248,250,252,0.9)',
      iconText: '#64748b',
      iconTextDisabled: '#cbd5e1',
    },
  },
  {
    id: 'solar-abyss',
    label: '曜金深渊',
    summary: '希望像日蚀边缘的金光，恐惧像深海里的钴蓝。',
    preview: { hope: '#f6c65b', fear: '#3368ff', base: '#193766' },
    colors: {
      pageBackground: 'radial-gradient(circle at 14% 8%, rgba(246,198,91,0.18), transparent 22%), radial-gradient(circle at 84% 12%, rgba(51,104,255,0.16), transparent 26%), linear-gradient(180deg, #fbf4df 0%, #d8e5f8 100%)',
      surfaceBorder: 'rgba(65, 118, 255, 0.24)',
      surfaceBackground: 'linear-gradient(180deg, rgba(255,251,241,0.96), rgba(232,240,255,0.92))',
      surfaceShadow: '0 18px 44px rgba(22, 42, 83, 0.12)',
      statusBorder: 'rgba(246, 198, 91, 0.34)',
      statusBackground: 'rgba(255, 248, 225, 0.92)',
      statusText: '#24418f',
      pageIndicator: '#24418f',
      dialogText: '#344256',
      dangerSoftBackground: 'linear-gradient(180deg, #e9efff, #d4e0ff)',
      dangerSoftBorder: '#9bb5ff',
      dangerSoftText: '#1d4ed8',
      sheetCardBorder: 'rgba(65, 118, 255, 0.28)',
      sheetCardBackground: 'linear-gradient(180deg, rgba(255,251,243,0.98), rgba(232,240,255,0.96))',
      sheetCardShadow: '0 18px 42px rgba(18, 38, 76, 0.12)',
      sheetHeaderBorder: 'rgba(246, 198, 91, 0.22)',
      sheetHeaderBackground: 'linear-gradient(90deg, rgba(16,33,63,0.95), rgba(25,55,102,0.90))',
      sheetTitle: '#fef7e6',
      sheetAccent: '#f6c65b',
      sheetMeta: 'rgba(255,247,230,0.60)',
      sheetViewport: '#e8eef8',
      syncBackground: 'rgba(64,94,153,0.88)',
      syncErrorBackground: 'rgba(29,78,216,0.92)',
      syncText: '#ffffff',
      syncShadow: '0 10px 24px rgba(15, 32, 61, 0.20)',
      emptySlotBorder: 'rgba(246, 198, 91, 0.20)',
      emptySlotBackground: 'rgba(255, 250, 240, 0.72)',
      emptySlotText: '#7a7d92',
      logBorder: 'rgba(65, 118, 255, 0.22)',
      logBackground: 'linear-gradient(180deg, rgba(255,251,241,0.95), rgba(232,240,255,0.92))',
      logShadow: '0 16px 40px rgba(20, 39, 75, 0.10)',
      logTitle: '#2a230f',
      logEmpty: '#8b96ab',
      logItemBackground: 'rgba(252,248,239,0.86)',
      logItemBorder: 'rgba(37, 99, 235, 0.16)',
      logActor: '#24418f',
      logTime: '#7a8daa',
      logText: '#1f2937',
      fearPanelBorder: 'rgba(51, 104, 255, 0.24)',
      fearPanelBackground: 'linear-gradient(180deg, rgba(16,33,63,0.97), rgba(25,55,102,0.94))',
      fearPanelShadow: '0 22px 54px rgba(16, 33, 63, 0.28), inset 0 1px 0 rgba(255,255,255,0.08)',
      fearBadgeBackground: 'linear-gradient(135deg, #3368ff, #1d4ed8)',
      fearBadgeText: '#eef4ff',
      fearBadgeShadow: '0 4px 12px rgba(37, 99, 235, 0.20)',
      fearValue: '#fff7e6',
      fearValueMuted: '#ffd98c',
      fearHint: 'rgba(255,247,230,0.76)',
      countdownTitle: '#f6c65b',
      countdownOverflow: '#b6bfd3',
      countdownCardBorder: 'rgba(246, 198, 91, 0.24)',
      countdownCardBackground: 'linear-gradient(180deg, rgba(255,251,241,0.98), rgba(236,243,255,0.96))',
      countdownCardShadow: '0 6px 18px rgba(20, 39, 75, 0.12), inset 0 1px 0 rgba(255,255,255,0.84)',
      countdownName: '#10213f',
      countdownValue: '#24418f',
      countdownDelete: '#1d4ed8',
      countdownStepActiveBorder: 'rgba(246, 198, 91, 0.64)',
      countdownStepActiveBackground: 'linear-gradient(135deg, #f6c65b, #e69e24)',
      countdownStepActiveText: '#2c1d00',
      countdownStepActiveShadow: '0 2px 10px rgba(230, 158, 36, 0.28)',
      countdownStepInactiveBorder: 'rgba(36, 65, 143, 0.16)',
      countdownStepInactiveBackground: 'rgba(255,255,255,0.92)',
      countdownStepInactiveText: '#24418f',
      hopeActionBackground: 'linear-gradient(180deg, #f6c65b, #e69e24)',
      hopeActionBorder: '#d97706',
      hopeActionText: '#2c1d00',
      fearActionBackground: 'linear-gradient(180deg, #3368ff, #1d4ed8)',
      fearActionBorder: '#1e40af',
      fearActionText: '#eef4ff',
      fearTrackActiveBorder: 'rgba(51,104,255,0.40)',
      fearTrackActiveText: '#fef7e6',
      fearTrackInactiveBorder: 'rgba(246,198,91,0.18)',
      fearTrackInactiveBackground: 'rgba(255,255,255,0.10)',
      fearTrackInactiveText: '#ffd98c',
      fearTrackActiveRgb: '51, 104, 255',
      iconBorder: 'rgba(16, 33, 63, 0.12)',
      iconBackground: '#ffffff',
      iconBackgroundDisabled: 'rgba(244,247,252,0.92)',
      iconText: '#5a6d8f',
      iconTextDisabled: '#c1cadb',
    },
  },
  {
    id: 'frost-ember',
    label: '霜青余烬',
    summary: '希望像冰面反光，恐惧像灰烬里复燃的火。',
    preview: { hope: '#9be7ff', fear: '#db6a3d', base: '#3a5368' },
    colors: {
      pageBackground: 'radial-gradient(circle at 12% 6%, rgba(155,231,255,0.18), transparent 22%), radial-gradient(circle at 87% 10%, rgba(219,106,61,0.14), transparent 25%), linear-gradient(180deg, #eef5f7 0%, #e6dbd8 100%)',
      surfaceBorder: 'rgba(59, 165, 214, 0.24)',
      surfaceBackground: 'linear-gradient(180deg, rgba(252,254,255,0.96), rgba(239,233,229,0.92))',
      surfaceShadow: '0 18px 44px rgba(37, 55, 68, 0.11)',
      statusBorder: 'rgba(155, 231, 255, 0.34)',
      statusBackground: 'rgba(236, 249, 255, 0.92)',
      statusText: '#49667a',
      pageIndicator: '#49667a',
      dialogText: '#44505a',
      dangerSoftBackground: 'linear-gradient(180deg, #fff0ea, #ffd8cb)',
      dangerSoftBorder: '#efb09b',
      dangerSoftText: '#b94726',
      sheetCardBorder: 'rgba(59, 165, 214, 0.26)',
      sheetCardBackground: 'linear-gradient(180deg, rgba(252,254,255,0.98), rgba(239,233,229,0.94))',
      sheetCardShadow: '0 18px 42px rgba(34, 51, 66, 0.12)',
      sheetHeaderBorder: 'rgba(155, 231, 255, 0.18)',
      sheetHeaderBackground: 'linear-gradient(90deg, rgba(34,51,66,0.95), rgba(58,83,104,0.90))',
      sheetTitle: '#f7fbff',
      sheetAccent: '#9be7ff',
      sheetMeta: 'rgba(247,251,255,0.62)',
      sheetViewport: '#edf2f4',
      syncBackground: 'rgba(73,102,122,0.88)',
      syncErrorBackground: 'rgba(185,71,38,0.92)',
      syncText: '#ffffff',
      syncShadow: '0 10px 24px rgba(34, 51, 66, 0.20)',
      emptySlotBorder: 'rgba(120, 143, 156, 0.24)',
      emptySlotBackground: 'rgba(252, 254, 255, 0.68)',
      emptySlotText: '#7d8791',
      logBorder: 'rgba(59, 165, 214, 0.22)',
      logBackground: 'linear-gradient(180deg, rgba(252,254,255,0.95), rgba(239,233,229,0.92))',
      logShadow: '0 16px 40px rgba(34, 51, 66, 0.10)',
      logTitle: '#28333a',
      logEmpty: '#8f9aa5',
      logItemBackground: 'rgba(253,253,253,0.84)',
      logItemBorder: 'rgba(58, 83, 104, 0.14)',
      logActor: '#49667a',
      logTime: '#8c99a4',
      logText: '#25303a',
      fearPanelBorder: 'rgba(219, 106, 61, 0.24)',
      fearPanelBackground: 'linear-gradient(180deg, rgba(34,51,66,0.97), rgba(58,83,104,0.94))',
      fearPanelShadow: '0 22px 54px rgba(34, 51, 66, 0.26), inset 0 1px 0 rgba(255,255,255,0.10)',
      fearBadgeBackground: 'linear-gradient(135deg, #db6a3d, #b94726)',
      fearBadgeText: '#fff7f2',
      fearBadgeShadow: '0 4px 12px rgba(185, 71, 38, 0.20)',
      fearValue: '#f7fbff',
      fearValueMuted: '#ffd3c2',
      fearHint: 'rgba(247,251,255,0.74)',
      countdownTitle: '#9be7ff',
      countdownOverflow: '#b5c0c9',
      countdownCardBorder: 'rgba(155, 231, 255, 0.22)',
      countdownCardBackground: 'linear-gradient(180deg, rgba(252,254,255,0.98), rgba(242,236,232,0.96))',
      countdownCardShadow: '0 6px 18px rgba(34, 51, 66, 0.10), inset 0 1px 0 rgba(255,255,255,0.82)',
      countdownName: '#223342',
      countdownValue: '#49667a',
      countdownDelete: '#b94726',
      countdownStepActiveBorder: 'rgba(155, 231, 255, 0.58)',
      countdownStepActiveBackground: 'linear-gradient(135deg, #9be7ff, #3ba5d6)',
      countdownStepActiveText: '#0d2835',
      countdownStepActiveShadow: '0 2px 10px rgba(59, 165, 214, 0.26)',
      countdownStepInactiveBorder: 'rgba(58, 83, 104, 0.16)',
      countdownStepInactiveBackground: 'rgba(255,255,255,0.92)',
      countdownStepInactiveText: '#49667a',
      hopeActionBackground: 'linear-gradient(180deg, #9be7ff, #3ba5d6)',
      hopeActionBorder: '#2a84b0',
      hopeActionText: '#0d2835',
      fearActionBackground: 'linear-gradient(180deg, #db6a3d, #b94726)',
      fearActionBorder: '#9f3f22',
      fearActionText: '#fff7f2',
      fearTrackActiveBorder: 'rgba(219,106,61,0.40)',
      fearTrackActiveText: '#fff7f2',
      fearTrackInactiveBorder: 'rgba(255,211,194,0.18)',
      fearTrackInactiveBackground: 'rgba(255,255,255,0.10)',
      fearTrackInactiveText: '#ffd3c2',
      fearTrackActiveRgb: '219, 106, 61',
      iconBorder: 'rgba(34, 51, 66, 0.12)',
      iconBackground: '#ffffff',
      iconBackgroundDisabled: 'rgba(245,247,248,0.92)',
      iconText: '#667785',
      iconTextDisabled: '#c7d0d7',
    },
  },
]

export function getGmPanelTheme(themeId?: GmPanelTheme): GmPanelThemeDefinition {
  return GM_PANEL_THEMES.find((theme) => theme.id === themeId) ?? GM_PANEL_THEMES[0]
}
