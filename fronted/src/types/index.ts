export type {
  ClientMessage,
  CreateRoomRequest,
  DhRoomBackup,
  JoinRoomRequest,
  Player,
  RoomJoinResponse,
  RoomSettings,
  RoomSession,
  RoomState,
  ServerMessage,
} from '@dhgc/shared'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  message: string
  type: ToastType
}
