import type {
  DhRoomBackup,
  DiceRollRequest,
  GmPanelResourceKey,
  MobilePanelExperience,
  MobilePanelActivityLogItem,
  MobilePanelCharacterEntry,
  MobilePanelResourceKey,
  GmPanelActivityLogItem,
  GmPanelCharacterSheetEntry,
  Player,
  ResourceTrackerCountdown,
  RoomSettings,
  ResourceTrackerSheet,
  RoomState,
  RoomType,
  XCardAlert,
} from './types'
import type { DrawingBoardState, DrawingBoardSubmitRequest } from './drawing'

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
  | { type: 'drawing.submit'; requestId?: string; payload: DrawingBoardSubmitRequest }
  | { type: 'xcard.raise'; requestId?: string; payload?: Record<string, never> }
  | { type: 'xcard.acknowledge'; requestId?: string; payload?: Record<string, never> }
  | { type: 'ping'; requestId?: string; payload?: Record<string, never> }

export interface RoomPatchCommon {
  reason: string
  snapshot_version: number
  /** Alias retained for optimistic clients that track a generic authoritative version. */
  version: number
  updated_at: string
}

export type RoomPatch = RoomPatchCommon & (
  | { kind: 'room.replacement'; state: RoomState }
  | { kind: 'room.settings'; settings: RoomSettings }
  | { kind: 'room.metadata'; expires_at: string }
  | { kind: 'players.presence'; players: Player[]; hostPlayerId: string; xCard: XCardAlert | null }
  | ({ kind: 'gm.sheet'; sheetId: string; sheetOrder: string[]; activityLog: GmPanelActivityLogItem[] } & (
    | { operation: 'upsert'; sheet: GmPanelCharacterSheetEntry }
    | { operation: 'delete' }
  ))
  | {
    kind: 'gm.resource'
    sheetId: string
    resourceKey: GmPanelResourceKey
    value: number | boolean[]
    sheetUpdatedAt: string
    activityLog: GmPanelActivityLogItem[]
  }
  | { kind: 'gm.fear'; fear: { value: number; max: number }; activityLog: GmPanelActivityLogItem[] }
  | ({ kind: 'gm.countdown'; countdownId: string; activityLog: GmPanelActivityLogItem[] } & (
    | { operation: 'upsert'; countdown: ResourceTrackerCountdown }
    | { operation: 'delete' }
  ))
  | { kind: 'gm.order'; sheetOrder: string[]; activityLog: GmPanelActivityLogItem[] }
  | { kind: 'gm.cardsPerPage'; cardsPerPage: number; activityLog: GmPanelActivityLogItem[] }
  | ({
    kind: 'mobile.character'
    characterId: string
    characterOrder: string[]
    activityLog: MobilePanelActivityLogItem[]
  } & (
    | { operation: 'upsert'; character: MobilePanelCharacterEntry }
    | { operation: 'delete' }
  ))
  | {
    kind: 'mobile.resource'
    characterId: string
    resourceKey: MobilePanelResourceKey
    value: number | boolean[]
    activityLog: MobilePanelActivityLogItem[]
  }
  | { kind: 'mobile.fear'; fear: { value: number; max: number }; activityLog: MobilePanelActivityLogItem[] }
  | ({ kind: 'mobile.countdown'; countdownId: string; activityLog: MobilePanelActivityLogItem[] } & (
    | { operation: 'upsert'; countdown: ResourceTrackerCountdown }
    | { operation: 'delete' }
  ))
  | { kind: 'dice.history'; diceRolls: RoomState['dice_rolls'] }
  | { kind: 'drawing'; drawingBoard: DrawingBoardState }
  | { kind: 'xcard'; xCard: XCardAlert | null }
)

export type RoomPatchData = RoomPatch extends infer Patch
  ? Patch extends RoomPatch
    ? Omit<Patch, keyof RoomPatchCommon>
    : never
  : never

export type ServerMessage =
  | { type: 'room.snapshot'; payload: { state: RoomState; you: { player_id: string } } }
  | { type: 'room.patch'; payload: RoomPatch }
  | { type: 'ack'; requestId?: string; payload: { ok: true; snapshot_version: number; version: number } }
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
