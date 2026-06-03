import { nanoid } from 'nanoid'
import type { StateCreator } from 'zustand'
import type { AppStore, UIState } from '@/store/storeTypes'

export type UISlice = UIState & {
  setContextMenu: AppStore['setContextMenu']
  setExpandedCard: AppStore['setExpandedCard']
  togglePlayerPanel: AppStore['togglePlayerPanel']
  toggleHandPanel: AppStore['toggleHandPanel']
  toggleExportMenu: AppStore['toggleExportMenu']
  openImportModal: AppStore['openImportModal']
  closeImportModal: AppStore['closeImportModal']
  openCreateCardModal: AppStore['openCreateCardModal']
  closeCreateCardModal: AppStore['closeCreateCardModal']
  openEditCardModal: AppStore['openEditCardModal']
  closeEditCardModal: AppStore['closeEditCardModal']
  openRoomSettings: AppStore['openRoomSettings']
  closeRoomSettings: AppStore['closeRoomSettings']
  openCardLibrary: AppStore['openCardLibrary']
  closeCardLibrary: AppStore['closeCardLibrary']
  openDrawModal: AppStore['openDrawModal']
  closeDrawModal: AppStore['closeDrawModal']
  openEndConfirm: AppStore['openEndConfirm']
  closeEndConfirm: AppStore['closeEndConfirm']
  startConnection: AppStore['startConnection']
  completeConnection: AppStore['completeConnection']
  cancelConnection: AppStore['cancelConnection']
  openConnectionEditor: AppStore['openConnectionEditor']
  closeConnectionEditor: AppStore['closeConnectionEditor']
  addToast: AppStore['addToast']
  removeToast: AppStore['removeToast']
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set, get) => ({
  // Initial UI state
  isPlayerPanelOpen: true,
  isHandPanelOpen: true,
  isExportMenuOpen: false,
  isImportModalOpen: false,
  isCreateCardModalOpen: false,
  isEditCardModalOpen: false,
  isRoomSettingsOpen: false,
  isCardLibraryOpen: false,
  isDrawModalOpen: false,
  isEndCoCreationConfirmOpen: false,
  isEnteringRoom: false,
  connectionStatus: 'idle',
  contextMenu: null,
  expandedCardId: null,
  editingCardId: null,
  connectionDraftFromCardId: null,
  connectionEditor: null,
  draggingHandCard: null,
  placementAnimation: null,
  recycleAnimation: null,
  drawOptions: [],
  toasts: [],
  currentPlayerId: '',
  session: null,

  // UI actions — pure set() calls, no network
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setExpandedCard: (id) => set({ expandedCardId: id }),
  togglePlayerPanel: () => set((state) => ({ isPlayerPanelOpen: !state.isPlayerPanelOpen })),
  toggleHandPanel: () => set((state) => ({ isHandPanelOpen: !state.isHandPanelOpen })),
  toggleExportMenu: () => set((state) => ({ isExportMenuOpen: !state.isExportMenuOpen })),
  openImportModal: () => set({ isImportModalOpen: true }),
  closeImportModal: () => set({ isImportModalOpen: false }),
  openCreateCardModal: () => set({ isCreateCardModalOpen: true }),
  closeCreateCardModal: () => set({ isCreateCardModalOpen: false }),
  openEditCardModal: (cardId) => set({ isEditCardModalOpen: true, editingCardId: cardId, contextMenu: null }),
  closeEditCardModal: () => set({ isEditCardModalOpen: false, editingCardId: null }),
  openRoomSettings: () => set({ isRoomSettingsOpen: true }),
  closeRoomSettings: () => set({ isRoomSettingsOpen: false }),
  openCardLibrary: () => set({ isCardLibraryOpen: true }),
  closeCardLibrary: () => set({ isCardLibraryOpen: false }),
  openDrawModal: () => set((state) => ({ isDrawModalOpen: state.drawOptions.length > 0 })),
  closeDrawModal: () => set({ isDrawModalOpen: false }),
  openEndConfirm: () => set({ isEndCoCreationConfirmOpen: true }),
  closeEndConfirm: () => set({ isEndCoCreationConfirmOpen: false }),

  startConnection: (fromCardId) => {
    set({ connectionDraftFromCardId: fromCardId, contextMenu: null })
    get().addToast('请选择目标卡牌以创建连线', 'info')
  },

  completeConnection: (toCardId) => {
    const { connectionDraftFromCardId, room } = get()
    if (!connectionDraftFromCardId) return

    if (connectionDraftFromCardId === toCardId) {
      get().addToast('不能将卡牌连接到自己', 'warning')
      return
    }

    const existing = room?.connections.find((item) => (
      item.from_card_id === connectionDraftFromCardId && item.to_card_id === toCardId
    ))

    set({
      connectionDraftFromCardId: null,
      connectionEditor: {
        connectionId: existing?.id,
        fromCardId: connectionDraftFromCardId,
        toCardId,
      },
    })
  },

  cancelConnection: () => set({ connectionDraftFromCardId: null }),
  openConnectionEditor: (value) => set({ connectionEditor: value, connectionDraftFromCardId: null, contextMenu: null }),
  closeConnectionEditor: () => set({ connectionEditor: null, connectionDraftFromCardId: null }),

  addToast: (message, type = 'info') => {
    const id = nanoid()
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    window.setTimeout(() => get().removeToast(id), 3500)
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  },
})
