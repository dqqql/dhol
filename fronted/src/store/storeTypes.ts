import type {
  GmPanelTheme,
  GmPanelResourceKey,
  MobilePanelExperience,
  MobilePanelResourceKey,
  ResourceTrackerSheet,
  RoomSession,
  RoomState,
  RoomType,
} from '@dhgc/shared'
import type { Toast } from '@/types'
import type { ConnectionState } from '@/lib/realtime'

export type ConnectionStatus = ConnectionState

export interface UIState {
  isPlayerPanelOpen: boolean
  isImportModalOpen: boolean
  isRoomSettingsOpen: boolean
  isEnteringRoom: boolean
  toasts: Toast[]
  connectionStatus: ConnectionStatus
  currentPlayerId: string
  session: RoomSession | null
}

export interface AppStore extends UIState {
  room: RoomState | null

  createRoom: (input: { nickname: string; roomName: string; roomType: RoomType }) => Promise<boolean>
  joinRoom: (input: { inviteCode: string; nickname: string }) => Promise<boolean>

  manualReconnect: () => void
  leaveRoom: () => void

  updateImportsEnabled: (enabled: boolean) => void
  updateResourceChangeRequiresApproval: (enabled: boolean) => void
  updateGmPanelTheme: (theme: GmPanelTheme) => void

  importGmCharacter: (fileName: string, html: string) => void
  replaceGmCharacter: (sheetId: string, fileName: string, html: string) => void
  deleteGmCharacter: (sheetId: string) => void
  updateGmSheet: (sheetId: string, sheet: ResourceTrackerSheet) => void
  updateGmResource: (sheetId: string, resourceKey: GmPanelResourceKey, nextValue: number | boolean[]) => void
  updateGmFear: (value: number) => void
  createGmCountdown: (name: string, max: number) => void
  updateGmCountdown: (countdownId: string, value: number) => void
  deleteGmCountdown: (countdownId: string) => void
  moveGmSheet: (sheetId: string, direction: 'left' | 'right') => void
  updateGmCardsPerPage: (cardsPerPage: number) => void

  importMobileCharacter: (code: string, displayName: string, experiences: MobilePanelExperience[]) => void
  replaceMobileCharacter: (characterId: string, code: string) => void
  deleteMobileCharacter: (characterId: string) => void
  updateMobileCharacterCustom: (characterId: string, displayName: string, experiences: MobilePanelExperience[]) => void
  updateMobileResource: (characterId: string, resourceKey: MobilePanelResourceKey, nextValue: number | boolean[]) => void
  updateMobileFear: (value: number) => void
  createMobileCountdown: (name: string, max: number) => void
  updateMobileCountdown: (countdownId: string, value: number) => void
  deleteMobileCountdown: (countdownId: string) => void

  importRoomBackup: (value: unknown) => void

  togglePlayerPanel: () => void
  openImportModal: () => void
  closeImportModal: () => void
  openRoomSettings: () => void
  closeRoomSettings: () => void

  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void
}
