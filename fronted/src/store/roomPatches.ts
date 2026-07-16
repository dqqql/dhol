import type {
  DrawingBoardState,
  GmPanelResourceKey,
  MobilePanelResourceKey,
  RoomPatch,
  RoomState,
} from '@dhgc/shared'

interface PendingMutationCommon {
  requestId: string
  baseVersion: number
  acknowledgedVersion?: number
}

export type PendingMutation = PendingMutationCommon & (
  | { kind: 'gm.resource'; sheetId: string; resourceKey: GmPanelResourceKey; value: number | boolean[] }
  | { kind: 'gm.fear'; value: number }
  | { kind: 'gm.countdown'; countdownId: string; value: number }
  | { kind: 'mobile.resource'; characterId: string; resourceKey: MobilePanelResourceKey; value: number | boolean[] }
  | { kind: 'mobile.fear'; value: number }
  | { kind: 'mobile.countdown'; countdownId: string; value: number }
  | { kind: 'drawing'; drawingBoard: DrawingBoardState }
)

export type PendingMutationInput = PendingMutation extends infer Mutation
  ? Mutation extends PendingMutation
    ? Omit<Mutation, keyof PendingMutationCommon>
    : never
  : never

export interface OptimisticRoomState {
  authoritativeRoom: RoomState | null
  room: RoomState | null
  pending: PendingMutation[]
}

export function applyRoomPatch(room: RoomState, patch: RoomPatch): RoomState {
  if (patch.snapshot_version <= room.snapshot_version) return room

  const common = {
    snapshot_version: patch.snapshot_version,
    updated_at: patch.updated_at,
  }

  switch (patch.kind) {
    case 'room.replacement':
      return { ...patch.state, ...common }
    case 'room.settings':
      return { ...room, settings: patch.settings, ...common }
    case 'room.metadata':
      return { ...room, expires_at: patch.expires_at, ...common }
    case 'players.presence':
      return { ...room, players: patch.players, host_player_id: patch.hostPlayerId, x_card: patch.xCard, ...common }
    case 'gm.sheet':
      return withGmPanel(room, common, (panel) => ({
        ...panel,
        sheets: patch.operation === 'delete'
          ? panel.sheets.filter((sheet) => sheet.id !== patch.sheetId)
          : upsertById(panel.sheets, patch.sheet),
        sheet_order: patch.sheetOrder,
        activity_log: patch.activityLog,
      }))
    case 'gm.resource':
      return withGmPanel(room, common, (panel) => ({
        ...panel,
        sheets: panel.sheets.map((sheet) => sheet.id === patch.sheetId ? {
          ...sheet,
          updated_at: patch.sheetUpdatedAt,
          parsed_sheet: {
            ...sheet.parsed_sheet,
            resources: { ...sheet.parsed_sheet.resources, [patch.resourceKey]: patch.value },
          },
        } : sheet),
        activity_log: patch.activityLog,
      }))
    case 'gm.fear':
      return withGmPanel(room, common, (panel) => ({ ...panel, fear: patch.fear, activity_log: patch.activityLog }))
    case 'gm.countdown':
      return withGmPanel(room, common, (panel) => ({
        ...panel,
        countdowns: patch.operation === 'delete'
          ? panel.countdowns.filter((countdown) => countdown.id !== patch.countdownId)
          : upsertById(panel.countdowns, patch.countdown),
        activity_log: patch.activityLog,
      }))
    case 'gm.order':
      return withGmPanel(room, common, (panel) => ({ ...panel, sheet_order: patch.sheetOrder, activity_log: patch.activityLog }))
    case 'gm.cardsPerPage':
      return withGmPanel(room, common, (panel) => ({ ...panel, cards_per_page: patch.cardsPerPage, activity_log: patch.activityLog }))
    case 'mobile.character':
      return withMobilePanel(room, common, (panel) => ({
        ...panel,
        characters: patch.operation === 'delete'
          ? panel.characters.filter((character) => character.id !== patch.characterId)
          : upsertById(panel.characters, patch.character),
        character_order: patch.characterOrder,
        activity_log: patch.activityLog,
      }))
    case 'mobile.resource':
      return withMobilePanel(room, common, (panel) => ({
        ...panel,
        characters: panel.characters.map((character) => character.id === patch.characterId ? {
          ...character,
          tracker: { ...character.tracker, [patch.resourceKey]: patch.value },
        } : character),
        activity_log: patch.activityLog,
      }))
    case 'mobile.fear':
      return withMobilePanel(room, common, (panel) => ({ ...panel, fear: patch.fear, activity_log: patch.activityLog }))
    case 'mobile.countdown':
      return withMobilePanel(room, common, (panel) => ({
        ...panel,
        countdowns: patch.operation === 'delete'
          ? panel.countdowns.filter((countdown) => countdown.id !== patch.countdownId)
          : upsertById(panel.countdowns, patch.countdown),
        activity_log: patch.activityLog,
      }))
    case 'dice.history':
      return { ...room, dice_rolls: patch.diceRolls, ...common }
    case 'drawing':
      return { ...room, drawing_board: patch.drawingBoard, ...common }
    case 'xcard':
      return { ...room, x_card: patch.xCard, ...common }
  }
}

export function createOptimisticRoomState(room: RoomState | null = null): OptimisticRoomState {
  return { authoritativeRoom: room, room, pending: [] }
}

export function receiveRoomSnapshot(state: OptimisticRoomState, room: RoomState): OptimisticRoomState {
  return { authoritativeRoom: room, room, pending: [] }
}

export function enqueueOptimisticMutation(state: OptimisticRoomState, mutation: PendingMutation): OptimisticRoomState {
  return rebuild({ ...state, pending: [...state.pending, mutation] })
}

