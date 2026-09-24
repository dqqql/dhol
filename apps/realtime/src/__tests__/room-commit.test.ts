import { describe, expect, it } from 'vitest'
import { DRAWING_BOARD_COLORS } from '../../../../packages/shared/src/index'
import { RoomDurableObject } from '../index'
import type { RoomState } from '../../../../packages/shared/src/index'

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
    expires_at: '2026-07-06T00:00:00.000Z',
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
  it('can broadcast a room update before waiting for storage persistence', async () => {
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

    const commitPromise = (durableObject as unknown as {
      commit: (reason: string, options: { waitForPersistence: boolean }) => Promise<void>
    }).commit('dice.roll', { waitForPersistence: false })

    await Promise.resolve()

    try {
      expect(sentMessages).toHaveLength(1)
      expect(JSON.parse(sentMessages[0])).toMatchObject({
        type: 'room.updated',
        payload: { reason: 'dice.roll' },
      })
      expect(waitUntilPromises).toHaveLength(1)
    } finally {
      storagePut.resolve()
      await commitPromise
    }

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
