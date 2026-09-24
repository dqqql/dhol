import { describe, expect, it, vi } from 'vitest'
import { createGmSheetEntry, DRAWING_BOARD_COLORS } from '../../../../packages/shared/src/index'
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

function createSheet(id: string) {
  const timestamp = '2026-07-05T00:00:00.000Z'
  const sheet = createGmSheetEntry(`${id}.html`, {}, id, timestamp, timestamp, timestamp)
  sheet.source_html = `<html>source-${id}</html>`
  sheet.compiled_html = `<html>compiled-${id}</html>`
  sheet.parsed_sheet.character_name = id
  return sheet
}

function createImportedHtml(marker: string): string {
  return `<!doctype html>
<html data-version="1.0" data-exporter="daggerheart-character-sheet">
<head><meta name="generator" content="Daggerheart Character Sheet Exporter v1.0"></head>
<body>${marker}</body>
<script>window.characterData = { characterName: ${JSON.stringify(marker)} };</script>
</html>`
}

interface StorageFailure {
  operation: 'put' | 'delete'
  matches: (key: string) => boolean
  error: Error
}

function createStorageSpy(
  initialEntries: Array<[string, unknown]> = [],
  failure?: StorageFailure,
) {
  const entries = new Map<string, unknown>(initialEntries)
  const put = vi.fn(async (key: string, value: unknown) => {
    if (failure?.operation === 'put' && failure.matches(key)) throw failure.error
    entries.set(key, structuredClone(value))
  })
  const list = vi.fn(async ({ prefix }: { prefix?: string } = {}) => new Map(
    Array.from(entries.entries()).filter(([key]) => !prefix || key.startsWith(prefix)),
  ))
  const deleteEntry = vi.fn(async (key: string) => {
    if (failure?.operation === 'delete' && failure.matches(key)) throw failure.error
    entries.delete(key)
  })
  const transaction = vi.fn(async <T>(closure: (txn: DurableObjectTransaction) => Promise<T>) => {
    const before = structuredClone(entries)
    try {
      return await closure({ put, list, delete: deleteEntry } as unknown as DurableObjectTransaction)
    } catch (error) {
      entries.clear()
      for (const [key, value] of before) entries.set(key, value)
      throw error
    }
  })

  return {
    entries,
    storage: {
      get: async <T>(key: string) => entries.get(key) as T | undefined,
      put,
      list,
      delete: deleteEntry,
      transaction,
      getAlarm: async () => null,
      setAlarm: async () => undefined,
    } as unknown as DurableObjectStorage,
    put,
    list,
    deleteEntry,
    transaction,
  }
}

function createObject(storage: DurableObjectStorage, room = createRoom()) {
  const sentMessages: string[] = []
  const socket = {
    send: (message: string) => sentMessages.push(message),
    deserializeAttachment: () => ({ playerId: 'player-1', nickname: 'Host' }),
  } as unknown as WebSocket
  const ctx = {
    storage,
    waitUntil: () => undefined,
    getWebSockets: () => [socket],
  } as unknown as DurableObjectState
  const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)
  ;(durableObject as unknown as { room: RoomState | null }).room = room
  return { durableObject, room, sentMessages, socket }
}

async function applyRoomMessage(durableObject: RoomDurableObject, message: unknown): Promise<void> {
  await (durableObject as unknown as {
    applyMessage: (session: { playerId: string; nickname: string }, message: unknown, socket: WebSocket) => Promise<void>
  }).applyMessage({ playerId: 'player-1', nickname: 'Host' }, message, {} as WebSocket)
}

async function handleRoomMessage(durableObject: RoomDurableObject, socket: WebSocket, message: unknown): Promise<void> {
  await (durableObject as unknown as {
    handleMessage: (socket: WebSocket, data: string) => Promise<void>
  }).handleMessage(socket, JSON.stringify(message))
}

