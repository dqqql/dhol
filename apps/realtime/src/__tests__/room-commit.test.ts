import { describe, expect, it } from 'vitest'
import { DRAWING_BOARD_COLORS } from '../../../../packages/shared/src/index'
import { RoomDurableObject } from '../index'
import type { DiceRollRecord, RoomState } from '../../../../packages/shared/src/index'

class Deferred<T = void> {
  promise: Promise<T>
  resolve!: (value: T | PromiseLike<T>) => void
  reject!: (reason?: unknown) => void

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }
}

function createRoom(): RoomState {
  return {
    room_type: 'gm-panel',
    room_id: 'room-1',
    room_name: 'Latency Test',
    invite_code: 'ABC123',
    created_at: '2026-07-05T00:00:00.000Z',
    expires_at: '2099-07-06T00:00:00.000Z',
    host_player_id: 'player-1',
    players: [
      {
        id: 'player-1',
        nickname: 'Host',
        color: '#f43f5e',
        is_host: true,
        is_online: true,
        joined_at: '2026-07-05T00:00:00.000Z',
        last_seen_at: '2026-07-05T00:00:00.000Z',
      },
    ],
    settings: {
      imports_enabled: true,
      resource_change_requires_approval: false,
      battle_panel_visibility: 'shared',
      gm_panel_theme: 'gold-abyss',
    },
    gm_panel: {
      sheets: [],
      sheet_order: [],
      activity_log: [],
      fear: { value: 0, max: 12 },
      countdowns: [],
      cards_per_page: 2,
    },
    dice_rolls: [],
    x_card: null,
    snapshot_version: 1,
    updated_at: '2026-07-05T00:00:00.000Z',
  }
}

