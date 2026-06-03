export type SheetDocState = {
  htmlUpdatedAt: string
  srcDoc: string
  loading: boolean
  error?: string
}

export type ImportPendingState = {
  fileName: string
  mode: 'import' | 'replace'
  previousSheetCount: number
  previousHtmlUpdatedAt?: string
  targetSheetId?: string
}

export type ResourceChangeMessage = {
  type: 'dhol-gm-resource-change'
  sheetId: string
  resourceKey: import('@dhgc/shared').GmPanelResourceKey
  value: number | boolean[]
  index?: number | null
}

export type ResourceReplayFailedMessage = {
  type: 'dhol-gm-resource-replay-failed'
  sheetId: string
}

export type ResourceMessage = ResourceChangeMessage | ResourceReplayFailedMessage
