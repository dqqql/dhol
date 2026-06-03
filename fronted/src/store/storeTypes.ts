import type {
  DhCard,
  GmPanelTheme,
  GmPanelResourceKey,
  MapCard,
  MobilePanelExperience,
  MobilePanelResourceKey,
  ResourceTrackerResourceKey,
  ResourceTrackerSheet,
  RoomSession,
  RoomState,
  RoomType,
} from '@dhgc/shared'
import type { Annotation, Connection, DrawOption, Rect, Toast } from '@/types'
import type { ConnectionState } from '@/lib/realtime'

export type ConnectionStatus = ConnectionState

export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

export interface HandDragSnapshot {
  cardId: string
  card: DhCard
  originRect: ScreenRect
}

export interface PlacementAnimation {
  id: string
  card: DhCard
  fromRect: ScreenRect
  toRect: ScreenRect
  playerColor?: string
}

export interface RecycleAnimation {
  id: string
  card: DhCard
  fromRect: ScreenRect
  toRect: ScreenRect
  playerColor?: string
}

export type LocalMapCardOverride = Partial<Pick<MapCard, 'x' | 'y' | 'width' | 'height' | 'grid_cols' | 'grid_rows' | 'grid_scale' | 'territory'>>
export type LocalAnnotationOverride = Partial<Pick<Annotation, 'text' | 'x' | 'y' | 'font_size'>>

export interface UIState {
  isPlayerPanelOpen: boolean
  isHandPanelOpen: boolean
  isExportMenuOpen: boolean
  isImportModalOpen: boolean
  isCreateCardModalOpen: boolean
  isEditCardModalOpen: boolean
  isRoomSettingsOpen: boolean
  isCardLibraryOpen: boolean
  isDrawModalOpen: boolean
  isEndCoCreationConfirmOpen: boolean
  isEnteringRoom: boolean
  connectionStatus: ConnectionStatus
  contextMenu: { x: number; y: number; cardId: string } | null
  expandedCardId: string | null
  editingCardId: string | null
  connectionDraftFromCardId: string | null
  connectionEditor: { connectionId?: string; fromCardId: string; toCardId: string } | null
  draggingHandCard: HandDragSnapshot | null
  placementAnimation: PlacementAnimation | null
  recycleAnimation: RecycleAnimation | null
  drawOptions: DrawOption[]
  toasts: Toast[]
  currentPlayerId: string
  session: RoomSession | null
}

export interface AppStore extends UIState {
  room: RoomState | null

  createRoom: (input: { nickname: string; roomName: string; roomType: RoomType; selectedPackIds?: string[] }) => Promise<boolean>
  joinRoom: (input: { inviteCode: string; nickname: string }) => Promise<boolean>

  manualReconnect: () => void
  leaveRoom: () => void

  startCoCreation: () => void
  endCoCreation: () => void
  updateSelectedPacks: (packIds: string[]) => void
  updateImportsEnabled: (enabled: boolean) => void
  updateResourceChangeRequiresApproval: (enabled: boolean) => void
  updateGmPanelTheme: (theme: GmPanelTheme) => void

  importTrackerCharacter: (fileName: string, sheet: ResourceTrackerSheet) => void
  updateTrackerSheet: (columnId: string, sheet: ResourceTrackerSheet) => void
  updateTrackerResource: (columnId: string, resourceKey: ResourceTrackerResourceKey, nextValue: number | boolean[]) => void
  updateTrackerFear: (value: number) => void
  createTrackerCountdown: (name: string, max: number) => void
  updateTrackerCountdown: (countdownId: string, value: number) => void
  deleteTrackerCountdown: (countdownId: string) => void
  moveTrackerColumn: (columnId: string, direction: 'left' | 'right') => void
  approveTrackerResourceRequest: (requestId: string) => void
  rejectTrackerResourceRequest: (requestId: string) => void

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

  endTurn: () => void
  forceSkipTurn: (playerId: string) => void

  drawCards: () => void
  confirmDraw: (cardId: string) => void
  createCustomCard: (card: Omit<DhCard, 'id'>) => void
  playCard: (cardId: string, x?: number, y?: number) => void
  beginHandCardDrag: (card: DhCard, originRect: ScreenRect) => void
  clearHandCardDrag: (cardId?: string) => void
  triggerPlacementAnimation: (cardId: string, toRect: ScreenRect, playerColor?: string) => void
  clearPlacementAnimation: () => void
  triggerRecycleAnimation: (card: DhCard, fromRect: ScreenRect, toRect: ScreenRect, playerColor?: string) => void
  clearRecycleAnimation: () => void

  moveCard: (cardId: string, x: number, y: number) => void
  commitMoveCard: (cardId: string, x: number, y: number) => void
  resizeCard: (cardId: string, width: number, height: number) => void
  commitResizeCard: (cardId: string, width: number, height: number) => void
  markCardTerritory: (cardId: string) => void
  clearCardTerritory: (cardId: string) => void
  updateCardTerritory: (cardId: string, territory: Rect) => void
  commitCardTerritory: (cardId: string, territory: Rect) => void
  toggleExpandCard: (cardId: string) => void
  editCard: (cardId: string, updates: Partial<DhCard> & { territory?: Rect | null }) => void
  deleteCard: (cardId: string) => void
  recycleCard: (cardId: string) => void
  lockCard: (cardId: string) => void
  unlockCard: (cardId: string) => void

  addConnection: (conn: Omit<Connection, 'id'>) => void
  updateConnection: (connectionId: string, updates: Partial<Pick<Connection, 'color' | 'label'>>) => void
  removeConnection: (connId: string) => void

  addAnnotation: (ann: Annotation) => boolean
  updateAnnotationLocal: (annotationId: string, updates: Partial<Pick<Annotation, 'text' | 'x' | 'y' | 'font_size'>>) => void
  commitAnnotationUpdate: (annotationId: string, updates: Partial<Pick<Annotation, 'text' | 'x' | 'y' | 'font_size'>>) => void
  removeAnnotation: (annId: string) => void
  importPack: (value: unknown) => void
  importRoomBackup: (value: unknown) => void
  importLibraryPack: (packId: string, packName: string) => void
  importLibraryCards: (packId: string, cardIds: string[]) => void

  setContextMenu: (menu: { x: number; y: number; cardId: string } | null) => void
  setExpandedCard: (id: string | null) => void
  togglePlayerPanel: () => void
  toggleHandPanel: () => void
  toggleExportMenu: () => void
  openImportModal: () => void
  closeImportModal: () => void
  openCreateCardModal: () => void
  closeCreateCardModal: () => void
  openEditCardModal: (cardId: string) => void
  closeEditCardModal: () => void
  openRoomSettings: () => void
  closeRoomSettings: () => void
  openCardLibrary: () => void
  closeCardLibrary: () => void
  openDrawModal: () => void
  closeDrawModal: () => void
  openEndConfirm: () => void
  closeEndConfirm: () => void
  startConnection: (fromCardId: string) => void
  completeConnection: (toCardId: string) => void
  cancelConnection: () => void
  openConnectionEditor: (value: { connectionId?: string; fromCardId: string; toCardId: string }) => void
  closeConnectionEditor: () => void

  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void
}