describe('RoomDurableObject commit latency', () => {
  it('broadcasts a single dice roll before waiting for storage persistence', async () => {
    const storagePut = new Deferred<void>()
    const waitUntilPromises: Promise<unknown>[] = []
    const sentMessages: string[] = []

    const ctx = {
      storage: {
        put: () => storagePut.promise,
        list: async () => new Map<string, string>(),
      },
      waitUntil: (promise: Promise<unknown>) => {
        waitUntilPromises.push(promise)
      },
      getWebSockets: () => [
        { send: (message: string) => sentMessages.push(message) } as unknown as WebSocket,
      ],
    } as unknown as DurableObjectState

    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)
    ;(durableObject as unknown as { room: RoomState | null }).room = createRoom()

    const roll = (durableObject as unknown as {
      rollDice: (player: RoomState['players'][number], request: {
        mode: 'standard'
        modifier_mode: 'normal'
        repeat: number
        modifier: number
        dice: Array<{ sides: number; count: number }>
      }) => DiceRollRecord
    }).rollDice(createRoom().players[0], {
      mode: 'standard',
      modifier_mode: 'normal',
      repeat: 1,
      modifier: 2,
      dice: [{ sides: 20, count: 1 }],
    })
    const commitPromise = (durableObject as unknown as {
      commit: (reason: string, options: {
        waitForPersistence: boolean
        message: (snapshotVersion: number) => unknown
      }) => Promise<void>
    }).commit('dice.roll', {
      waitForPersistence: false,
      message: snapshotVersion => ({
        type: 'dice.rolled',
        payload: { roll, snapshot_version: snapshotVersion },
      }),
    })

    await Promise.resolve()

    try {
      expect(sentMessages).toHaveLength(1)
      const message = JSON.parse(sentMessages[0])
      expect(message).toMatchObject({
        type: 'dice.rolled',
        payload: {
          roll: {
            id: roll.id,
            actor_player_id: 'player-1',
            actor_name: 'Host',
            normalized_formula: '1d20 + 2',
          },
          snapshot_version: 2,
        },
      })
      expect(message.payload).not.toHaveProperty('state')
      expect(JSON.stringify(message).length).toBeLessThan(2_000)
      expect(waitUntilPromises).toHaveLength(1)
    } finally {
      storagePut.resolve()
      await commitPromise
    }

    await Promise.all(waitUntilPromises)
  })

  it('broadcasts only dice.historyCleared with the latest snapshot version', async () => {
    const sentMessages: string[] = []
    const waitUntilPromises: Promise<unknown>[] = []
    const room = createRoom()
    room.dice_rolls = [{
      id: 'dice_roll_old',
      created_at: '2026-07-05T00:00:00.000Z',
      actor_player_id: 'player-1',
      actor_name: 'Host',
      normalized_formula: '1d20',
      request: { mode: 'standard', modifier_mode: 'normal', repeat: 1, modifier: 0, dice: [{ sides: 20, count: 1 }] },
      mode: 'standard',
      modifier_mode: 'normal',
      results: [{ total: 10, critical: false, primary_rolls: [10], terms: [{ notation: '1d20', sides: 20, count: 1, rolls: [10], subtotal: 10 }] }],
    }]
    const ctx = {
      storage: {
        put: async () => undefined,
        list: async () => new Map<string, string>(),
      },
      waitUntil: (promise: Promise<unknown>) => waitUntilPromises.push(promise),
      getWebSockets: () => [
        { send: (message: string) => sentMessages.push(message) } as unknown as WebSocket,
      ],
    } as unknown as DurableObjectState
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)
    ;(durableObject as unknown as { room: RoomState | null }).room = room

    await (durableObject as unknown as {
      applyMessage: (session: { playerId: string }, message: unknown, socket: WebSocket) => Promise<void>
    }).applyMessage(
      { playerId: 'player-1' },
      { type: 'dice.clearHistory', payload: {} },
      {} as WebSocket,
    )

    expect(room.dice_rolls).toEqual([])
    expect(sentMessages.map(message => JSON.parse(message))).toEqual([{
      type: 'dice.historyCleared',
      payload: { snapshot_version: 2 },
    }])
    await Promise.all(waitUntilPromises)
  })

  it('handles dice.roll by broadcasting only the generated record and version', async () => {
    const sentMessages: string[] = []
    const waitUntilPromises: Promise<unknown>[] = []
    const ctx = {
      storage: {
        put: async () => undefined,
        list: async () => new Map<string, string>(),
      },
      waitUntil: (promise: Promise<unknown>) => waitUntilPromises.push(promise),
      getWebSockets: () => [
        { send: (message: string) => sentMessages.push(message) } as unknown as WebSocket,
      ],
    } as unknown as DurableObjectState
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)
    ;(durableObject as unknown as { room: RoomState | null }).room = createRoom()

    await (durableObject as unknown as {
      applyMessage: (session: { playerId: string }, message: unknown, socket: WebSocket) => Promise<void>
    }).applyMessage(
      { playerId: 'player-1' },
      {
        type: 'dice.roll',
        payload: {
          mode: 'dual', modifier_mode: 'advantage', repeat: 1, modifier: 1,
          dice: [{ sides: 12, count: 2 }],
        },
      },
      {} as WebSocket,
    )

    expect(sentMessages).toHaveLength(1)
    const message = JSON.parse(sentMessages[0])
    expect(message).toMatchObject({
      type: 'dice.rolled',
      payload: {
        roll: {
          actor_player_id: 'player-1',
          mode: 'dual',
          modifier_mode: 'advantage',
        },
        snapshot_version: 2,
      },
    })
    expect(message.type).not.toBe('room.updated')
    expect(message.payload).not.toHaveProperty('state')
    expect(JSON.stringify(message).length).toBeLessThan(2_000)
    await Promise.all(waitUntilPromises)
  })
})

describe('RoomDurableObject drawing board', () => {
  it('stores submitted drawing shapes in room state', () => {
    const durableObject = new RoomDurableObject({} as DurableObjectState, { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()
    ;(durableObject as unknown as { room: RoomState | null }).room = room

    ;(durableObject as unknown as {
      submitDrawingBoard: (player: RoomState['players'][number], payload: unknown) => void
    }).submitDrawingBoard(room.players[0], {
      shapes: [
        {
          id: 'shape-1',
          kind: 'circle',
          color: DRAWING_BOARD_COLORS[2],
          x: 100,
          y: 120,
          width: 180,
          height: 140,
        },
      ],
    })

    expect(room.drawing_board).toMatchObject({
      updated_by_player_id: 'player-1',
      updated_by_name: 'Host',
      shapes: [
        {
          id: 'shape-1',
          kind: 'circle',
          color: DRAWING_BOARD_COLORS[2],
          x: 100,
          y: 120,
          width: 180,
          height: 140,
        },
      ],
    })
    expect(room.drawing_board?.updated_at).toEqual(expect.any(String))
  })
})
