import { nanoid } from 'nanoid'
import type { StateCreator } from 'zustand'
import type { AppStore, UIState } from '@/store/storeTypes'

export type UISlice = UIState & {
  togglePlayerPanel: AppStore['togglePlayerPanel']
  openImportModal: AppStore['openImportModal']
  closeImportModal: AppStore['closeImportModal']
  openRoomSettings: AppStore['openRoomSettings']
  closeRoomSettings: AppStore['closeRoomSettings']
  addToast: AppStore['addToast']
  removeToast: AppStore['removeToast']
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set, get) => ({
  // Initial UI state
  isPlayerPanelOpen: true,
  isImportModalOpen: false,
  isRoomSettingsOpen: false,
  isEnteringRoom: false,
  connectionStatus: 'idle',
  toasts: [],
  currentPlayerId: '',
  session: null,

  // UI actions — pure set() calls, no network
  togglePlayerPanel: () => set((state) => ({ isPlayerPanelOpen: !state.isPlayerPanelOpen })),
  openImportModal: () => set({ isImportModalOpen: true }),
  closeImportModal: () => set({ isImportModalOpen: false }),
  openRoomSettings: () => set({ isRoomSettingsOpen: true }),
  closeRoomSettings: () => set({ isRoomSettingsOpen: false }),

  addToast: (message, type = 'info') => {
    const id = nanoid()
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    window.setTimeout(() => get().removeToast(id), 3500)
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  },
})
