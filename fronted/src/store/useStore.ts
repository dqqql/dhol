import { create } from 'zustand'
import { nanoid } from 'nanoid'
import {
  assertDhPack,
  assertDhRoomBackup,
  type ClientMessage,
  type DhCard,
  type GmPanelResourceKey,
  type MapCard,
  type ResourceTrackerResourceKey,
  type ResourceTrackerSheet,
  type RoomSession,
  type RoomState,
  type RoomType,
} from '@dhgc/shared'
import type { Annotation, Connection, DrawOption, Rect, Toast } from '@/types'
import { createRoomRequest, joinRoomRequest, RoomSocketConnection, type ConnectionState } from '@/lib/realtime'
import { createLocationTerritory, normalizeCardDimensions, normalizeTerritoryRect, snapToGrid } from '@/utils/grid'

type ConnectionStatus = ConnectionState

interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

interface HandDragSnapshot {
  cardId: string
  card: DhCard
  originRect: ScreenRect
}

interface PlacementAnimation {
  id: string
  card: DhCard
  fromRect: ScreenRect
  toRect: ScreenRect
  playerColor?: string
}

interface RecycleAnimation {
  id: string
  card: DhCard
  fromRect: ScreenRect
  toRect: ScreenRect
  playerColor?: string
}

type LocalMapCardOverride = Partial<Pick<MapCard, 'x' | 'y' | 'width' | 'height' | 'grid_cols' | 'grid_rows' | 'grid_scale' | 'territory'>>
type LocalAnnotationOverride = Partial<Pick<Annotation, 'text' | 'x' | 'y' | 'font_size'>>

