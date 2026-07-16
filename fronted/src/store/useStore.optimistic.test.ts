import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientMessage, RoomState, ServerMessage } from '@dhgc/shared'

const socket = vi.hoisted(() => ({
  handlers: null as null | { onMessage: (message: ServerMessage) => void },
  sent: [] as ClientMessage[],
}))

vi.mock('nanoid', () => ({ nanoid: vi.fn(() => `request-${socket.sent.length + 1}`) }))
vi.mock('@/lib/realtime', () => ({
  createRoomRequest: vi.fn(async () => ({
    session: { room_id: 'room', invite_code: 'ABC123', player_id: 'host', nickname: 'GM', token: 'token', websocket_url: 'ws://room' },
    state: makeRoom(),
  })),
  joinRoomRequest: vi.fn(),
  RoomSocketConnection: class {
    isConnected = true
    constructor(_url: string, handlers: { onMessage: (message: ServerMessage) => void }) { socket.handlers = handlers }
    connect() {}
    send(message: ClientMessage) { socket.sent.push(message); return true }
    dispose() {}
    manualReconnect() {}
  },
}))

import { useStore } from './useStore'

const now = '2026-07-16T00:00:00.000Z'

function makeRoom(version = 1): RoomState {
  return {
    room_type: 'gm-panel', room_id: 'room', room_name: 'Room', invite_code: 'ABC123', created_at: now, expires_at: now,
    host_player_id: 'host', players: [{ id: 'host', nickname: 'GM', color: '#fff', is_host: true, is_online: true, joined_at: now, last_seen_at: now }],
    settings: { imports_enabled: true, resource_change_requires_approval: false, battle_panel_visibility: 'shared', gm_panel_theme: 'gold-abyss' },
    gm_panel: {
      cards_per_page: 4, fear: { value: 1, max: 12 }, countdowns: [], sheet_order: ['sheet'], activity_log: [],
      sheets: [{ id: 'sheet', imported_at: now, updated_at: now, html_updated_at: now, source_file_name: 'a.html', source_format: 'mydhcharsheet-html', raw_character_data: {}, parsed_sheet: { file_name: 'a.html', character_name: 'A', summary_line: '', identity: { level: '', ancestry: '', profession: '', community: '', subclass: '', primary_trait: '' }, stats: { evasion: '', armor_value: '', minor_threshold: '', major_threshold: '', attributes: { agility: '', strength: '', finesse: '', instinct: '', presence: '', knowledge: '' } }, resources: { hope: 1, hope_max: 6, proficiency: [false], hp: [false], hp_max: 1, stress: [false], stress_max: 1, armor_slots: [false], armor_max: 1, gold: [false] }, equipment: { armor_name: '', armor_base_score: '', armor_threshold: '', armor_feature: '', primary_weapon_name: '', primary_weapon_trait: '', primary_weapon_damage: '', primary_weapon_feature: '', secondary_weapon_name: '', secondary_weapon_trait: '', secondary_weapon_damage: '', secondary_weapon_feature: '' }, narrative: { background: '', appearance: '', motivation: '', notes: '', experiences: [] } } }],
    },
    drawing_board: { shapes: [] }, dice_rolls: [], x_card: null, snapshot_version: version, updated_at: now,
  }
}

async function connect() {
  const connecting = useStore.getState().createRoom({ nickname: 'GM', roomName: 'Room', roomType: 'gm-panel' })
  await vi.waitFor(() => expect(socket.handlers).not.toBeNull())
  socket.handlers!.onMessage({ type: 'room.snapshot', payload: { state: makeRoom(), you: { player_id: 'host' } } })
  await connecting
}

describe('useStore optimistic mutations', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout })
    useStore.getState().leaveRoom()
    socket.handlers = null
    socket.sent = []
  })

  it('updates immediately, applies correction, rolls back errors, and resets on snapshot', async () => {
    await connect()

    useStore.getState().updateGmResource('sheet', 'hope', 4)
    expect(useStore.getState().room?.gm_panel?.sheets[0].parsed_sheet.resources.hope).toBe(4)
    expect(socket.sent[0].requestId).toBe('request-1')

    socket.handlers!.onMessage({
      type: 'room.patch',
      payload: { kind: 'gm.resource', sheetId: 'sheet', resourceKey: 'hope', value: 3, sheetUpdatedAt: now, activityLog: [], reason: 'corrected', snapshot_version: 2, version: 2, updated_at: now },
    })
    expect(useStore.getState().room?.gm_panel?.sheets[0].parsed_sheet.resources.hope).toBe(3)

    useStore.getState().updateGmResource('sheet', 'hope', 5)
    expect(useStore.getState().room?.gm_panel?.sheets[0].parsed_sheet.resources.hope).toBe(5)
    socket.handlers!.onMessage({ type: 'error', requestId: 'request-2', payload: { code: 'rejected', message: 'No' } })
    expect(useStore.getState().room?.gm_panel?.sheets[0].parsed_sheet.resources.hope).toBe(3)

    useStore.getState().updateGmResource('sheet', 'hope', 6)
    socket.handlers!.onMessage({ type: 'room.snapshot', payload: { state: makeRoom(9), you: { player_id: 'host' } } })
    expect(useStore.getState().room?.gm_panel?.sheets[0].parsed_sheet.resources.hope).toBe(1)
    expect(useStore.getState().room?.snapshot_version).toBe(9)
  })
})
