import { create } from 'zustand'
import { nanoid } from 'nanoid'
import {
  assertDhRoomBackup,
  normalizeDrawingBoard,
  type ClientMessage,
  type RoomSession,
  type RoomState,
} from '@dhgc/shared'
import { createRoomRequest, joinRoomRequest, RoomSocketConnection } from '@/lib/realtime'
import type { AppStore } from '@/store/storeTypes'
import { createUISlice } from '@/store/uiSlice'
import {
  acknowledgeMutation,
  applyAuthoritativeRoomPatch,
  createOptimisticRoomState,
  enqueueOptimisticMutation,
  receiveRoomSnapshot,
  rejectMutation,
  type PendingMutationInput,
} from '@/store/roomPatches'

// ── Module-level room state singletons ──────────────────────────────────────
let activeConnection: RoomSocketConnection | null = null
let optimisticRoomState = createOptimisticRoomState()

// ── Unified store ────────────────────────────────────────────────────────────
export const useStore = create<AppStore>((set, get) => {
  const applyRoomState = (room: RoomState) => {
    const normalizedRoom = {
      ...room,
      drawing_board: normalizeDrawingBoard(room.drawing_board),
      dice_rolls: Array.isArray(room.dice_rolls) ? room.dice_rolls : [],
    }
    optimisticRoomState = receiveRoomSnapshot(optimisticRoomState, normalizedRoom)
    set({ room: optimisticRoomState.room, pendingDiceRollRequestIds: [] })
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

    return conn.send({
      ...message,
      requestId: message.requestId ?? nanoid(),
    })
  }

  const sendOptimisticMessage = (message: ClientMessage, mutation: PendingMutationInput) => {
    const conn = activeConnection
    if (!conn || !conn.isConnected || !optimisticRoomState.authoritativeRoom) {
      return sendMessage(message)
    }

    const requestId = message.requestId ?? nanoid()
    optimisticRoomState = enqueueOptimisticMutation(optimisticRoomState, {
      ...mutation,
      requestId,
      baseVersion: optimisticRoomState.authoritativeRoom.snapshot_version,
    } as Parameters<typeof enqueueOptimisticMutation>[1])
    set({ room: optimisticRoomState.room })

    const sent = conn.send({ ...message, requestId })
    if (!sent) {
      optimisticRoomState = rejectMutation(optimisticRoomState, requestId)
      set({ room: optimisticRoomState.room })
    }
    return sent
  }

  const connectSession = async (session: RoomSession) => {
    disconnectConnection()

    set({
      session,
      currentPlayerId: session.player_id,
      connectionStatus: 'connecting',
      pendingDiceRollRequestIds: [],
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

            case 'room.patch': {
              const acceptsPatch = message.payload.snapshot_version
                > (optimisticRoomState.authoritativeRoom?.snapshot_version ?? -1)
              optimisticRoomState = applyAuthoritativeRoomPatch(optimisticRoomState, message.payload)
              set((state) => {
                let pendingDiceRollRequestIds = state.pendingDiceRollRequestIds
                if (acceptsPatch && message.payload.kind === 'room.replacement') {
                  pendingDiceRollRequestIds = []
                } else if (acceptsPatch && message.payload.kind === 'dice.history') {
                  pendingDiceRollRequestIds = pendingDiceRollRequestIds.slice(1)
                }
                return { room: optimisticRoomState.room, pendingDiceRollRequestIds }
              })
              set({ connectionStatus: 'connected' })
              return
            }

            case 'error':
              if (message.requestId) {
                const requestId = message.requestId
                optimisticRoomState = rejectMutation(optimisticRoomState, requestId)
                set((state) => ({
                  room: optimisticRoomState.room,
                  pendingDiceRollRequestIds: state.pendingDiceRollRequestIds.filter((pendingId) => pendingId !== requestId),
                }))
              }
              get().addToast(message.payload.message, 'error')
              return

            case 'ack':
              if (message.requestId) {
                optimisticRoomState = acknowledgeMutation(optimisticRoomState, message.requestId, message.payload.snapshot_version)
                set({ room: optimisticRoomState.room })
              }
              return
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
    // ── UI slice ─────────────────────────────────────────────────────────────
    ...createUISlice(set, get, undefined as never),

    // ── Room state ───────────────────────────────────────────────────────────
    room: null,
    pendingDiceRollRequestIds: [],

    // ── Room lifecycle ────────────────────────────────────────────────────────
    createRoom: async ({ nickname, roomName, roomType }) => {
      const cleanedNickname = nickname.trim()
      if (!cleanedNickname) {
        get().addToast('请输入昵称', 'error')
        return false
      }

      set({ isEnteringRoom: true, connectionStatus: 'connecting' })

      try {
        const response = await createRoomRequest({
          nickname: cleanedNickname,
          room_name: roomName.trim(),
          room_type: roomType,
        })
        await connectSession(response.session)
        get().addToast(`房间已创建，邀请码 ${response.session.invite_code}`, 'success')
        return true
      } catch (error) {
        disconnectConnection()
        set({ room: null, session: null, connectionStatus: 'error' })
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

      set({ isEnteringRoom: true, connectionStatus: 'connecting' })

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
        set({ room: null, session: null, connectionStatus: 'error' })
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
      set({ connectionStatus: 'connecting', pendingDiceRollRequestIds: [] })
      conn.manualReconnect()
    },

    leaveRoom: () => {
      if (activeConnection) {
        activeConnection.dispose()
        activeConnection = null
      }
      optimisticRoomState = createOptimisticRoomState()
      set({
        room: null,
        session: null,
        connectionStatus: 'idle',
        pendingDiceRollRequestIds: [],
      })
    },

    // ── Room settings ─────────────────────────────────────────────────────────
    updateImportsEnabled: (enabled) => {
      const sent = sendMessage({ type: 'room.updateSettings', payload: { importsEnabled: enabled } })
      if (sent) { get().addToast(enabled ? '已启用导入功能' : '已关闭导入功能', 'success') }
    },

    updateResourceChangeRequiresApproval: (enabled) => {
      const sent = sendMessage({ type: 'room.updateSettings', payload: { resourceChangeRequiresApproval: enabled } })
      if (sent) { get().addToast(enabled ? '已开启资源审批' : '已关闭资源审批', 'success') }
    },

    updateGmPanelTheme: (theme) => {
      const sent = sendMessage({ type: 'room.updateSettings', payload: { gmPanelTheme: theme } })
      if (sent) { get().addToast('GM 面板主题已更新', 'success') }
    },

    // ── GM Panel actions ──────────────────────────────────────────────────────
    importGmCharacter: (fileName, html) => { sendMessage({ type: 'gm.importHtmlCharacter', payload: { fileName, html } }) },
    replaceGmCharacter: (sheetId, fileName, html) => { sendMessage({ type: 'gm.replaceHtmlCharacter', payload: { sheetId, fileName, html } }) },
    deleteGmCharacter: (sheetId) => { sendMessage({ type: 'gm.deleteSheet', payload: { sheetId } }) },

    updateGmSheet: (sheetId, sheet) => {
      const sent = sendMessage({ type: 'gm.updateSheet', payload: { sheetId, sheet } })
      if (sent) { get().addToast(`已保存 ${sheet.character_name} 的信息`, 'success') }
    },

    updateGmResource: (sheetId, resourceKey, nextValue) => {
      sendOptimisticMessage(
        { type: 'gm.updateResource', payload: { sheetId, resourceKey, nextValue } },
        { kind: 'gm.resource', sheetId, resourceKey, value: nextValue },
      )
    },
    updateGmFear: (value) => {
      sendOptimisticMessage({ type: 'gm.updateFear', payload: { value } }, { kind: 'gm.fear', value })
    },
    createGmCountdown: (name, max) => { sendMessage({ type: 'gm.createCountdown', payload: { name, max } }) },
    updateGmCountdown: (countdownId, value) => {
      sendOptimisticMessage(
        { type: 'gm.updateCountdown', payload: { countdownId, value } },
        { kind: 'gm.countdown', countdownId, value },
      )
    },
    deleteGmCountdown: (countdownId) => { sendMessage({ type: 'gm.deleteCountdown', payload: { countdownId } }) },
    moveGmSheet: (sheetId, direction) => { sendMessage({ type: 'gm.moveSheet', payload: { sheetId, direction } }) },
    updateGmCardsPerPage: (cardsPerPage) => { sendMessage({ type: 'gm.updateCardsPerPage', payload: { cardsPerPage } }) },

    // ── Mobile Panel actions ──────────────────────────────────────────────────
    importMobileCharacter: (code, displayName, experiences) => {
      sendMessage({ type: 'mobile.importCharacterCode', payload: { code, displayName, experiences } })
    },
    replaceMobileCharacter: (characterId, code) => {
      sendMessage({ type: 'mobile.replaceCharacterCode', payload: { characterId, code } })
    },
    deleteMobileCharacter: (characterId) => { sendMessage({ type: 'mobile.deleteCharacter', payload: { characterId } }) },
    updateMobileCharacterCustom: (characterId, displayName, experiences) => {
      sendMessage({ type: 'mobile.updateCharacterCustom', payload: { characterId, displayName, experiences } })
    },
    updateMobileResource: (characterId, resourceKey, nextValue) => {
      sendOptimisticMessage(
        { type: 'mobile.updateResource', payload: { characterId, resourceKey, nextValue } },
        { kind: 'mobile.resource', characterId, resourceKey, value: nextValue },
      )
    },
    updateMobileFear: (value) => {
      sendOptimisticMessage({ type: 'mobile.updateFear', payload: { value } }, { kind: 'mobile.fear', value })
    },
    createMobileCountdown: (name, max) => { sendMessage({ type: 'mobile.createCountdown', payload: { name, max } }) },
    updateMobileCountdown: (countdownId, value) => {
      sendOptimisticMessage(
        { type: 'mobile.updateCountdown', payload: { countdownId, value } },
        { kind: 'mobile.countdown', countdownId, value },
      )
    },
    deleteMobileCountdown: (countdownId) => { sendMessage({ type: 'mobile.deleteCountdown', payload: { countdownId } }) },

    rollDice: (request) => {
      const conn = activeConnection
      if (!conn || !conn.isConnected) {
        sendMessage({ type: 'dice.roll', payload: request })
        return
      }

      const requestId = nanoid()
      set((state) => ({ pendingDiceRollRequestIds: [...state.pendingDiceRollRequestIds, requestId] }))
      if (!conn.send({ type: 'dice.roll', payload: request, requestId })) {
        set((state) => ({
          pendingDiceRollRequestIds: state.pendingDiceRollRequestIds.filter((pendingId) => pendingId !== requestId),
        }))
      }
    },
    clearDiceHistory: () => {
      const sent = sendMessage({ type: 'dice.clearHistory', payload: {} })
      if (sent) { get().addToast('已清除掷骰记录', 'success') }
    },
    submitDrawingBoard: (request) => {
      const sent = sendOptimisticMessage(
        { type: 'drawing.submit', payload: request },
        { kind: 'drawing', drawingBoard: normalizeDrawingBoard({ shapes: request.shapes }) },
      )
      if (sent) { get().addToast('画板已同步给房间成员', 'success') }
    },

    raiseXCard: () => {
      const sent = sendMessage({ type: 'xcard.raise', payload: {} })
      if (sent) { get().addToast('已匿名打出 X 卡', 'success') }
    },
    acknowledgeXCard: () => {
      sendMessage({ type: 'xcard.acknowledge', payload: {} })
    },

    // ── Import actions ────────────────────────────────────────────────────────
    importRoomBackup: (value) => {
      try {
        const backup = assertDhRoomBackup(value)
        const sent = sendMessage({ type: 'room.importRoomBackup', payload: { backup } })
        if (sent) {
          set({ isImportModalOpen: false })
          get().addToast(`已导入房间备份：${backup.room.name}`, 'success')
        }
      } catch (error) {
        get().addToast(error instanceof Error ? error.message : '房间备份格式不正确', 'error')
      }
    },
  }
})