describe('RoomDurableObject HTML persistence', () => {
  it('ordinary commits persist only a stripped room snapshot without touching HTML storage', async () => {
    const storageSpy = createStorageSpy()
    const room = createRoom()
    room.gm_panel!.sheets = [createSheet('sheet-1')]
    room.gm_panel!.sheet_order = ['sheet-1']
    const { durableObject } = createObject(storageSpy.storage, room)

    await (durableObject as unknown as { commit: (reason: string) => Promise<void> }).commit('gm.updateFear')

    expect(storageSpy.put.mock.calls.map(([key]) => key)).toEqual(['room'])
    expect(storageSpy.put.mock.calls[0][1]).not.toHaveProperty('gm_panel.sheets.0.source_html')
    expect(storageSpy.put.mock.calls[0][1]).not.toHaveProperty('gm_panel.sheets.0.compiled_html')
    expect(storageSpy.list).not.toHaveBeenCalled()
    expect(storageSpy.deleteEntry).not.toHaveBeenCalled()
  })

  it('import and replacement upsert only the changed sheet HTML keys', async () => {
    const storageSpy = createStorageSpy()
    const room = createRoom()
    const { durableObject } = createObject(storageSpy.storage, room)

    await applyRoomMessage(durableObject, {
      type: 'gm.importHtmlCharacter', payload: { fileName: 'new.html', html: createImportedHtml('new') },
    })
    const sheetId = room.gm_panel!.sheets[0].id
    expect(storageSpy.put.mock.calls.map(([key]) => key)).toEqual([
      'room', `gm_sheet_html:${sheetId}`, `gm_sheet_compiled_html:${sheetId}`,
    ])
    expect(storageSpy.list).not.toHaveBeenCalled()

    storageSpy.put.mockClear()
    await applyRoomMessage(durableObject, {
      type: 'gm.replaceHtmlCharacter',
      payload: { sheetId, fileName: 'replacement.html', html: createImportedHtml('replacement') },
    })
    expect(storageSpy.put.mock.calls.map(([key]) => key)).toEqual([
      'room', `gm_sheet_html:${sheetId}`, `gm_sheet_compiled_html:${sheetId}`,
    ])
    expect(storageSpy.entries.get(`gm_sheet_html:${sheetId}`)).toContain('replacement')
    expect(storageSpy.list).not.toHaveBeenCalled()
  })

  it('delete removes only the target sheet HTML keys', async () => {
    const room = createRoom()
    room.gm_panel!.sheets = [createSheet('sheet-1'), createSheet('sheet-2')]
    room.gm_panel!.sheet_order = ['sheet-1', 'sheet-2']
    const storageSpy = createStorageSpy([
      ['gm_sheet_html:sheet-1', 'one'], ['gm_sheet_compiled_html:sheet-1', 'one compiled'],
      ['gm_sheet_html:sheet-2', 'two'], ['gm_sheet_compiled_html:sheet-2', 'two compiled'],
    ])
    const { durableObject } = createObject(storageSpy.storage, room)

    await applyRoomMessage(durableObject, { type: 'gm.deleteSheet', payload: { sheetId: 'sheet-1' } })

    expect(storageSpy.deleteEntry.mock.calls.map(([key]) => key)).toEqual([
      'gm_sheet_html:sheet-1', 'gm_sheet_compiled_html:sheet-1',
    ])
    expect(storageSpy.entries.get('gm_sheet_html:sheet-2')).toBe('two')
    expect(storageSpy.list).not.toHaveBeenCalled()
  })

  it('backup import synchronizes active HTML and removes stale source and compiled keys', async () => {
    const room = createRoom()
    const activeSheet = createGmSheetEntry('active.html', createImportedHtml('active'), 'active')
    const storageSpy = createStorageSpy([
      ['gm_sheet_html:stale', 'stale'], ['gm_sheet_compiled_html:stale', 'stale compiled'],
    ])
    const { durableObject } = createObject(storageSpy.storage, room)

    await applyRoomMessage(durableObject, {
      type: 'room.importRoomBackup', payload: { backup: {
        format: 'dhroom', version: 1,
        room: { id: room.room_id, name: room.room_name, room_type: 'gm-panel', invite_code: room.invite_code, created_at: room.created_at, expires_at: room.expires_at },
        settings: room.settings,
        gm_panel: { ...room.gm_panel!, sheets: [activeSheet], sheet_order: ['active'] },
        players: [], exported_at: room.updated_at,
      } },
    })

    expect(storageSpy.entries.get('gm_sheet_html:active')).toBe(activeSheet.source_html)
    expect(storageSpy.entries.get('gm_sheet_compiled_html:active')).toEqual(expect.any(String))
    expect(storageSpy.entries.has('gm_sheet_html:stale')).toBe(false)
    expect(storageSpy.entries.has('gm_sheet_compiled_html:stale')).toBe(false)
    expect(storageSpy.list.mock.calls).toEqual([
      [{ prefix: 'gm_sheet_html:' }], [{ prefix: 'gm_sheet_compiled_html:' }],
    ])
  })

  it.each([
    { operation: 'put' as const, key: 'gm_sheet_compiled_html:', type: 'gm.importHtmlCharacter', payload: { fileName: 'new.html', html: createImportedHtml('new') } },
    { operation: 'delete' as const, key: 'gm_sheet_compiled_html:sheet-1', type: 'gm.deleteSheet', payload: { sheetId: 'sheet-1' } },
  ])('rolls back room and HTML when $operation fails', async ({ operation, key, type, payload }) => {
    const room = createRoom()
    if (type === 'gm.deleteSheet') {
      room.gm_panel!.sheets = [createSheet('sheet-1')]
      room.gm_panel!.sheet_order = ['sheet-1']
    }
    const roomBeforeMutation = structuredClone(room)
    const storedRoom = structuredClone(room)
    if (storedRoom.gm_panel) {
      storedRoom.gm_panel.sheets = storedRoom.gm_panel.sheets.map(({ source_html: _s, compiled_html: _c, ...sheet }) => sheet)
    }
    const initial: Array<[string, unknown]> = [['room', storedRoom]]
    if (type === 'gm.deleteSheet') initial.push(['gm_sheet_html:sheet-1', 'source'], ['gm_sheet_compiled_html:sheet-1', 'compiled'])
    const error = new Error('transaction failure')
    const storageSpy = createStorageSpy(initial, { operation, matches: candidate => candidate.startsWith(key), error })
    const before = structuredClone(Array.from(storageSpy.entries.entries()))
    const { durableObject, sentMessages, socket } = createObject(storageSpy.storage, room)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      await handleRoomMessage(durableObject, socket, { type, requestId: 'request-1', payload })
      expect(Array.from(storageSpy.entries.entries())).toEqual(before)
      expect((durableObject as unknown as { room: RoomState }).room).toEqual(roomBeforeMutation)
      expect(sentMessages.map(message => JSON.parse(message))).toEqual([{
        type: 'error', requestId: 'request-1', payload: { code: 'INTERNAL_ERROR', message: error.message },
      }])
    } finally {
      consoleError.mockRestore()
    }
  })

  it('rolls back a backup sync when deleting stale compiled HTML fails', async () => {
    const room = createRoom()
    const storedRoom = structuredClone(room)
    const initial: Array<[string, unknown]> = [
      ['room', storedRoom],
      ['gm_sheet_html:stale', 'stale source'],
      ['gm_sheet_compiled_html:stale', 'stale compiled'],
    ]
    const error = new Error('stale delete failed')
    const storageSpy = createStorageSpy(initial, {
      operation: 'delete',
      matches: key => key === 'gm_sheet_compiled_html:stale',
      error,
    })
    const before = structuredClone(Array.from(storageSpy.entries.entries()))
    const { durableObject, sentMessages, socket } = createObject(storageSpy.storage, room)
    const activeSheet = createGmSheetEntry('active.html', createImportedHtml('active'), 'active')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      await handleRoomMessage(durableObject, socket, {
        type: 'room.importRoomBackup', requestId: 'backup-request', payload: { backup: {
          format: 'dhroom', version: 1,
          room: { id: room.room_id, name: room.room_name, room_type: 'gm-panel', invite_code: room.invite_code, created_at: room.created_at, expires_at: room.expires_at },
          settings: room.settings,
          gm_panel: { ...room.gm_panel!, sheets: [activeSheet], sheet_order: ['active'] },
          players: [], exported_at: room.updated_at,
        } },
      })

      expect(Array.from(storageSpy.entries.entries())).toEqual(before)
      expect(sentMessages.map(message => JSON.parse(message))).toEqual([{
        type: 'error', requestId: 'backup-request', payload: { code: 'INTERNAL_ERROR', message: error.message },
      }])
    } finally {
      consoleError.mockRestore()
    }
  })

  it('captures each queued snapshot immediately and continues after a rejected save', async () => {
    const snapshots: RoomState[] = []
    let attempts = 0
    const storage = {
      transaction: async (closure: (txn: DurableObjectTransaction) => Promise<void>) => closure({
        put: async (key: string, value: unknown) => {
          if (key !== 'room') return
          snapshots.push(structuredClone(value as RoomState))
          attempts += 1
          if (attempts === 1) throw new Error('first failed')
        },
        delete: async () => false,
      } as unknown as DurableObjectTransaction),
      put: async (key: string, value: unknown) => {
        if (key === 'room') snapshots.push(structuredClone(value as RoomState))
        attempts += 1
        if (attempts === 1) throw new Error('first failed')
      },
      list: async () => new Map(),
    } as unknown as DurableObjectStorage
    const { durableObject } = createObject(storage)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const first = (durableObject as unknown as { commit: (reason: string) => Promise<void> }).commit('first')
      const second = (durableObject as unknown as { commit: (reason: string) => Promise<void> }).commit('second')
      await expect(first).rejects.toThrow('first failed')
      await expect(second).resolves.toBeUndefined()
      expect(snapshots.map(snapshot => snapshot.snapshot_version)).toEqual([2, 3])
    } finally {
      consoleError.mockRestore()
    }
  })

  it('hydrates independently stored HTML after reload and exports compiled HTML', async () => {
    const room = createRoom()
    const sheet = createSheet('sheet-1')
    const sourceHtml = createImportedHtml('hydrated')
    room.gm_panel!.sheets = [{ ...sheet, source_html: undefined, compiled_html: undefined }]
    room.gm_panel!.sheet_order = ['sheet-1']
    const storageSpy = createStorageSpy([
      ['room', room],
      ['gm_sheet_html:sheet-1', sourceHtml],
      ['gm_sheet_compiled_html:sheet-1', '<html>stored compiled</html>'],
    ])
    const ctx = {
      storage: storageSpy.storage,
      getWebSockets: () => [],
    } as unknown as DurableObjectState
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)

    const response = await durableObject.fetch(new Request('https://example.test/internal/sheets/sheet-1/html'))

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('hydrated')
    const hydrated = (durableObject as unknown as { room: RoomState }).room.gm_panel!.sheets[0]
    expect(hydrated.source_html).toBe(sourceHtml)
    expect(hydrated.compiled_html).toContain('hydrated')
  })
})

describe('RoomDurableObject commit latency', () => {
  it('broadcasts a single dice roll before waiting for storage persistence', async () => {
    const storagePut = new Deferred<void>()
    const waitUntilPromises: Promise<unknown>[] = []
    const sentMessages: string[] = []
    let persistedSnapshot: RoomState | undefined

    const ctx = {
      storage: {
        put: () => storagePut.promise,
        list: async () => new Map<string, string>(),
        transaction: (closure: (txn: DurableObjectTransaction) => Promise<unknown>) => closure({
          put: (_key: string, value: unknown) => {
            persistedSnapshot = structuredClone(value as RoomState)
            return storagePut.promise
          },
        } as unknown as DurableObjectTransaction),
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
      expect(persistedSnapshot?.snapshot_version).toBe(message.payload.snapshot_version)
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
        transaction: (closure: (txn: DurableObjectTransaction) => Promise<unknown>) => closure({
          put: async () => undefined,
        } as unknown as DurableObjectTransaction),
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
        transaction: (closure: (txn: DurableObjectTransaction) => Promise<unknown>) => closure({
          put: async () => undefined,
        } as unknown as DurableObjectTransaction),
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
