import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiceRollRecord, RoomSession, RoomState, ServerMessage } from '@dhgc/shared'

const realtimeMock = vi.hoisted(() => ({
  instances: [] as Array<{
    emit: (message: ServerMessage) => void
    getManualReconnectCount: () => number
  }>,
  room: null as RoomState | null,
  session: null as RoomSession | null,
}))

vi.mock('@/lib/realtime', () => ({
  createRoomRequest: vi.fn(async () => ({
    state: realtimeMock.room,
    session: realtimeMock.session,
  })),
  joinRoomRequest: vi.fn(),
  RoomSocketConnection: class {
    isConnected = true
    private handlers: { onMessage: (message: ServerMessage) => void }
    private manualReconnectCount = 0
    constructor(_url: string, handlers: { onMessage: (message: ServerMessage) => void }) {
      this.handlers = handlers
      realtimeMock.instances.push({
        emit: message => this.handlers.onMessage(message),
        getManualReconnectCount: () => this.manualReconnectCount,
      })
    }
    connect() {
      this.handlers.onMessage({
        type: 'room.snapshot',
        payload: { state: realtimeMock.room!, you: { player_id: 'player-1' } },
      })
    }
    dispose() {}
    manualReconnect() { this.manualReconnectCount += 1 }
    send() { return true }
  },
}))

import { useStore } from '@/store/useStore'

function createRoom(): RoomState {
  return {
    room_type: 'gm-panel',
    room_id: 'room-1',
    room_name: 'Incremental dice test',
    invite_code: 'ABC123',
    created_at: '2026-09-25T00:00:00.000Z',
    expires_at: '2026-09-26T00:00:00.000Z',
    host_player_id: 'player-1',
    players: [{
      id: 'player-1', nickname: 'Host', color: '#f43f5e', is_host: true, is_online: true,
      joined_at: '2026-09-25T00:00:00.000Z', last_seen_at: '2026-09-25T00:00:00.000Z',
    }],
    settings: {
      imports_enabled: true,
      resource_change_requires_approval: false,
      battle_panel_visibility: 'shared',
      gm_panel_theme: 'gold-abyss',
    },
    gm_panel: { sheets: [], sheet_order: [], activity_log: [], fear: { value: 0, max: 12 }, countdowns: [], cards_per_page: 2 },
    dice_rolls: [],
    x_card: null,
    snapshot_version: 1,
    updated_at: '2026-09-25T00:00:00.000Z',
  }
}

function createRoll(id: string): DiceRollRecord {
  return {
    id,
    created_at: '2026-09-25T00:00:00.000Z',
    actor_player_id: 'player-1',
    actor_name: 'Host',
    normalized_formula: '1d20',
    request: { mode: 'standard', modifier_mode: 'normal', repeat: 1, modifier: 0, dice: [{ sides: 20, count: 1 }] },
    mode: 'standard',
    modifier_mode: 'normal',
    results: [{ total: 10, critical: false, primary_rolls: [10], terms: [{ notation: '1d20', sides: 20, count: 1, rolls: [10], subtotal: 10 }] }],
  }
}

async function connect() {
  await useStore.getState().createRoom({ nickname: 'Host', roomName: 'Room', roomType: 'gm-panel' })
  return realtimeMock.instances.at(-1)!
}

beforeEach(() => {
  vi.stubGlobal('window', { setTimeout: vi.fn() })
  useStore.getState().leaveRoom()
  realtimeMock.instances.length = 0
  realtimeMock.room = createRoom()
  realtimeMock.session = {
    room_id: 'room-1', invite_code: 'ABC123', player_id: 'player-1', nickname: 'Host',
    token: 'token', websocket_url: 'wss://example.test/room',
  }
})

