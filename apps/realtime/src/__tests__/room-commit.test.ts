import { describe, expect, it, vi } from 'vitest'
import {
  createGmSheetEntry,
  DRAWING_BOARD_COLORS,
  normalizeResourceTrackerSheet,
} from '../../../../packages/shared/src/index'
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
    expires_at: '2027-07-06T00:00:00.000Z',
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

function createSheet(
  id: string,
  sourceHtml = `<html>source-${id}</html>`,
  compiledHtml: string | null = `<html>compiled-${id}</html>`,
) {
  const timestamp = '2026-07-05T00:00:00.000Z'
  const sheet = createGmSheetEntry(`${id}.html`, {}, id, timestamp, timestamp, timestamp)
  sheet.source_html = sourceHtml
  sheet.compiled_html = compiledHtml ?? undefined
  sheet.parsed_sheet.character_name = id
  return sheet
}

function createStorageSpy(initialEntries: Array<[string, unknown]> = []) {
  const entries = new Map<string, unknown>(initialEntries)
  const put = vi.fn(async (key: string, value: unknown) => {
    entries.set(key, structuredClone(value))
  })
  const list = vi.fn(async ({ prefix }: { prefix?: string } = {}) => new Map(
    Array.from(entries.entries()).filter(([key]) => !prefix || key.startsWith(prefix)),
  ))
  const deleteEntry = vi.fn(async (key: string) => {
    entries.delete(key)
  })

  return {
    entries,
    storage: {
      get: async <T>(key: string) => entries.get(key) as T | undefined,
      put,
      list,
      delete: deleteEntry,
    } as unknown as DurableObjectStorage,
    put,
    list,
    deleteEntry,
  }
}

function createImportedHtml(marker: string): string {
  return `<!doctype html>
<html data-version="1.0" data-exporter="daggerheart-character-sheet">
<head><meta name="generator" content="Daggerheart Character Sheet Exporter v1.0"></head>
<body>${marker}</body>
<script>window.characterData = { characterName: ${JSON.stringify(marker)} };</script>
</html>`
}

