import type {
  DhRoomBackup,
  DiceRollRequest,
  GmPanelResourceKey,
  MobilePanelExperience,
  MobilePanelResourceKey,
  ResourceTrackerSheet,
  RoomState,
  RoomType,
} from './types'

export type ClientMessage =
  | {
    type: 'room.updateSettings'
    requestId?: string
    payload: {
      importsEnabled?: boolean
      resourceChangeRequiresApproval?: boolean
      battlePanelVisibility?: 'host-only' | 'shared'
      gmPanelTheme?: 'gold-abyss' | 'jade-hex' | 'amethyst-ember'
    }
  }
  | { type: 'room.importRoomBackup'; requestId?: string; payload: { backup: DhRoomBackup } }
  | { type: 'gm.importHtmlCharacter'; requestId?: string; payload: { fileName: string; html: string } }
  | { type: 'gm.replaceHtmlCharacter'; requestId?: string; payload: { sheetId: string; fileName: string; html: string } }
  | { type: 'gm.deleteSheet'; requestId?: string; payload: { sheetId: string } }
  | { type: 'gm.updateSheet'; requestId?: string; payload: { sheetId: string; sheet: ResourceTrackerSheet } }
  | { type: 'gm.updateResource'; requestId?: string; payload: { sheetId: string; resourceKey: GmPanelResourceKey; nextValue: number | boolean[] } }
  | { type: 'gm.updateFear'; requestId?: string; payload: { value: number } }
  | { type: 'gm.createCountdown'; requestId?: string; payload: { name: string; max: number } }
  | { type: 'gm.updateCountdown'; requestId?: string; payload: { countdownId: string; value: number } }
  | { type: 'gm.deleteCountdown'; requestId?: string; payload: { countdownId: string } }
  | { type: 'gm.moveSheet'; requestId?: string; payload: { sheetId: string; direction: 'left' | 'right' } }
  | { type: 'gm.updateCardsPerPage'; requestId?: string; payload: { cardsPerPage: number } }
  | {
    type: 'mobile.importCharacterCode'
    requestId?: string
    payload: { code: string; displayName: string; experiences: MobilePanelExperience[] }
  }
  | {
    type: 'mobile.replaceCharacterCode'
    requestId?: string
    payload: { characterId: string; code: string }
  }
  | { type: 'mobile.deleteCharacter'; requestId?: string; payload: { characterId: string } }
  | {
    type: 'mobile.updateCharacterCustom'
    requestId?: string
    payload: { characterId: string; displayName: string; experiences: MobilePanelExperience[] }
  }
  | {
    type: 'mobile.updateResource'
    requestId?: string
    payload: { characterId: string; resourceKey: MobilePanelResourceKey; nextValue: number | boolean[] }
  }
  | { type: 'mobile.updateFear'; requestId?: string; payload: { value: number } }
  | { type: 'mobile.createCountdown'; requestId?: string; payload: { name: string; max: number } }
  | { type: 'mobile.updateCountdown'; requestId?: string; payload: { countdownId: string; value: number } }
  | { type: 'mobile.deleteCountdown'; requestId?: string; payload: { countdownId: string } }
  | { type: 'dice.roll'; requestId?: string; payload: DiceRollRequest }
  | { type: 'dice.clearHistory'; requestId?: string; payload?: Record<string, never> }
  | { type: 'xcard.raise'; requestId?: string; payload?: Record<string, never> }
  | { type: 'xcard.acknowledge'; requestId?: string; payload?: Record<string, never> }
  | { type: 'ping'; requestId?: string; payload?: Record<string, never> }

export type ServerMessage =
  | { type: 'room.snapshot'; payload: { state: RoomState; you: { player_id: string } } }
  | { type: 'room.updated'; payload: { state: RoomState; reason: string } }
  | { type: 'ack'; requestId?: string; payload: { ok: true } }
  | { type: 'error'; requestId?: string; payload: { code: string; message: string } }
  | { type: 'pong'; requestId?: string; payload: { server_time: string } }

export interface CreateRoomRequest {
  room_name: string
  nickname: string
  room_type?: RoomType
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