describe('incremental dice messages', () => {
  it('appends a roll without replacing unrelated room state and updates the snapshot version', async () => {
    const connection = await connect()
    connection.emit({ type: 'dice.rolled', payload: { roll: createRoll('roll-1'), snapshot_version: 2 } })

    expect(useStore.getState().room).toMatchObject({
      room_name: 'Incremental dice test',
      snapshot_version: 2,
      dice_rolls: [{ id: 'roll-1' }],
    })
  })

  it('retains only the newest 50 rolls', async () => {
    const connection = await connect()
    for (let index = 0; index < 51; index += 1) {
      connection.emit({ type: 'dice.rolled', payload: { roll: createRoll(`roll-${index}`), snapshot_version: index + 2 } })
    }

    expect(useStore.getState().room?.dice_rolls).toHaveLength(50)
    expect(useStore.getState().room?.dice_rolls.map(roll => roll.id)).toEqual(
      Array.from({ length: 50 }, (_, index) => `roll-${index + 1}`),
    )
    expect(useStore.getState().room?.snapshot_version).toBe(52)
  })

  it('deduplicates a replayed roll id without accepting its repeated version', async () => {
    const connection = await connect()
    const message = { type: 'dice.rolled', payload: { roll: createRoll('roll-1'), snapshot_version: 2 } } as const
    connection.emit(message)
    connection.emit(message)

    expect(useStore.getState().room?.dice_rolls.map(roll => roll.id)).toEqual(['roll-1'])
    expect(useStore.getState().room?.snapshot_version).toBe(2)
  })

  it('deduplicates a roll id while accepting the next sequential version', async () => {
    const connection = await connect()
    connection.emit({ type: 'dice.rolled', payload: { roll: createRoll('roll-1'), snapshot_version: 2 } })
    connection.emit({ type: 'dice.rolled', payload: { roll: createRoll('roll-1'), snapshot_version: 3 } })

    expect(useStore.getState().room?.dice_rolls.map(roll => roll.id)).toEqual(['roll-1'])
    expect(useStore.getState().room?.snapshot_version).toBe(3)
  })

  it('clears dice history without replacing the room and updates the snapshot version', async () => {
    realtimeMock.room!.dice_rolls = [createRoll('roll-1')]
    const connection = await connect()
    connection.emit({ type: 'dice.historyCleared', payload: { snapshot_version: 2 } })

    expect(useStore.getState().room).toMatchObject({
      room_name: 'Incremental dice test',
      dice_rolls: [],
      snapshot_version: 2,
    })
  })

  it('ignores rolls with the current or an older snapshot version', async () => {
    realtimeMock.room!.snapshot_version = 5
    realtimeMock.room!.dice_rolls = [createRoll('current-roll')]
    const connection = await connect()

    connection.emit({ type: 'dice.rolled', payload: { roll: createRoll('same-version'), snapshot_version: 5 } })
    connection.emit({ type: 'dice.rolled', payload: { roll: createRoll('older-version'), snapshot_version: 4 } })

    expect(useStore.getState().room?.dice_rolls.map(roll => roll.id)).toEqual(['current-roll'])
    expect(useStore.getState().room?.snapshot_version).toBe(5)
    expect(connection.getManualReconnectCount()).toBe(0)
  })

  it('does not resurrect history when an old roll arrives after a newer clear', async () => {
    realtimeMock.room!.snapshot_version = 11
    const connection = await connect()

    connection.emit({ type: 'dice.rolled', payload: { roll: createRoll('roll-12'), snapshot_version: 12 } })
    connection.emit({ type: 'dice.historyCleared', payload: { snapshot_version: 13 } })
    connection.emit({ type: 'dice.rolled', payload: { roll: createRoll('late-roll-12'), snapshot_version: 12 } })

    expect(useStore.getState().room?.dice_rolls).toEqual([])
    expect(useStore.getState().room?.snapshot_version).toBe(13)
  })

  it('does not let an old clear remove newer roll history', async () => {
    const connection = await connect()
    connection.emit({ type: 'dice.rolled', payload: { roll: createRoll('roll-2'), snapshot_version: 2 } })
    connection.emit({ type: 'dice.historyCleared', payload: { snapshot_version: 2 } })

    expect(useStore.getState().room?.dice_rolls.map(roll => roll.id)).toEqual(['roll-2'])
    expect(useStore.getState().room?.snapshot_version).toBe(2)
  })

  it('does not apply a version gap and triggers a full-state reconnect', async () => {
    const connection = await connect()
    connection.emit({ type: 'dice.rolled', payload: { roll: createRoll('gap-roll'), snapshot_version: 3 } })

    expect(useStore.getState().room?.dice_rolls).toEqual([])
    expect(useStore.getState().room?.snapshot_version).toBe(1)
    expect(connection.getManualReconnectCount()).toBe(1)
  })
})