interface UIState {
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

interface AppStore extends UIState {
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
  updateGmSheet: (sheetId: string, sheet: ResourceTrackerSheet) => void
  updateGmResource: (sheetId: string, resourceKey: GmPanelResourceKey, nextValue: number | boolean[]) => void
  updateGmFear: (value: number) => void
  createGmCountdown: (name: string, max: number) => void
  updateGmCountdown: (countdownId: string, value: number) => void
  deleteGmCountdown: (countdownId: string) => void
  moveGmSheet: (sheetId: string, direction: 'left' | 'right') => void
  updateGmCardsPerPage: (cardsPerPage: number) => void

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

let activeConnection: RoomSocketConnection | null = null
const localMapCardOverrides = new Map<string, LocalMapCardOverride>()
const localAnnotationOverrides = new Map<string, LocalAnnotationOverride>()

function rectEquals(left?: Rect, right?: Rect) {
  if (!left && !right) return true
  if (!left || !right) return false
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height
}

function doesMapCardMatchOverride(card: MapCard, override: LocalMapCardOverride) {
  if (override.x !== undefined && card.x !== override.x) return false
  if (override.y !== undefined && card.y !== override.y) return false
  if (override.width !== undefined && card.width !== override.width) return false
  if (override.height !== undefined && card.height !== override.height) return false
  if (override.grid_cols !== undefined && card.grid_cols !== override.grid_cols) return false
  if (override.grid_rows !== undefined && card.grid_rows !== override.grid_rows) return false
  if (override.grid_scale !== undefined && card.grid_scale !== override.grid_scale) return false
  if (override.territory !== undefined && !rectEquals(card.territory, override.territory)) return false
  return true
}

function doesAnnotationMatchOverride(annotation: Annotation, override: LocalAnnotationOverride) {
  if (override.text !== undefined && annotation.text !== override.text) return false
  if (override.x !== undefined && annotation.x !== override.x) return false
  if (override.y !== undefined && annotation.y !== override.y) return false
  if (override.font_size !== undefined && annotation.font_size !== override.font_size) return false
  return true
}

function setLocalMapCardOverride(cardId: string, override: LocalMapCardOverride) {
  localMapCardOverrides.set(cardId, {
    ...(localMapCardOverrides.get(cardId) ?? {}),
    ...override,
  })
}

function setLocalAnnotationOverride(annotationId: string, override: LocalAnnotationOverride) {
  localAnnotationOverrides.set(annotationId, {
    ...(localAnnotationOverrides.get(annotationId) ?? {}),
    ...override,
  })
}

function clearTransientOverrides() {
  localMapCardOverrides.clear()
  localAnnotationOverrides.clear()
}

function preserveTransientRoomState(previous: RoomState | null, incoming: RoomState): RoomState {
  if (incoming.room_type === 'resource-tracker' || incoming.room_type === 'gm-panel') {
    clearTransientOverrides()
    return incoming
  }

  if (!previous) return incoming

  const expandedById = new Map(previous.map_cards.map((card) => [card.id, card.is_expanded]))
  const incomingCardIds = new Set(incoming.map_cards.map((card) => card.id))
  const incomingAnnotationIds = new Set(incoming.annotations.map((annotation) => annotation.id))

  for (const cardId of localMapCardOverrides.keys()) {
    if (!incomingCardIds.has(cardId)) {
      localMapCardOverrides.delete(cardId)
    }
  }

  for (const annotationId of localAnnotationOverrides.keys()) {
    if (!incomingAnnotationIds.has(annotationId)) {
      localAnnotationOverrides.delete(annotationId)
    }
  }

  return {
    ...incoming,
    map_cards: incoming.map_cards.map((card) => {
      const override = localMapCardOverrides.get(card.id)
      const overrideMatches = override ? doesMapCardMatchOverride(card, override) : false
      if (override && overrideMatches) {
        localMapCardOverrides.delete(card.id)
      }

      return {
        ...card,
        ...(override && !overrideMatches ? override : {}),
        is_expanded: expandedById.get(card.id) ?? card.is_expanded,
      }
    }),
    annotations: incoming.annotations.map((annotation) => {
      const override = localAnnotationOverrides.get(annotation.id)
      const overrideMatches = override ? doesAnnotationMatchOverride(annotation, override) : false
      if (override && overrideMatches) {
        localAnnotationOverrides.delete(annotation.id)
      }

      return {
        ...annotation,
        ...(override && !overrideMatches ? override : {}),
      }
    }),
  }
}

export const useStore = create<AppStore>((set, get) => {
  const applyRoomState = (room: RoomState) => {
    set((state) => ({ room: preserveTransientRoomState(state.room, room) }))
  }

  const disconnectConnection = () => {
    if (activeConnection) {
      activeConnection.dispose()
      activeConnection = null
    }
  }

  const sendMessage = (message: ClientMessage) => {
    const conn = activeConnection
    if (!conn || !conn.isConnected) {
      const status = get().connectionStatus
      if (status === 'error' || status === 'idle') {
        get().addToast('实时连接已断开，请手动重新连接。', 'error')
      }
      return false
    }

    conn.send({
      ...message,
      requestId: message.requestId ?? nanoid(),
    })
    return true
  }

  const connectSession = async (session: RoomSession) => {
    disconnectConnection()

    set({
      session,
      currentPlayerId: session.player_id,
      connectionStatus: 'connecting',
    })

    return new Promise<void>((resolve, reject) => {
      let settled = false
      let receivedSnapshot = false
      let latestConnectionError: Error | null = null
      let hasShownRuntimeDisconnectToast = false

      const finishResolve = () => {
        if (settled) return
        settled = true
        resolve()
      }

      const finishReject = (error: Error) => {
        if (settled) return
        settled = true
        reject(error)
      }

      const connection = new RoomSocketConnection(session.websocket_url, {
        onClose: () => {
          if (activeConnection !== connection) return
          // If snapshot was received, the disconnect is handled by reconnect logic
          // Connection class updates status via onStatusChange
          if (!receivedSnapshot) {
            finishReject(latestConnectionError ?? new Error('连接房间失败，请重试。'))
          }
        },
        onError: (error) => {
          if (activeConnection !== connection) return
          latestConnectionError = error
          if (!receivedSnapshot) {
            finishReject(error)
          }
        },
        onStatusChange: (status) => {
          if (activeConnection !== connection) return
          if (status === 'connected') {
            hasShownRuntimeDisconnectToast = false
          }
          if (status === 'error' && receivedSnapshot && !hasShownRuntimeDisconnectToast) {
            hasShownRuntimeDisconnectToast = true
            get().addToast(latestConnectionError?.message ?? '与房间的连接恢复失败，请检查网络后手动重连。', 'error')
          }
          set({ connectionStatus: status })
        },
        onMessage: (message) => {
          if (activeConnection !== connection) return

          switch (message.type) {
            case 'room.snapshot':
              receivedSnapshot = true
              applyRoomState(message.payload.state)
              set({
                currentPlayerId: message.payload.you.player_id,
                connectionStatus: 'connected',
              })
              finishResolve()
              return

            case 'room.updated':
              applyRoomState(message.payload.state)
              set({ connectionStatus: 'connected' })
              return

            case 'draw.options':
              set({
                drawOptions: message.payload.cards,
                isDrawModalOpen: true,
              })
              return

            case 'error':
              get().addToast(message.payload.message, 'error')
              return

            case 'ack':
            case 'pong':
              return
          }
        },
      })

      activeConnection = connection
      connection.connect()
    })
  }

  return {
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
    room: null,

    createRoom: async ({ nickname, roomName, roomType, selectedPackIds }) => {
      const cleanedNickname = nickname.trim()
      if (!cleanedNickname) {
        get().addToast('请输入昵称', 'error')
        return false
      }

      set({
        isEnteringRoom: true,
        connectionStatus: 'connecting',
      })

      try {
        const response = await createRoomRequest({
          nickname: cleanedNickname,
          room_name: roomName.trim(),
          room_type: roomType,
          selected_built_in_pack_ids: selectedPackIds,
        })
        await connectSession(response.session)
        get().addToast(`房间已创建，邀请码 ${response.session.invite_code}`, 'success')
        return true
      } catch (error) {
        disconnectConnection()
        set({
          room: null,
          session: null,
          connectionStatus: 'error',
        })
        get().addToast(error instanceof Error ? error.message : '创建房间失败', 'error')
        return false
      } finally {
        set({ isEnteringRoom: false })
      }
    },

    joinRoom: async ({ inviteCode, nickname }) => {
      const cleanedNickname = nickname.trim()
      const cleanedInviteCode = inviteCode.trim().toUpperCase()
      if (!cleanedNickname) {
        get().addToast('请输入昵称', 'error')
        return false
      }
      if (!cleanedInviteCode) {
        get().addToast('请输入邀请码', 'error')
        return false
      }

      set({
        isEnteringRoom: true,
        connectionStatus: 'connecting',
      })

      try {
        const response = await joinRoomRequest({
          invite_code: cleanedInviteCode,
          nickname: cleanedNickname,
        })
        await connectSession(response.session)
        get().addToast(`已加入房间 ${response.state.room_name}`, 'success')
        return true
      } catch (error) {
        disconnectConnection()
        set({
          room: null,
          session: null,
          connectionStatus: 'error',
        })
        get().addToast(error instanceof Error ? error.message : '加入房间失败', 'error')
        return false
      } finally {
        set({ isEnteringRoom: false })
      }
    },

    manualReconnect: () => {
      const conn = activeConnection
      if (!conn) {
        get().addToast('当前没有可重连的房间会话。', 'error')
        return
      }
      set({ connectionStatus: 'connecting' })
      conn.manualReconnect()
    },

    leaveRoom: () => {
      if (activeConnection) {
        activeConnection.dispose()
        activeConnection = null
      }
      clearTransientOverrides()
      set({
        room: null,
        session: null,
        connectionStatus: 'idle',
        isDrawModalOpen: false,
        isEndCoCreationConfirmOpen: false,
        isEditCardModalOpen: false,
        isCardLibraryOpen: false,
        editingCardId: null,
        connectionDraftFromCardId: null,
        connectionEditor: null,
        draggingHandCard: null,
        placementAnimation: null,
        recycleAnimation: null,
        drawOptions: [],
      })
    },

    startCoCreation: () => {
      sendMessage({ type: 'room.startCoCreation' })
    },

    endCoCreation: () => {
      set({ isEndCoCreationConfirmOpen: false })
      sendMessage({ type: 'room.endCoCreation' })
    },

    updateSelectedPacks: (packIds) => {
      if (!packIds.length) {
        get().addToast('请至少选择一套卡包', 'warning')
        return
      }

      const sent = sendMessage({
        type: 'room.updateSelectedPacks',
        payload: { selectedPackIds: packIds },
      })

      if (sent) {
        get().addToast('房间卡包设置已更新', 'success')
      }
    },

    updateImportsEnabled: (enabled) => {
      const sent = sendMessage({
        type: 'room.updateSettings',
        payload: { importsEnabled: enabled },
      })

      if (sent) {
        get().addToast(enabled ? '已启用导入功能' : '已关闭导入功能', 'success')
      }
    },

    updateResourceChangeRequiresApproval: (enabled) => {
      const sent = sendMessage({
        type: 'room.updateSettings',
        payload: { resourceChangeRequiresApproval: enabled },
      })

      if (sent) {
        get().addToast(enabled ? '已开启资源审批' : '已关闭资源审批', 'success')
      }
    },

    importTrackerCharacter: (fileName, sheet) => {
      const sent = sendMessage({
        type: 'tracker.importCharacter',
        payload: { fileName, sheet },
      })

      if (sent) {
        get().addToast(`已上传角色卡：${sheet.character_name || fileName}`, 'success')
      }
    },

    updateTrackerSheet: (columnId, sheet) => {
      const sent = sendMessage({
        type: 'tracker.updateSheet',
        payload: { columnId, sheet },
      })

      if (sent) {
        get().addToast(`已保存 ${sheet.character_name} 的信息`, 'success')
      }
    },

    updateTrackerResource: (columnId, resourceKey, nextValue) => {
      sendMessage({
        type: 'tracker.updateResource',
        payload: { columnId, resourceKey, nextValue },
      })
    },

    updateTrackerFear: (value) => {
      sendMessage({
        type: 'tracker.updateFear',
        payload: { value },
      })
    },

    createTrackerCountdown: (name, max) => {
      sendMessage({
        type: 'tracker.createCountdown',
        payload: { name, max },
      })
    },

    updateTrackerCountdown: (countdownId, value) => {
      sendMessage({
        type: 'tracker.updateCountdown',
        payload: { countdownId, value },
      })
    },

    deleteTrackerCountdown: (countdownId) => {
      sendMessage({
        type: 'tracker.deleteCountdown',
        payload: { countdownId },
      })
    },

    moveTrackerColumn: (columnId, direction) => {
      sendMessage({
        type: 'tracker.moveColumn',
        payload: { columnId, direction },
      })
    },

    approveTrackerResourceRequest: (requestId) => {
      sendMessage({
        type: 'tracker.approveResourceChange',
        payload: { requestIdToResolve: requestId },
      })
    },

    rejectTrackerResourceRequest: (requestId) => {
      sendMessage({
        type: 'tracker.rejectResourceChange',
        payload: { requestIdToResolve: requestId },
      })
    },

    importGmCharacter: (fileName, html) => {
      sendMessage({
        type: 'gm.importHtmlCharacter',
        payload: { fileName, html },
      })
    },

    replaceGmCharacter: (sheetId, fileName, html) => {
      sendMessage({
        type: 'gm.replaceHtmlCharacter',
        payload: { sheetId, fileName, html },
      })
    },

    updateGmSheet: (sheetId, sheet) => {
      const sent = sendMessage({
        type: 'gm.updateSheet',
        payload: { sheetId, sheet },
      })

      if (sent) {
        get().addToast(`已保存 ${sheet.character_name} 的信息`, 'success')
      }
    },

    updateGmResource: (sheetId, resourceKey, nextValue) => {
      sendMessage({
        type: 'gm.updateResource',
        payload: { sheetId, resourceKey, nextValue },
      })
    },

    updateGmFear: (value) => {
      sendMessage({
        type: 'gm.updateFear',
        payload: { value },
      })
    },

    createGmCountdown: (name, max) => {
      sendMessage({
        type: 'gm.createCountdown',
        payload: { name, max },
      })
    },

    updateGmCountdown: (countdownId, value) => {
      sendMessage({
        type: 'gm.updateCountdown',
        payload: { countdownId, value },
      })
    },

    deleteGmCountdown: (countdownId) => {
      sendMessage({
        type: 'gm.deleteCountdown',
        payload: { countdownId },
      })
    },

    moveGmSheet: (sheetId, direction) => {
      sendMessage({
        type: 'gm.moveSheet',
        payload: { sheetId, direction },
      })
    },

    updateGmCardsPerPage: (cardsPerPage) => {
      sendMessage({
        type: 'gm.updateCardsPerPage',
        payload: { cardsPerPage },
      })
    },

    endTurn: () => {
      sendMessage({ type: 'turn.end' })
    },

    forceSkipTurn: (playerId) => {
      sendMessage({ type: 'turn.forceSkip', payload: { playerId } })
    },

    drawCards: () => {
      sendMessage({ type: 'card.draw' })
    },

    confirmDraw: (cardId) => {
      set({ isDrawModalOpen: false })
      sendMessage({ type: 'card.draw.confirm', payload: { cardId } })
    },

    createCustomCard: (cardData) => {
      const { type, custom_type_name, title, content, style } = cardData
      const sent = sendMessage({
        type: 'card.create',
        payload: {
          card: { type, custom_type_name, title, content, style },
        },
      })

      if (sent) {
        set({ isCreateCardModalOpen: false })
        get().addToast(`已创建自定义卡牌：${title}`, 'success')
      }
    },

    playCard: (cardId, x = 200, y = 200) => {
      sendMessage({
        type: 'card.play',
        payload: { cardId, x: snapToGrid(x), y: snapToGrid(y) },
      })
    },

    beginHandCardDrag: (card, originRect) => {
      set({
        draggingHandCard: {
          cardId: card.id,
          card,
          originRect,
        },
      })
    },

    clearHandCardDrag: (cardId) => {
      set((state) => {
        if (cardId && state.draggingHandCard?.cardId !== cardId) {
          return state
        }

        return { draggingHandCard: null }
      })
    },

    triggerPlacementAnimation: (cardId, toRect, playerColor) => {
      const draggingHandCard = get().draggingHandCard
      if (!draggingHandCard || draggingHandCard.cardId !== cardId) return

      const animationId = nanoid()
      set({
        draggingHandCard: null,
        placementAnimation: {
          id: animationId,
          card: draggingHandCard.card,
          fromRect: draggingHandCard.originRect,
          toRect,
          playerColor,
        },
      })

      window.setTimeout(() => {
        const currentAnimation = get().placementAnimation
        if (currentAnimation?.id === animationId) {
          set({ placementAnimation: null })
        }
      }, 420)
    },

    clearPlacementAnimation: () => set({ placementAnimation: null }),

    triggerRecycleAnimation: (card, fromRect, toRect, playerColor) => {
      const animationId = nanoid()
      set({
        recycleAnimation: {
          id: animationId,
          card,
          fromRect,
          toRect,
          playerColor,
        },
      })

      window.setTimeout(() => {
        const currentAnimation = get().recycleAnimation
        if (currentAnimation?.id === animationId) {
          set({ recycleAnimation: null })
        }
      }, 420)
    },

    clearRecycleAnimation: () => set({ recycleAnimation: null }),

    moveCard: (cardId, x, y) => {
      const nextX = snapToGrid(x)
      const nextY = snapToGrid(y)
      setLocalMapCardOverride(cardId, { x: nextX, y: nextY })

      set((state) => ({
        room: state.room ? {
          ...state.room,
          map_cards: state.room.map_cards.map((card) => {
            if (card.id !== cardId) return card

            return {
              ...card,
              x: nextX,
              y: nextY,
            }
          }),
        } : null,
      }))
    },

    commitMoveCard: (cardId, x, y) => {
      const sent = sendMessage({
        type: 'card.move.commit',
        payload: { cardId, x: snapToGrid(x), y: snapToGrid(y) },
      })

      if (!sent) {
        localMapCardOverrides.delete(cardId)
      }
    },

    resizeCard: (cardId, width, height) => {
      set((state) => ({
        room: state.room ? {
          ...state.room,
          map_cards: state.room.map_cards.map((card) => {
            if (card.id !== cardId) return card
            const nextSize = normalizeCardDimensions(card.type, width, height)
            setLocalMapCardOverride(cardId, nextSize)
            return {
              ...card,
              width: nextSize.width,
              height: nextSize.height,
              grid_cols: nextSize.grid_cols,
              grid_rows: nextSize.grid_rows,
              grid_scale: nextSize.grid_scale,
            }
          }),
        } : null,
      }))
    },

    commitResizeCard: (cardId, width, height) => {
      const normalized = get().room?.map_cards.find((card) => card.id === cardId)
      const sent = sendMessage({
        type: 'card.resize.commit',
        payload: {
          cardId,
          width: normalized?.width ?? width,
          height: normalized?.height ?? height,
        },
      })

      if (!sent) {
        localMapCardOverrides.delete(cardId)
      }
    },

    markCardTerritory: (cardId) => {
      const card = get().room?.map_cards.find((item) => item.id === cardId)
      if (!card || card.type !== 'Location') return

      const territory = normalizeTerritoryRect(
        createLocationTerritory(card.x, card.y, card.width, card.height),
        card.width,
        card.height,
      )

      const sent = sendMessage({
        type: 'card.edit',
        payload: {
          cardId,
          updates: { territory },
        },
      })

      if (!sent) return

      set((state) => ({
        room: state.room ? {
          ...state.room,
          map_cards: state.room.map_cards.map((item) => (
            item.id === cardId && item.type === 'Location'
              ? { ...item, territory }
              : item
          )),
        } : null,
        contextMenu: null,
      }))
    },

    clearCardTerritory: (cardId) => {
      const card = get().room?.map_cards.find((item) => item.id === cardId)
      if (!card || card.type !== 'Location' || !card.territory) return

      const sent = sendMessage({
        type: 'card.edit',
        payload: {
          cardId,
          updates: { territory: null },
        },
      })

      if (!sent) return

      set((state) => ({
        room: state.room ? {
          ...state.room,
          map_cards: state.room.map_cards.map((item) => {
            if (item.id !== cardId || item.type !== 'Location') return item
            const nextItem = { ...item }
            delete nextItem.territory
            return nextItem
          }),
        } : null,
        contextMenu: null,
      }))
    },

    updateCardTerritory: (cardId, territory) => {
      set((state) => ({
        room: state.room ? {
          ...state.room,
          map_cards: state.room.map_cards.map((card) => {
            if (card.id !== cardId || card.type !== 'Location') return card
            const nextTerritory = normalizeTerritoryRect(territory, card.width, card.height)
            setLocalMapCardOverride(cardId, { territory: nextTerritory })
            return {
              ...card,
              territory: nextTerritory,
            }
          }),
        } : null,
      }))
    },

    commitCardTerritory: (cardId, territory) => {
      const card = get().room?.map_cards.find((item) => item.id === cardId)
      if (!card || card.type !== 'Location') return

      const sent = sendMessage({
        type: 'card.edit',
        payload: {
          cardId,
          updates: {
            territory: normalizeTerritoryRect(territory, card.width, card.height),
          },
        },
      })

      if (!sent) {
        localMapCardOverrides.delete(cardId)
      }
    },

    toggleExpandCard: (cardId) => {
      set((state) => ({
        room: state.room ? {
          ...state.room,
          map_cards: state.room.map_cards.map((card) => (
            card.id === cardId ? { ...card, is_expanded: !card.is_expanded } : card
          )),
        } : null,
        expandedCardId: state.expandedCardId === cardId ? null : cardId,
      }))
    },

    editCard: (cardId, updates) => {
      const sent = sendMessage({
        type: 'card.edit',
        payload: { cardId, updates },
      })
      if (sent) {
        set({ isEditCardModalOpen: false, editingCardId: null, contextMenu: null })
      }
    },

    deleteCard: (cardId) => {
      const sent = sendMessage({
        type: 'card.delete',
        payload: { cardId },
      })
      if (sent) {
        set({ contextMenu: null })
      }
    },

    recycleCard: (cardId) => {
      const sent = sendMessage({
        type: 'card.recycle',
        payload: { cardId },
      })
      if (sent) {
        set({ contextMenu: null })
      }
    },

    lockCard: (cardId) => {
      const { room, currentPlayerId } = get()
      const player = room?.players.find((item) => item.id === currentPlayerId)

      set((state) => ({
        room: state.room ? {
          ...state.room,
          map_cards: state.room.map_cards.map((card) => card.id === cardId ? {
            ...card,
            locked_by: player?.nickname,
            locked_by_player_id: currentPlayerId,
          } : card),
        } : null,
      }))

      sendMessage({
        type: 'card.lock',
        payload: { cardId },
      })
    },

    unlockCard: (cardId) => {
      set((state) => ({
        room: state.room ? {
          ...state.room,
          map_cards: state.room.map_cards.map((card) => card.id === cardId ? {
            ...card,
            locked_by: undefined,
            locked_by_player_id: undefined,
            locked_until: undefined,
          } : card),
        } : null,
      }))

      sendMessage({
        type: 'card.unlock',
        payload: { cardId },
      })
    },

    addConnection: (conn) => {
      const sent = sendMessage({
        type: 'connection.add',
        payload: conn,
      })
      if (sent) {
        set({ connectionEditor: null, connectionDraftFromCardId: null, contextMenu: null })
      }
    },

    updateConnection: (connectionId, updates) => {
      const sent = sendMessage({
        type: 'connection.update',
        payload: { connectionId, updates },
      })
      if (sent) {
        set({ connectionEditor: null, contextMenu: null })
      }
    },

    removeConnection: (connId) => {
      const sent = sendMessage({
        type: 'connection.remove',
        payload: { connectionId: connId },
      })
      if (sent) {
        set((state) => ({
          connectionEditor: state.connectionEditor?.connectionId === connId ? null : state.connectionEditor,
          contextMenu: null,
        }))
      }
    },

    addAnnotation: (ann) => {
      const sent = sendMessage({
        type: 'annotation.add',
        payload: ann,
      })

      if (!sent) return false

      set((state) => {
        if (!state.room) return state
        if (state.room.annotations.some((annotation) => annotation.id === ann.id)) {
          return state
        }

        return {
          room: {
            ...state.room,
            annotations: [...state.room.annotations, ann],
          },
        }
      })

      return true
    },

    updateAnnotationLocal: (annotationId, updates) => {
      setLocalAnnotationOverride(annotationId, updates)
      set((state) => ({
        room: state.room ? {
          ...state.room,
          annotations: state.room.annotations.map((annotation) => (
            annotation.id === annotationId ? { ...annotation, ...updates } : annotation
          )),
        } : null,
      }))
    },

    commitAnnotationUpdate: (annotationId, updates) => {
      const sent = sendMessage({
        type: 'annotation.update',
        payload: { annotationId, updates },
      })

      if (!sent) {
        localAnnotationOverrides.delete(annotationId)
      }
    },

    removeAnnotation: (annId) => {
      localAnnotationOverrides.delete(annId)
      const sent = sendMessage({
        type: 'annotation.remove',
        payload: { annotationId: annId },
      })

      if (sent) {
        set((state) => ({
          room: state.room ? {
            ...state.room,
            annotations: state.room.annotations.filter((annotation) => annotation.id !== annId),
          } : null,
        }))
      }
    },

    importPack: (value) => {
      try {
        const pack = assertDhPack(value)
        const sent = sendMessage({
          type: 'room.importPack',
          payload: { pack },
        })
        if (sent) {
          set({ isImportModalOpen: false })
          get().addToast(`已导入卡包：${pack.pack_name}`, 'success')
        }
      } catch (error) {
        get().addToast(error instanceof Error ? error.message : '卡包格式不正确', 'error')
      }
    },

    importRoomBackup: (value) => {
      try {
        const backup = assertDhRoomBackup(value)
        const sent = sendMessage({
          type: 'room.importRoomBackup',
          payload: { backup },
        })

        if (sent) {
          set({ isImportModalOpen: false })
          get().addToast(`已导入房间备份：${backup.room.name}`, 'success')
        }
      } catch (error) {
        get().addToast(error instanceof Error ? error.message : '房间备份格式不正确', 'error')
      }
    },

    importLibraryPack: (packId, packName) => {
      const sent = sendMessage({
        type: 'room.importLibraryPack',
        payload: { packId },
      })

      if (sent) {
        get().addToast(`已追加整包：${packName}`, 'success')
      }
    },

    importLibraryCards: (packId, cardIds) => {
      if (!cardIds.length) {
        get().addToast('请至少选择一张卡牌', 'warning')
        return
      }

      const sent = sendMessage({
        type: 'room.importCards',
        payload: { packId, cardIds },
      })

      if (sent) {
        get().addToast(`已导入 ${cardIds.length} 张卡牌`, 'success')
      }
    },

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
  }
})