async function applyRoomMessage(durableObject: RoomDurableObject, message: unknown): Promise<void> {
  await (durableObject as unknown as {
    applyMessage: (session: { playerId: string; nickname: string }, message: unknown, socket: WebSocket) => Promise<void>
  }).applyMessage({ playerId: 'player-1', nickname: 'Host' }, message, {} as WebSocket)
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
    } as unknown as DurableObjectState

    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)
    ;(durableObject as unknown as { room: RoomState | null }).room = createRoom()
    ;(durableObject as unknown as { sockets: Map<WebSocket, unknown> }).sockets = new Map([
      [{ send: (message: string) => sentMessages.push(message) } as unknown as WebSocket, {}],
    ])

    const commitPromise = (durableObject as unknown as {
      commit: (reason: string, patch: unknown, options: { waitForPersistence: boolean }) => Promise<void>
    }).commit('dice.roll', { kind: 'dice.history', diceRolls: [] }, { waitForPersistence: false })

    await Promise.resolve()

    try {
      expect(sentMessages).toHaveLength(1)
      expect(JSON.parse(sentMessages[0])).toMatchObject({
        type: 'room.patch',
        payload: { kind: 'dice.history', reason: 'dice.roll', snapshot_version: 2, version: 2 },
      })
      expect(waitUntilPromises).toHaveLength(1)
    } finally {
      storagePut.resolve()
      await commitPromise
    }

    await Promise.all(waitUntilPromises)
  })

  it('ordinary commits persist only a stripped room snapshot without touching HTML storage', async () => {
    const storageSpy = createStorageSpy()
    const durableObject = new RoomDurableObject({ storage: storageSpy.storage } as DurableObjectState, { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()
    room.gm_panel!.sheets = [createSheet('sheet-1')]
    room.gm_panel!.sheet_order = ['sheet-1']
    ;(durableObject as unknown as { room: RoomState | null }).room = room

    await (durableObject as unknown as {
      commit: (reason: string, patch: unknown) => Promise<void>
    }).commit('gm.updateFear', { kind: 'gm.fear' })

    expect(storageSpy.put).toHaveBeenCalledTimes(1)
    expect(storageSpy.put.mock.calls[0][0]).toBe('room')
    expect(storageSpy.put.mock.calls[0][1]).not.toHaveProperty('gm_panel.sheets.0.source_html')
    expect(storageSpy.put.mock.calls[0][1]).not.toHaveProperty('gm_panel.sheets.0.compiled_html')
    expect(storageSpy.list).not.toHaveBeenCalled()
    expect(storageSpy.deleteEntry).not.toHaveBeenCalled()
  })

  it('dirty-sheet commits upsert only that sheet source and compiled HTML without listing storage', async () => {
    const storageSpy = createStorageSpy()
    const durableObject = new RoomDurableObject({ storage: storageSpy.storage } as DurableObjectState, { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()
    room.gm_panel!.sheets = [createSheet('sheet-1'), createSheet('sheet-2')]
    room.gm_panel!.sheet_order = ['sheet-1', 'sheet-2']
    ;(durableObject as unknown as { room: RoomState | null }).room = room

    await (durableObject as unknown as {
      commit: (reason: string, patch: unknown, options: unknown) => Promise<void>
    }).commit('gm.replaceHtmlCharacter', { kind: 'gm.sheet' }, {
      htmlPersistence: { mode: 'upsert', sheetIds: ['sheet-2'] },
    })

    expect(storageSpy.put.mock.calls.map(([key]) => key)).toEqual([
      'room',
      'gm_sheet_html:sheet-2',
      'gm_sheet_compiled_html:sheet-2',
    ])
    expect(storageSpy.entries.get('gm_sheet_html:sheet-2')).toBe('<html>source-sheet-2</html>')
    expect(storageSpy.entries.get('gm_sheet_compiled_html:sheet-2')).toBe('<html>compiled-sheet-2</html>')
    expect(storageSpy.list).not.toHaveBeenCalled()
  })

  it('deleted-sheet commits remove both exact HTML keys without listing storage', async () => {
    const storageSpy = createStorageSpy([
      ['gm_sheet_html:sheet-1', '<html>old source</html>'],
      ['gm_sheet_compiled_html:sheet-1', '<html>old compiled</html>'],
      ['gm_sheet_html:sheet-2', '<html>keep source</html>'],
      ['gm_sheet_compiled_html:sheet-2', '<html>keep compiled</html>'],
    ])
    const durableObject = new RoomDurableObject({ storage: storageSpy.storage } as DurableObjectState, { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()
    room.expires_at = '2099-07-06T00:00:00.000Z'
    room.gm_panel!.sheets = [createSheet('sheet-1'), createSheet('sheet-2')]
    room.gm_panel!.sheet_order = ['sheet-1', 'sheet-2']
    ;(durableObject as unknown as { room: RoomState | null }).room = room

    await applyRoomMessage(durableObject, {
      type: 'gm.deleteSheet',
      payload: { sheetId: 'sheet-1' },
    })

    expect(storageSpy.deleteEntry.mock.calls.map(([key]) => key)).toEqual([
      'gm_sheet_html:sheet-1',
      'gm_sheet_compiled_html:sheet-1',
    ])
    expect(storageSpy.entries.get('gm_sheet_html:sheet-2')).toBe('<html>keep source</html>')
    expect(storageSpy.entries.get('gm_sheet_compiled_html:sheet-2')).toBe('<html>keep compiled</html>')
    expect(storageSpy.list).not.toHaveBeenCalled()
  })

  it('dirty-sheet commits delete a missing compiled HTML value while preserving the source HTML', async () => {
    const storageSpy = createStorageSpy([
      ['gm_sheet_html:sheet-1', '<html>old source</html>'],
      ['gm_sheet_compiled_html:sheet-1', '<html>old compiled</html>'],
    ])
    const durableObject = new RoomDurableObject({ storage: storageSpy.storage } as DurableObjectState, { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()
    room.gm_panel!.sheets = [createSheet('sheet-1', '<html>new source</html>', null)]
    room.gm_panel!.sheet_order = ['sheet-1']
    ;(durableObject as unknown as { room: RoomState | null }).room = room

    await (durableObject as unknown as {
      commit: (reason: string, patch: unknown, options: unknown) => Promise<void>
    }).commit('gm.replaceHtmlCharacter', { kind: 'gm.sheet' }, {
      htmlPersistence: { mode: 'upsert', sheetIds: ['sheet-1'] },
    })

    expect(storageSpy.entries.get('gm_sheet_html:sheet-1')).toBe('<html>new source</html>')
    expect(storageSpy.entries.has('gm_sheet_compiled_html:sheet-1')).toBe(false)
    expect(storageSpy.deleteEntry).toHaveBeenCalledWith('gm_sheet_compiled_html:sheet-1')
    expect(storageSpy.list).not.toHaveBeenCalled()
  })

  it('full HTML sync writes active sheets and removes stale source and compiled keys', async () => {
    const storageSpy = createStorageSpy([
      ['gm_sheet_html:stale', '<html>stale source</html>'],
      ['gm_sheet_compiled_html:stale', '<html>stale compiled</html>'],
    ])
    const durableObject = new RoomDurableObject({ storage: storageSpy.storage } as DurableObjectState, { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()
    room.expires_at = '2099-07-06T00:00:00.000Z'
    ;(durableObject as unknown as { room: RoomState | null }).room = room
    const activeSheet = createGmSheetEntry('active.html', createImportedHtml('active'), 'active')

    await applyRoomMessage(durableObject, {
      type: 'room.importRoomBackup',
      payload: {
        backup: {
          format: 'dhroom',
          version: 1,
          room: {
            id: room.room_id,
            name: 'Imported room',
            room_type: 'gm-panel',
            invite_code: room.invite_code,
            created_at: room.created_at,
            expires_at: room.expires_at,
          },
          settings: room.settings,
          gm_panel: {
            ...room.gm_panel,
            sheets: [activeSheet],
            sheet_order: ['active'],
          },
          players: [],
          exported_at: '2026-07-05T00:00:00.000Z',
        },
      },
    })

    expect(storageSpy.entries.get('gm_sheet_html:active')).toBe(activeSheet.source_html)
    expect(storageSpy.entries.get('gm_sheet_compiled_html:active')).toEqual(expect.any(String))
    expect(storageSpy.entries.has('gm_sheet_html:stale')).toBe(false)
    expect(storageSpy.entries.has('gm_sheet_compiled_html:stale')).toBe(false)
    expect(storageSpy.list.mock.calls).toEqual([
      [{ prefix: 'gm_sheet_html:' }],
      [{ prefix: 'gm_sheet_compiled_html:' }],
    ])
  })

  it('the HTML import message persists the newly-created sheet keys without a prefix scan', async () => {
    const storageSpy = createStorageSpy()
    const durableObject = new RoomDurableObject({ storage: storageSpy.storage } as DurableObjectState, { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()
    room.expires_at = '2099-07-06T00:00:00.000Z'
    ;(durableObject as unknown as { room: RoomState | null }).room = room

    await applyRoomMessage(
      durableObject,
      { type: 'gm.importHtmlCharacter', payload: { fileName: 'new.html', html: createImportedHtml('new') } },
    )

    const importedSheet = room.gm_panel!.sheets[0]
    expect(storageSpy.entries.get(`gm_sheet_html:${importedSheet.id}`)).toBe(importedSheet.source_html)
    expect(storageSpy.entries.get(`gm_sheet_compiled_html:${importedSheet.id}`)).toBe(importedSheet.compiled_html)
    expect(storageSpy.list).not.toHaveBeenCalled()
  })

  it('the HTML replacement message overwrites both existing HTML keys without a prefix scan', async () => {
    const existingSheet = createGmSheetEntry('old.html', createImportedHtml('old'), 'sheet-1')
    const storageSpy = createStorageSpy([
      ['gm_sheet_html:sheet-1', existingSheet.source_html],
      ['gm_sheet_compiled_html:sheet-1', existingSheet.compiled_html],
    ])
    const durableObject = new RoomDurableObject({ storage: storageSpy.storage } as DurableObjectState, { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()
    room.expires_at = '2099-07-06T00:00:00.000Z'
    room.gm_panel!.sheets = [existingSheet]
    room.gm_panel!.sheet_order = ['sheet-1']
    ;(durableObject as unknown as { room: RoomState | null }).room = room

    await applyRoomMessage(
      durableObject,
      {
        type: 'gm.replaceHtmlCharacter',
        payload: { sheetId: 'sheet-1', fileName: 'replacement.html', html: createImportedHtml('replacement') },
      },
    )

    expect(storageSpy.entries.get('gm_sheet_html:sheet-1')).toBe(room.gm_panel!.sheets[0].source_html)
    expect(storageSpy.entries.get('gm_sheet_html:sheet-1')).toContain('replacement')
    expect(storageSpy.entries.get('gm_sheet_compiled_html:sheet-1')).toBe(room.gm_panel!.sheets[0].compiled_html)
    expect(storageSpy.list).not.toHaveBeenCalled()
  })
})

describe('RoomDurableObject incremental patches', () => {
  it('broadcasts a compact authoritative patch for a GM resource update', async () => {
    const sentMessages: string[] = []
    const room = createRoom()
    const sheet = {
      id: 'sheet-1',
      imported_at: '2026-07-05T00:00:00.000Z',
      updated_at: '2026-07-05T00:00:00.000Z',
      html_updated_at: '2026-07-05T00:00:00.000Z',
      source_file_name: 'character.html',
      source_format: 'mydhcharsheet-html' as const,
      raw_character_data: {},
      parsed_sheet: normalizeResourceTrackerSheet({} as never, 'character.html'),
    }
    sheet.parsed_sheet.resources.hope = 1
    room.gm_panel!.sheets.push(sheet)
    room.gm_panel!.sheet_order.push(sheet.id)

    const ctx = {
      storage: {
        put: async () => undefined,
        list: async () => new Map<string, string>(),
        delete: async () => undefined,
      },
      waitUntil: () => undefined,
    } as unknown as DurableObjectState
    const socket = { send: (message: string) => sentMessages.push(message) } as unknown as WebSocket
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)
    ;(durableObject as unknown as { room: RoomState | null }).room = room
    ;(durableObject as unknown as { sockets: Map<WebSocket, unknown> }).sockets = new Map([
      [socket, { playerId: 'player-1', nickname: 'Host' }],
    ])

    await (durableObject as unknown as {
      handleMessage: (socket: WebSocket, data: string) => Promise<void>
    }).handleMessage(socket, JSON.stringify({
      type: 'gm.updateResource',
      requestId: 'request-1',
      payload: { sheetId: 'sheet-1', resourceKey: 'hope', nextValue: 2 },
    }))

    const messages = sentMessages.map((message) => JSON.parse(message))
    const patch = messages.find((message) => message.type === 'room.patch')
    expect(patch).toEqual({
      type: 'room.patch',
      payload: expect.objectContaining({
        kind: 'gm.resource',
        reason: 'gm.updateResource',
        sheetId: 'sheet-1',
        resourceKey: 'hope',
        value: 2,
        snapshot_version: 2,
        version: 2,
      }),
    })
    expect(patch.payload).not.toHaveProperty('state')
    expect(JSON.stringify(patch)).not.toContain('room_name')
    expect(messages).not.toContainEqual(expect.objectContaining({ type: 'room.updated' }))
    expect(messages).toContainEqual({
      type: 'ack',
      requestId: 'request-1',
      payload: { ok: true, snapshot_version: 2, version: 2 },
    })
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