export function applyAuthoritativeRoomPatch(state: OptimisticRoomState, patch: RoomPatch): OptimisticRoomState {
  if (!state.authoritativeRoom || patch.snapshot_version <= state.authoritativeRoom.snapshot_version) return state

  const authoritativeRoom = applyRoomPatch(state.authoritativeRoom, patch)
  const pending = patch.kind === 'room.replacement'
    ? []
    : consumeCoveredMutation(state.pending, patch)
      .filter((mutation) => mutation.acknowledgedVersion === undefined || mutation.acknowledgedVersion > patch.snapshot_version)
  return rebuild({ authoritativeRoom, room: authoritativeRoom, pending })
}

export function acknowledgeMutation(state: OptimisticRoomState, requestId: string, version: number): OptimisticRoomState {
  const authoritativeVersion = state.authoritativeRoom?.snapshot_version ?? -1
  const pending = authoritativeVersion >= version
    ? state.pending.filter((mutation) => mutation.requestId !== requestId)
    : state.pending.map((mutation) => mutation.requestId === requestId
      ? { ...mutation, acknowledgedVersion: version }
      : mutation)
  return rebuild({ ...state, pending })
}

export function rejectMutation(state: OptimisticRoomState, requestId: string): OptimisticRoomState {
  return rebuild({ ...state, pending: state.pending.filter((mutation) => mutation.requestId !== requestId) })
}

function rebuild(state: OptimisticRoomState): OptimisticRoomState {
  const room = state.authoritativeRoom
    ? state.pending.reduce(applyOptimisticMutation, state.authoritativeRoom)
    : null
  return { ...state, room }
}

function applyOptimisticMutation(room: RoomState, mutation: PendingMutation): RoomState {
  switch (mutation.kind) {
    case 'gm.resource':
      return room.gm_panel ? {
        ...room,
        gm_panel: {
          ...room.gm_panel,
          sheets: room.gm_panel.sheets.map((sheet) => sheet.id === mutation.sheetId ? {
            ...sheet,
            parsed_sheet: {
              ...sheet.parsed_sheet,
              resources: { ...sheet.parsed_sheet.resources, [mutation.resourceKey]: mutation.value },
            },
          } : sheet),
        },
      } : room
    case 'gm.fear':
      return room.gm_panel ? { ...room, gm_panel: { ...room.gm_panel, fear: { ...room.gm_panel.fear, value: mutation.value } } } : room
    case 'gm.countdown':
      return room.gm_panel ? { ...room, gm_panel: { ...room.gm_panel, countdowns: updateCountdown(room.gm_panel.countdowns, mutation.countdownId, mutation.value) } } : room
    case 'mobile.resource':
      return room.mobile_panel ? {
        ...room,
        mobile_panel: {
          ...room.mobile_panel,
          characters: room.mobile_panel.characters.map((character) => character.id === mutation.characterId
            ? { ...character, tracker: { ...character.tracker, [mutation.resourceKey]: mutation.value } }
            : character),
        },
      } : room
    case 'mobile.fear':
      return room.mobile_panel ? { ...room, mobile_panel: { ...room.mobile_panel, fear: { ...room.mobile_panel.fear, value: mutation.value } } } : room
    case 'mobile.countdown':
      return room.mobile_panel ? { ...room, mobile_panel: { ...room.mobile_panel, countdowns: updateCountdown(room.mobile_panel.countdowns, mutation.countdownId, mutation.value) } } : room
    case 'drawing':
      return { ...room, drawing_board: mutation.drawingBoard }
  }
}

function consumeCoveredMutation(pending: PendingMutation[], patch: RoomPatch): PendingMutation[] {
  const index = pending.findIndex((mutation) => mutationMatchesPatch(mutation, patch))
  return index < 0 ? pending : [...pending.slice(0, index), ...pending.slice(index + 1)]
}

function mutationMatchesPatch(mutation: PendingMutation, patch: RoomPatch): boolean {
  switch (mutation.kind) {
    case 'gm.resource':
      return patch.kind === mutation.kind && patch.sheetId === mutation.sheetId && patch.resourceKey === mutation.resourceKey
    case 'gm.fear':
    case 'mobile.fear':
    case 'drawing':
      return patch.kind === mutation.kind
    case 'gm.countdown':
    case 'mobile.countdown':
      return patch.kind === mutation.kind && patch.countdownId === mutation.countdownId
    case 'mobile.resource':
      return patch.kind === mutation.kind && patch.characterId === mutation.characterId && patch.resourceKey === mutation.resourceKey
  }
}

function withGmPanel(
  room: RoomState,
  common: Pick<RoomState, 'snapshot_version' | 'updated_at'>,
  update: (panel: NonNullable<RoomState['gm_panel']>) => NonNullable<RoomState['gm_panel']>,
): RoomState {
  return { ...room, ...(room.gm_panel ? { gm_panel: update(room.gm_panel) } : {}), ...common }
}

function withMobilePanel(
  room: RoomState,
  common: Pick<RoomState, 'snapshot_version' | 'updated_at'>,
  update: (panel: NonNullable<RoomState['mobile_panel']>) => NonNullable<RoomState['mobile_panel']>,
): RoomState {
  return { ...room, ...(room.mobile_panel ? { mobile_panel: update(room.mobile_panel) } : {}), ...common }
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  const index = items.findIndex((candidate) => candidate.id === item.id)
  return index < 0 ? [...items, item] : items.map((candidate, candidateIndex) => candidateIndex === index ? item : candidate)
}

function updateCountdown<T extends { id: string; value: number }>(items: T[], id: string, value: number): T[] {
  return items.map((countdown) => countdown.id === id ? { ...countdown, value } : countdown)
}
