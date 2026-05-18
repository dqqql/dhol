import type {
  Annotation,
  Connection,
  DhCard,
  DhPack,
  DhRoomBackup,
  GmPanelResourceKey,
  ImportedCharacterData,
  Rect,
  ResourceTrackerResourceKey,
  ResourceTrackerSheet,
  RoomState,
  RoomType,
} from './types'

export type ClientMessage =
  | { type: 'room.startCoCreation'; requestId?: string; payload?: Record<string, never> }
  | { type: 'room.endCoCreation'; requestId?: string; payload?: Record<string, never> }
  | { type: 'room.updateSelectedPacks'; requestId?: string; payload: { selectedPackIds: string[] } }
  | { type: 'room.updateSettings'; requestId?: string; payload: { importsEnabled?: boolean; resourceChangeRequiresApproval?: boolean } }
  | { type: 'room.importPack'; requestId?: string; payload: { pack: DhPack } }
  | { type: 'room.importLibraryPack'; requestId?: string; payload: { packId: string } }
  | { type: 'room.importCards'; requestId?: string; payload: { packId: string; cardIds: string[] } }
  | { type: 'room.importRoomBackup'; requestId?: string; payload: { backup: DhRoomBackup } }
  | { type: 'tracker.importCharacter'; requestId?: string; payload: { fileName: string; sheet: ResourceTrackerSheet } }
  | { type: 'tracker.updateSheet'; requestId?: string; payload: { columnId: string; sheet: ResourceTrackerSheet } }
  | { type: 'tracker.updateResource'; requestId?: string; payload: { columnId: string; resourceKey: ResourceTrackerResourceKey; nextValue: number | boolean[] } }
  | { type: 'tracker.updateFear'; requestId?: string; payload: { value: number } }
  | { type: 'tracker.createCountdown'; requestId?: string; payload: { name: string; max: number } }
  | { type: 'tracker.updateCountdown'; requestId?: string; payload: { countdownId: string; value: number } }
  | { type: 'tracker.deleteCountdown'; requestId?: string; payload: { countdownId: string } }
  | { type: 'tracker.moveColumn'; requestId?: string; payload: { columnId: string; direction: 'left' | 'right' } }
  | { type: 'tracker.approveResourceChange'; requestId?: string; payload: { requestIdToResolve: string } }
  | { type: 'tracker.rejectResourceChange'; requestId?: string; payload: { requestIdToResolve: string } }
  | { type: 'gm.importHtmlCharacter'; requestId?: string; payload: { fileName: string; html: string } }
  | { type: 'gm.replaceHtmlCharacter'; requestId?: string; payload: { sheetId: string; fileName: string; html: string } }
  | { type: 'gm.updateSheet'; requestId?: string; payload: { sheetId: string; sheet: ResourceTrackerSheet } }
  | { type: 'gm.updateResource'; requestId?: string; payload: { sheetId: string; resourceKey: GmPanelResourceKey; nextValue: number | boolean[] } }
  | { type: 'gm.updateFear'; requestId?: string; payload: { value: number } }
  | { type: 'gm.createCountdown'; requestId?: string; payload: { name: string; max: number } }
  | { type: 'gm.updateCountdown'; requestId?: string; payload: { countdownId: string; value: number } }
  | { type: 'gm.deleteCountdown'; requestId?: string; payload: { countdownId: string } }
  | { type: 'gm.moveSheet'; requestId?: string; payload: { sheetId: string; direction: 'left' | 'right' } }
  | { type: 'gm.updateCardsPerPage'; requestId?: string; payload: { cardsPerPage: number } }
  | { type: 'turn.end'; requestId?: string; payload?: Record<string, never> }
  | { type: 'turn.forceSkip'; requestId?: string; payload: { playerId: string } }
  | { type: 'card.draw'; requestId?: string; payload?: Record<string, never> }
  | { type: 'card.draw.confirm'; requestId?: string; payload: { cardId: string } }
  | { type: 'card.create'; requestId?: string; payload: { card: Omit<DhCard, 'id' | 'is_custom'> } }
  | { type: 'card.play'; requestId?: string; payload: { cardId: string; x: number; y: number } }
  | { type: 'card.move.commit'; requestId?: string; payload: { cardId: string; x: number; y: number } }
  | { type: 'card.resize.commit'; requestId?: string; payload: { cardId: string; width: number; height: number } }
  | { type: 'card.lock'; requestId?: string; payload: { cardId: string } }
  | { type: 'card.unlock'; requestId?: string; payload: { cardId: string } }
  | { type: 'card.edit'; requestId?: string; payload: { cardId: string; updates: Partial<DhCard> & { territory?: Rect | null } } }
  | { type: 'card.delete'; requestId?: string; payload: { cardId: string } }
  | { type: 'card.recycle'; requestId?: string; payload: { cardId: string } }
  | { type: 'connection.add'; requestId?: string; payload: Omit<Connection, 'id'> }
  | { type: 'connection.update'; requestId?: string; payload: { connectionId: string; updates: Partial<Pick<Connection, 'color' | 'label'>> } }
  | { type: 'connection.remove'; requestId?: string; payload: { connectionId: string } }
  | { type: 'annotation.add'; requestId?: string; payload: Annotation }
  | { type: 'annotation.update'; requestId?: string; payload: { annotationId: string; updates: Partial<Pick<Annotation, 'text' | 'x' | 'y' | 'font_size'>> } }
  | { type: 'annotation.remove'; requestId?: string; payload: { annotationId: string } }
  | { type: 'ping'; requestId?: string; payload?: Record<string, never> }

export type ServerMessage =
  | { type: 'room.snapshot'; payload: { state: RoomState; you: { player_id: string } } }
  | { type: 'room.updated'; payload: { state: RoomState; reason: string } }
  | { type: 'draw.options'; requestId?: string; payload: { cards: DhCard[] } }
  | { type: 'ack'; requestId?: string; payload: { ok: true } }
  | { type: 'error'; requestId?: string; payload: { code: string; message: string } }
  | { type: 'pong'; requestId?: string; payload: { server_time: string } }

export interface CreateRoomRequest {
  room_name: string
  nickname: string
  room_type?: RoomType
  selected_built_in_pack_ids?: string[]
  selected_pack_ids?: string[]
}

export interface JoinRoomRequest {
  invite_code: string
  nickname: string
}

export interface RoomJoinResponse {
  session: {
    room_id: string
    invite_code: string
    player_id: string
    nickname: string
    token: string
    websocket_url: string
  }
  state: RoomState
}
