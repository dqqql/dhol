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
    // ─── Theme 1: Gold × Crimson — parchment manuscript meets void darkness ───
    id: 'gold-abyss',
    label: '熔金炽渊',
    summary: '希望是羊皮纸上灼烧的赤金封印，恐惧是深渊涌动的血色烈焰。',
    preview: { hope: '#E0A830', fear: '#8F1A2C', base: '#2A1C0A' },
    colors: {
      pageBackground: 'radial-gradient(circle at 11% 5%, rgba(224,168,48,0.22), transparent 26%), radial-gradient(circle at 88% 8%, rgba(143,26,44,0.18), transparent 26%), linear-gradient(180deg, #faf4e2 0%, #f0e5c8 55%, #e5d5ad 100%)',
      surfaceBorder: 'rgba(224, 168, 48, 0.28)',
      surfaceBackground: 'linear-gradient(180deg, rgba(255,252,244,0.96), rgba(240,232,210,0.90))',
      surfaceShadow: '0 18px 44px rgba(36, 18, 4, 0.12)',
      statusBorder: 'rgba(224, 168, 48, 0.38)',
      statusBackground: 'rgba(255, 248, 220, 0.92)',
      statusText: '#5C3A10',
      pageIndicator: '#5C3A10',
      dialogText: '#4A3520',
      dangerSoftBackground: 'linear-gradient(180deg, #fde8ec, #f7c8d2)',
      dangerSoftBorder: '#D4909A',
      dangerSoftText: '#8F1A2C',
      sheetCardBorder: 'rgba(224, 168, 48, 0.30)',
      sheetCardBackground: 'linear-gradient(180deg, rgba(255,252,244,0.98), rgba(242,233,212,0.96))',
      sheetCardShadow: '0 18px 42px rgba(36, 18, 4, 0.14)',
      sheetHeaderBorder: 'rgba(224, 168, 48, 0.24)',
      sheetHeaderBackground: 'linear-gradient(90deg, rgba(24,12,6,0.96), rgba(45,30,15,0.92))',
      sheetTitle: '#FFF5D6',
      sheetAccent: '#E0A830',
      sheetMeta: 'rgba(255,245,214,0.60)',
      sheetViewport: '#EDE0C4',
      syncBackground: 'rgba(92,58,16,0.88)',
      syncErrorBackground: 'rgba(120,22,38,0.92)',
      syncText: '#ffffff',
      syncShadow: '0 10px 24px rgba(24, 12, 4, 0.22)',
      emptySlotBorder: 'rgba(180, 140, 50, 0.22)',
      emptySlotBackground: 'rgba(255, 252, 240, 0.68)',
      emptySlotText: '#8A6A30',
      logBorder: 'rgba(224, 168, 48, 0.24)',
      logBackground: 'linear-gradient(180deg, rgba(255,252,244,0.96), rgba(240,232,210,0.92))',
      logShadow: '0 16px 40px rgba(36, 18, 4, 0.10)',
      logTitle: '#2A1C0A',
      logEmpty: '#A09080',
      logItemBackground: 'rgba(255,252,240,0.84)',
      logItemBorder: 'rgba(92, 58, 16, 0.16)',
      logActor: '#5C3A10',
      logTime: '#A09080',
      logText: '#1C1008',
      fearPanelBorder: 'rgba(143, 26, 44, 0.30)',
      fearPanelBackground: 'linear-gradient(180deg, rgba(24,12,6,0.98), rgba(45,30,15,0.96))',
      fearPanelShadow: '0 22px 54px rgba(24, 12, 4, 0.32), inset 0 1px 0 rgba(255,255,255,0.08)',
      fearBadgeBackground: 'linear-gradient(135deg, #8F1A2C, #6E1220)',
      fearBadgeText: '#FFF5D6',
      fearBadgeShadow: '0 4px 12px rgba(143, 26, 44, 0.24)',
      fearValue: '#FFF5D6',
      fearValueMuted: '#FFCCD4',
      fearHint: 'rgba(255,245,214,0.72)',
      countdownTitle: '#E0A830',
      countdownOverflow: '#A09080',
      countdownCardBorder: 'rgba(224, 168, 48, 0.26)',
      countdownCardBackground: 'linear-gradient(180deg, rgba(255,252,244,0.98), rgba(242,233,212,0.96))',
      countdownCardShadow: '0 6px 18px rgba(36, 18, 4, 0.12), inset 0 1px 0 rgba(255,255,255,0.84)',
      countdownName: '#2A1C0A',
      countdownValue: '#8A5A1A',
      countdownDelete: '#8F1A2C',
      countdownStepActiveBorder: 'rgba(224, 168, 48, 0.62)',
      countdownStepActiveBackground: 'linear-gradient(135deg, #E0A830, #B88020)',
      countdownStepActiveText: '#1A0C04',
      countdownStepActiveShadow: '0 2px 10px rgba(184, 128, 32, 0.28)',
      countdownStepInactiveBorder: 'rgba(92, 58, 16, 0.18)',
      countdownStepInactiveBackground: 'rgba(255,252,240,0.92)',
      countdownStepInactiveText: '#5C3A10',
      hopeActionBackground: 'linear-gradient(180deg, #E0A830, #B88020)',
      hopeActionBorder: '#A07018',
      hopeActionText: '#1A0C04',
      fearActionBackground: 'linear-gradient(180deg, #8F1A2C, #6E1220)',
      fearActionBorder: '#5A0E18',
      fearActionText: '#FFF5D6',
      fearTrackActiveBorder: 'rgba(143,26,44,0.44)',
      fearTrackActiveText: '#FFF5D6',
      fearTrackInactiveBorder: 'rgba(224,168,48,0.18)',
      fearTrackInactiveBackground: 'rgba(255,255,255,0.10)',
      fearTrackInactiveText: '#FFCCD4',
      fearTrackActiveRgb: '143, 26, 44',
      iconBorder: 'rgba(36, 18, 4, 0.14)',
      iconBackground: '#FFFBF0',
      iconBackgroundDisabled: 'rgba(248,245,234,0.92)',
      iconText: '#7A5A30',
      iconTextDisabled: '#C8B890',
    },
  },
  {
    // ─── Theme 2: Jade × Blood — malachite life clashing against arterial crimson ───
    id: 'jade-hex',
    label: '翡翠血咒',
    summary: '希望是翡翠苔痕间涌现的碧光，恐惧是献祭仪式后蔓延的绯红。',
    preview: { hope: '#2CC97A', fear: '#C42048', base: '#0E1C14' },
    colors: {
      pageBackground: 'radial-gradient(circle at 10% 6%, rgba(44,201,122,0.18), transparent 24%), radial-gradient(circle at 89% 7%, rgba(196,32,72,0.16), transparent 24%), linear-gradient(180deg, #f0faf4 0%, #daf2e4 52%, #c8eada 100%)',
      surfaceBorder: 'rgba(44, 201, 122, 0.26)',
      surfaceBackground: 'linear-gradient(180deg, rgba(248,255,252,0.96), rgba(220,242,230,0.90))',
      surfaceShadow: '0 18px 44px rgba(8, 36, 20, 0.12)',
      statusBorder: 'rgba(44, 201, 122, 0.36)',
      statusBackground: 'rgba(220, 252, 236, 0.92)',
      statusText: '#165432',
      pageIndicator: '#165432',
      dialogText: '#223C2A',
      dangerSoftBackground: 'linear-gradient(180deg, #fde8ec, #f7c8d6)',
      dangerSoftBorder: '#E090A4',
      dangerSoftText: '#C42048',
      sheetCardBorder: 'rgba(44, 201, 122, 0.28)',
      sheetCardBackground: 'linear-gradient(180deg, rgba(248,255,252,0.98), rgba(224,244,232,0.96))',
      sheetCardShadow: '0 18px 42px rgba(8, 36, 20, 0.14)',
      sheetHeaderBorder: 'rgba(44, 201, 122, 0.20)',
      sheetHeaderBackground: 'linear-gradient(90deg, rgba(8,24,14,0.97), rgba(14,28,20,0.94))',
      sheetTitle: '#F0FFF8',
      sheetAccent: '#2CC97A',
      sheetMeta: 'rgba(240,255,248,0.58)',
      sheetViewport: '#DAF2E4',
      syncBackground: 'rgba(20,80,44,0.88)',
      syncErrorBackground: 'rgba(160,24,50,0.92)',
      syncText: '#ffffff',
      syncShadow: '0 10px 24px rgba(8, 28, 16, 0.22)',
      emptySlotBorder: 'rgba(44, 180, 100, 0.22)',
      emptySlotBackground: 'rgba(240, 254, 248, 0.68)',
      emptySlotText: '#3A7A52',
      logBorder: 'rgba(44, 201, 122, 0.22)',
      logBackground: 'linear-gradient(180deg, rgba(248,255,252,0.96), rgba(224,244,232,0.92))',
      logShadow: '0 16px 40px rgba(8, 36, 20, 0.10)',
      logTitle: '#0A1C10',
      logEmpty: '#82A890',
      logItemBackground: 'rgba(240,255,248,0.84)',
      logItemBorder: 'rgba(14, 28, 20, 0.14)',
      logActor: '#165432',
      logTime: '#82A890',
      logText: '#0A1C10',
      fearPanelBorder: 'rgba(196, 32, 72, 0.28)',
      fearPanelBackground: 'linear-gradient(180deg, rgba(8,24,14,0.98), rgba(14,28,20,0.96))',
      fearPanelShadow: '0 22px 54px rgba(8, 24, 12, 0.32), inset 0 1px 0 rgba(255,255,255,0.08)',
      fearBadgeBackground: 'linear-gradient(135deg, #C42048, #9A1438)',
      fearBadgeText: '#FFF0F4',
      fearBadgeShadow: '0 4px 12px rgba(196, 32, 72, 0.24)',
      fearValue: '#F0FFF8',
      fearValueMuted: '#FFD0DC',
      fearHint: 'rgba(240,255,248,0.72)',
      countdownTitle: '#2CC97A',
      countdownOverflow: '#82A890',
      countdownCardBorder: 'rgba(44, 201, 122, 0.24)',
      countdownCardBackground: 'linear-gradient(180deg, rgba(248,255,252,0.98), rgba(228,246,236,0.96))',
      countdownCardShadow: '0 6px 18px rgba(8, 36, 20, 0.12), inset 0 1px 0 rgba(255,255,255,0.84)',
      countdownName: '#0A1C10',
      countdownValue: '#165432',
      countdownDelete: '#C42048',
      countdownStepActiveBorder: 'rgba(44, 201, 122, 0.60)',
      countdownStepActiveBackground: 'linear-gradient(135deg, #2CC97A, #1EA860)',
      countdownStepActiveText: '#061410',
      countdownStepActiveShadow: '0 2px 10px rgba(30, 168, 96, 0.26)',
      countdownStepInactiveBorder: 'rgba(14, 28, 20, 0.16)',
      countdownStepInactiveBackground: 'rgba(248,255,252,0.92)',
      countdownStepInactiveText: '#165432',
      hopeActionBackground: 'linear-gradient(180deg, #2CC97A, #1EA860)',
      hopeActionBorder: '#16924E',
      hopeActionText: '#061410',
      fearActionBackground: 'linear-gradient(180deg, #C42048, #9A1438)',
      fearActionBorder: '#7A0E2C',
      fearActionText: '#FFF0F4',
      fearTrackActiveBorder: 'rgba(196,32,72,0.42)',
      fearTrackActiveText: '#F0FFF8',
      fearTrackInactiveBorder: 'rgba(44,201,122,0.18)',
      fearTrackInactiveBackground: 'rgba(255,255,255,0.10)',
      fearTrackInactiveText: '#FFD0DC',
      fearTrackActiveRgb: '196, 32, 72',
      iconBorder: 'rgba(8, 36, 20, 0.14)',
      iconBackground: '#F0FFF8',
      iconBackgroundDisabled: 'rgba(236,252,244,0.92)',
      iconText: '#3A7A52',
      iconTextDisabled: '#A8C4B4',
    },
  },
  {
    // ─── Theme 3: Amethyst × Ember — arcane violet against smoldering orange ───
    id: 'amethyst-ember',
    label: '紫晶烬火',
    summary: '希望是奥法水晶折射的幽紫星光，恐惧是炙烤灵魂的琥珀烈焰。',
    preview: { hope: '#9D4EDD', fear: '#D4651A', base: '#14082C' },
    colors: {
      pageBackground: 'radial-gradient(circle at 12% 5%, rgba(157,78,221,0.20), transparent 26%), radial-gradient(circle at 86% 8%, rgba(212,101,26,0.18), transparent 25%), linear-gradient(180deg, #f6f0ff 0%, #ecddf8 52%, #e0caf0 100%)',
      surfaceBorder: 'rgba(157, 78, 221, 0.26)',
      surfaceBackground: 'linear-gradient(180deg, rgba(255,252,255,0.96), rgba(236,224,252,0.90))',
      surfaceShadow: '0 18px 44px rgba(20, 8, 44, 0.12)',
      statusBorder: 'rgba(157, 78, 221, 0.34)',
      statusBackground: 'rgba(244, 236, 255, 0.92)',
      statusText: '#4A1A80',
      pageIndicator: '#4A1A80',
      dialogText: '#3C2850',
      dangerSoftBackground: 'linear-gradient(180deg, #fff0e8, #ffd8c0)',
      dangerSoftBorder: '#F0AA80',
      dangerSoftText: '#B84A10',
      sheetCardBorder: 'rgba(157, 78, 221, 0.28)',
      sheetCardBackground: 'linear-gradient(180deg, rgba(255,252,255,0.98), rgba(238,226,252,0.96))',
      sheetCardShadow: '0 18px 42px rgba(20, 8, 44, 0.14)',
      sheetHeaderBorder: 'rgba(212, 101, 26, 0.22)',
      sheetHeaderBackground: 'linear-gradient(90deg, rgba(20,8,44,0.97), rgba(34,14,70,0.94))',
      sheetTitle: '#F8F0FF',
      sheetAccent: '#9D4EDD',
      sheetMeta: 'rgba(248,240,255,0.60)',
      sheetViewport: '#ECDDF8',
      syncBackground: 'rgba(72,28,120,0.88)',
      syncErrorBackground: 'rgba(176,68,10,0.92)',
      syncText: '#ffffff',
      syncShadow: '0 10px 24px rgba(20, 8, 44, 0.22)',
      emptySlotBorder: 'rgba(157, 78, 221, 0.22)',
      emptySlotBackground: 'rgba(252, 248, 255, 0.70)',
      emptySlotText: '#6A3A90',
      logBorder: 'rgba(157, 78, 221, 0.22)',
      logBackground: 'linear-gradient(180deg, rgba(255,252,255,0.96), rgba(236,224,252,0.92))',
      logShadow: '0 16px 40px rgba(20, 8, 44, 0.10)',
      logTitle: '#1A0830',
      logEmpty: '#9A88B0',
      logItemBackground: 'rgba(250,246,255,0.84)',
      logItemBorder: 'rgba(40, 16, 70, 0.14)',
      logActor: '#4A1A80',
      logTime: '#9A88B0',
      logText: '#1A0830',
      fearPanelBorder: 'rgba(212, 101, 26, 0.30)',
      fearPanelBackground: 'linear-gradient(180deg, rgba(20,8,44,0.98), rgba(34,14,70,0.96))',
      fearPanelShadow: '0 22px 54px rgba(20, 8, 44, 0.32), inset 0 1px 0 rgba(255,255,255,0.08)',
      fearBadgeBackground: 'linear-gradient(135deg, #D4651A, #AA4E12)',
      fearBadgeText: '#FFF4EC',
      fearBadgeShadow: '0 4px 12px rgba(212, 101, 26, 0.26)',
      fearValue: '#F8F0FF',
      fearValueMuted: '#FFD8C0',
      fearHint: 'rgba(248,240,255,0.72)',
      countdownTitle: '#9D4EDD',
      countdownOverflow: '#9A88B0',
      countdownCardBorder: 'rgba(157, 78, 221, 0.24)',
      countdownCardBackground: 'linear-gradient(180deg, rgba(255,252,255,0.98), rgba(240,228,255,0.96))',
      countdownCardShadow: '0 6px 18px rgba(20, 8, 44, 0.12), inset 0 1px 0 rgba(255,255,255,0.84)',
      countdownName: '#1A0830',
      countdownValue: '#4A1A80',
      countdownDelete: '#B84A10',
      countdownStepActiveBorder: 'rgba(157, 78, 221, 0.60)',
      countdownStepActiveBackground: 'linear-gradient(135deg, #9D4EDD, #7C30BC)',
      countdownStepActiveText: '#F8F0FF',
      countdownStepActiveShadow: '0 2px 10px rgba(124, 48, 188, 0.26)',
      countdownStepInactiveBorder: 'rgba(40, 16, 70, 0.18)',
      countdownStepInactiveBackground: 'rgba(252,248,255,0.92)',
      countdownStepInactiveText: '#4A1A80',
      hopeActionBackground: 'linear-gradient(180deg, #9D4EDD, #7C30BC)',
      hopeActionBorder: '#6A28A4',
      hopeActionText: '#F8F0FF',
      fearActionBackground: 'linear-gradient(180deg, #D4651A, #AA4E12)',
      fearActionBorder: '#8A3E0E',
      fearActionText: '#FFF4EC',
      fearTrackActiveBorder: 'rgba(212,101,26,0.44)',
      fearTrackActiveText: '#F8F0FF',
      fearTrackInactiveBorder: 'rgba(157,78,221,0.18)',
      fearTrackInactiveBackground: 'rgba(255,255,255,0.10)',
      fearTrackInactiveText: '#FFD8C0',
      fearTrackActiveRgb: '212, 101, 26',
      iconBorder: 'rgba(20, 8, 44, 0.12)',
      iconBackground: '#FAF6FF',
      iconBackgroundDisabled: 'rgba(246,240,255,0.92)',
      iconText: '#6A3A90',
      iconTextDisabled: '#BCA8D4',
    },
  },
]

export function getGmPanelTheme(themeId?: GmPanelTheme): GmPanelThemeDefinition {
  return GM_PANEL_THEMES.find((theme) => theme.id === themeId) ?? GM_PANEL_THEMES[0]
}
