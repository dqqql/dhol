export type {
  Annotation,
  CardType,
  ClientMessage,
  Connection,
  ConnectionColor,
  CreateRoomRequest,
  DeckCardType,
  DhCard,
  DhPack,
  DhRoomBackup,
  JoinRoomRequest,
  MapCard,
  Player,
  RoleCardDetails,
  RoomPackLibraryItem,
  Rect,
  RoomJoinResponse,
  RoomMode,
  RoomSettings,
  RoomSession,
  RoomState,
  ServerMessage,
} from '@dhgc/shared'

import type { DhCard } from '@dhgc/shared'

export type DrawOption = DhCard

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  message: string
  type: ToastType
}
