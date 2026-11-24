import { env, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { MAP_DATA_BYTES, MAP_STROKE_POINTS, summaryFromSheet, utf8Bytes, type CharacterSheetJson, type MapStroke, type RoomEvent, type RoomServerMessage, type RoomSnapshot } from '@dhgc/shared/desktop'
import daggerheart from '../../../../packages/shared/src/__tests__/fixtures/daggerheart-sheet.json'
import { signRoomV2Session } from '../room-v2-session'
import { roomOwnerKeyHash } from '../room-owner-key'
import { routeRoomV2 } from '../room-v2-http'
import { RoomV2Commands } from '../room-v2-commands'
import { RoomV2Storage, type StoredMeta } from '../room-v2-storage'
import type { RoomV2DurableObject } from '../room-v2'

function meta(inviteCode: string): StoredMeta {
  return {
    roomId: `room-${inviteCode}`,
    name: 'workerd integration',
    inviteCode,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    players: [{ id: 'player-a', nickname: '甲' }, { id: 'player-b', nickname: '乙' }],
    protocolVersion: 2,
  }
}

async function createRoom(inviteCode: string) {
  const stub = env.ROOMS_V2.getByName(inviteCode)
  const room = meta(inviteCode)
  const response = await stub.fetch(new Request('https://room-v2.internal/internal/v2/create', { method: 'POST', body: JSON.stringify(room) }))
  expect(response.status).toBe(200)
  await response.arrayBuffer()
  return { stub, room }
}

async function socketFor(stub: DurableObjectStub<RoomV2DurableObject>, room: StoredMeta, player: StoredMeta['players'][number], authorization?: string): Promise<WebSocket> {
  const token = await signRoomV2Session(env.SESSION_SECRET, { roomId: room.roomId, inviteCode: room.inviteCode, playerId: player.id, nickname: player.nickname })
  const headers = new Headers({ Upgrade: 'websocket' })
  if (authorization) headers.set('Authorization', authorization)
  const response = await stub.fetch(new Request(`https://room-v2.internal/internal/v2/ws?token=${token}`, { headers }))
  expect(response.status).toBe(101)
  const socket = response.webSocket
  expect(socket).not.toBeNull()
  socket!.accept()
  return socket!
}

function nextRoll(socket: WebSocket): Promise<Extract<RoomEvent, { type: 'dice.rolled' }>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('timed out waiting for dice.rolled')), 5_000)
    socket.addEventListener('message', message => {
      const value = JSON.parse(String(message.data)) as RoomEvent
      if (value.type === 'dice.rolled') { clearTimeout(timeout); resolve(value) }
    })
  })
}

function nextPresence(socket: WebSocket): Promise<{ members: Array<{ id: string; online: boolean }> }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.removeEventListener('message', onMessage); reject(new Error('timed out waiting for room.presence')) }, 5_000)
    const onMessage = (message: MessageEvent) => {
      const value = JSON.parse(String(message.data)) as { type: string; members: Array<{ id: string; online: boolean }> }
      if (value.type !== 'room.presence') return
      clearTimeout(timeout)
      socket.removeEventListener('message', onMessage)
      resolve(value)
    }
    socket.addEventListener('message', onMessage)
  })
}

function nextMessage<T extends RoomServerMessage['type']>(socket: WebSocket, type: T, requestId?: string): Promise<Extract<RoomServerMessage, { type: T }>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener('message', listener)
      reject(new Error(`Timed out waiting for ${type}`))
    }, 3000)
    const listener = (message: MessageEvent) => {
      const parsed = JSON.parse(String(message.data)) as Extract<RoomServerMessage, { type: T }>
      if (parsed.type !== type || (requestId && (!('requestId' in parsed) || parsed.requestId !== requestId))) return
      clearTimeout(timeout)
      socket.removeEventListener('message', listener)
      resolve(parsed)
    }
    socket.addEventListener('message', listener)
  })
}

describe('Room V2 workerd integration', () => {
  it('shares durable action logs between members and restores the focused JSON backup', async () => {
    const { stub, room } = await createRoom('WRKLOG')
    const a = await socketFor(stub, room, room.players[0])
    const b = await socketFor(stub, room, room.players[1])
    const send = async (socket: WebSocket, requestId: string, operation: object) => {
      const ack = nextMessage(socket, 'operation.ack', requestId)
      socket.send(JSON.stringify({ protocolVersion: 2, requestId, ...operation }))
      return ack
    }
    const snapshot = async (socket: WebSocket) => {
      const received = nextMessage(socket, 'room.snapshot')
      socket.send(JSON.stringify({ type: 'room.sync', protocolVersion: 2, afterSeq: 0, pendingRequestIds: [] }))
      return (await received).room
    }
    try {
      await runInDurableObject(stub, async (_, state) => {
        const commands = new RoomV2Commands(new RoomV2Storage(state.storage), () => undefined)
        await commands.replace('delivery', 'deliver-log', daggerheart as CharacterSheetJson)
      })
      const initial = await snapshot(a)
      const character = initial.characters[0]
      const observed = nextMessage(b, 'character.resourcesChanged', 'log-resource')
      await send(a, 'log-resource', { type: 'character.setMark', name: character.name, generation: character.generation, resource: 'hp', index: 0, marked: true })
      expect((await observed).log).toMatchObject({ actorId: 'player-a', actorName: '甲', text: expect.stringContaining('标记生命') })
      await Promise.all([
        send(a, 'log-fear', { type: 'room.adjustFear', delta: 1 }),
        send(b, 'log-clock', { type: 'clock.create', id: 'reinforcements', name: '援军', max: 6, value: 2 }),
      ])
      const custom = { type: 'room.appendLog', text: '巨龙攻击：未命中', tag: '战斗' }
      const combatEvent = nextMessage(a, 'room.logAppended', 'log-combat')
      await send(b, 'log-combat', custom)
      expect((await combatEvent).entry).toMatchObject({ actorId: 'player-b', actorName: '乙', text: custom.text })
      await send(b, 'log-combat', custom)
      const left = await snapshot(a)
      const right = await snapshot(b)
      expect(left.roomLog).toEqual(right.roomLog)
      expect(left.roomLog).toHaveLength(5)
      await runInDurableObject(stub, async (_, state) => {
        const db = new RoomV2Storage(state.storage)
        expect(db.roomLog()).toEqual(left.roomLog)
        state.storage.sql.exec("CREATE TRIGGER fail_log_receipt BEFORE INSERT ON panel_v2_receipts WHEN NEW.request_id = 'log-rollback' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END")
      })
      const failure = nextMessage(a, 'operation.error', 'log-rollback')
      a.send(JSON.stringify({ type: 'room.adjustFear', protocolVersion: 2, requestId: 'log-rollback', delta: 1 }))
      expect(await failure).toMatchObject({ code: 'PERSISTENCE_FAILED' })
      expect((await snapshot(a)).roomLog).toEqual(left.roomLog)
      expect((await snapshot(a)).fear.value).toBe(1)

      const authorization = `Bearer ${await signRoomV2Session(env.SESSION_SECRET, { roomId: room.roomId, inviteCode: room.inviteCode, playerId: 'player-a', nickname: '甲' })}`
      const backup = await (await stub.fetch(new Request('https://room-v2.internal/internal/v2/export', { headers: { Authorization: authorization } }))).json() as { room: Record<string, unknown>; characters: unknown[] }
      expect(Object.keys(backup.room).sort()).toEqual(['characters', 'clocks', 'fear', 'name'])
      expect(backup.characters).toHaveLength(1)
      const restored = await routeRoomV2(new Request('https://worker.test/api/v2/rooms/restore', { method: 'POST', body: JSON.stringify({ nickname: '恢复', backup }) }), env)
      expect(restored?.status).toBe(200)
      expect(await restored?.json()).toMatchObject({ room: {
        characters: [{ name: character.name, resources: { hp: [true, ...character.resources.hp.slice(1)] } }],
        fear: { value: 1 }, clocks: [{ id: 'reinforcements', name: '援军', max: 6, value: 2 }], dice: [], roomLog: [], xCard: { active: false },
      } })
      const cleared = nextMessage(a, 'room.logCleared', 'log-clear')
      await send(b, 'log-clear', { type: 'room.clearLog' })
      await cleared
      expect((await snapshot(a)).roomLog).toEqual([])
      expect((await snapshot(b)).roomLog).toEqual([])
    } finally { a.close(); b.close() }
  })
  it('commits map edits once, rolls back failed receipts, and accepts legacy map backups', async () => {
    const { stub, room } = await createRoom('WRK014')
    const a = await socketFor(stub, room, room.players[0])
    const b = await socketFor(stub, room, room.players[1])
    const legacy = await socketFor(stub, room, room.players[1])
    try {
      const sync = { type: 'room.sync', protocolVersion: 2, mapEvents: true, afterSeq: 0, pendingRequestIds: [] }
      for (const socket of [a, b]) {
        const snapshot = nextMessage(socket, 'room.snapshot')
        socket.send(JSON.stringify(sync))
        expect((await snapshot).room.map).toEqual({ tokens: [], strokes: [] })
      }
      const send = (socket: WebSocket, requestId: string, operation: object) => {
        const ack = nextMessage(socket, 'operation.ack', requestId)
        socket.send(JSON.stringify({ protocolVersion: 2, requestId, ...operation }))
        return ack
      }
      const token = { id: 'same-cell', image: 'hero', name: '队长', labelColor: '#263950', x: 4, y: 6 }
      const legacySnapshot = nextMessage(legacy, 'room.snapshot')
      const created = await send(a, 'token-add', { type: 'map.token.create', token })
      expect((await legacySnapshot).room).toMatchObject({ seq: created.seq })
      expect((await legacySnapshot).room.map).toBeUndefined()
      await Promise.all([
        send(a, 'token-move', { type: 'map.token.update', id: token.id, patch: { x: 12, y: 8 } }),
        send(b, 'token-name', { type: 'map.token.update', id: token.id, patch: { name: '领队', labelColor: '#833614' } }),
      ])
      const resized = nextMessage(b, 'map.token.changed', 'token-size')
      const resizeCommand = { type: 'map.token.update', id: token.id, patch: { size: 3 } }
      const resizeAck = await send(a, 'token-size', resizeCommand)
      expect(await resized).toMatchObject({ token: { id: token.id, size: 3 } })
      expect(await send(a, 'token-size', resizeCommand)).toEqual(resizeAck)
      const atEdge = nextMessage(b, 'map.token.changed', 'token-edge')
      await send(a, 'token-edge', { type: 'map.token.update', id: token.id, patch: { x: 39, y: 39 } })
      expect(await atEdge).toMatchObject({ token: { size: 3, x: 37, y: 37 } })
      await send(a, 'token-back', { type: 'map.token.update', id: token.id, patch: { x: 12, y: 8 } })
      const stroke: MapStroke = { id: 'first-stroke', color: '#263950', width: 0.16, points: [[2, 3], [4, 5], [2, 7]] }
      const added = nextMessage(b, 'map.stroke.added', 'stroke-add')
      const first = await send(a, 'stroke-add', { type: 'map.stroke.add', stroke })
      expect(await added).toMatchObject({ stroke })
      expect(await send(a, 'stroke-add', { type: 'map.stroke.add', stroke })).toEqual(first)
      const recovered = nextMessage(a, 'room.snapshot')
      a.send(JSON.stringify({ ...sync, pendingRequestIds: ['stroke-add'] }))
      expect(await recovered).toMatchObject({ receipts: [first], room: { map: { tokens: [{ ...token, name: '领队', x: 12, y: 8, labelColor: '#833614', size: 3 }], strokes: [stroke] } } })

      const authorization = `Bearer ${await signRoomV2Session(env.SESSION_SECRET, { roomId: room.roomId, inviteCode: room.inviteCode, playerId: room.players[0].id, nickname: room.players[0].nickname })}`
      const exported = await stub.fetch(new Request('https://room-v2.internal/internal/v2/export', { headers: { Authorization: authorization } }))
      const backup = await exported.json() as { room: RoomSnapshot['room'] }
      const restore = (backup: unknown) => routeRoomV2(new Request('https://worker.test/api/v2/rooms/restore', {
        method: 'POST', body: JSON.stringify({ nickname: '恢复', backup }),
      }), env)
      const restored = await restore(backup)
      expect(restored?.status).toBe(200)
      expect(await restored?.json()).toMatchObject({ room: { map: { tokens: [], strokes: [] } } })
      expect(backup.room).not.toHaveProperty('map')
      const legacyMap = { tokens: [{ ...token, name: '领队', x: 12, y: 8, labelColor: '#833614', size: 3 }], strokes: [stroke] }
      expect(await (await restore({ ...backup, room: { ...backup.room, map: legacyMap } }))?.json()).toMatchObject({ room: { map: legacyMap } })
      const oldRoom = backup.room
      expect(await (await restore({ ...backup, room: oldRoom }))?.json()).toMatchObject({ room: { map: { tokens: [], strokes: [] } } })

      await runInDurableObject(stub, async (_, state) => {
        state.storage.sql.exec("CREATE TRIGGER fail_map_receipt BEFORE INSERT ON panel_v2_receipts WHEN NEW.request_id = 'map-rollback' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END")
      })
      const failure = nextMessage(a, 'operation.error', 'map-rollback')
      a.send(JSON.stringify({ type: 'map.stroke.add', protocolVersion: 2, requestId: 'map-rollback', stroke: { ...stroke, id: 'not-committed' } }))
      expect(await failure).toMatchObject({ code: 'PERSISTENCE_FAILED' })
      await runInDurableObject(stub, async (_, state) => {
        const db = new RoomV2Storage(state.storage)
        expect(db.mapHasStroke('not-committed')).toBe(false)
        expect(db.metaRow()?.seq).toBe((await recovered).room.seq)
        expect(db.receipt(room.players[0].id, 'map-rollback')).toBeNull()
      })
      const invalid = nextMessage(a, 'operation.error', 'too-many-points')
      a.send(JSON.stringify({ type: 'map.stroke.add', protocolVersion: 2, requestId: 'too-many-points', stroke: { ...stroke, points: Array(MAP_STROKE_POINTS + 1).fill([1, 1]) } }))
      expect(await invalid).toMatchObject({ code: 'INVALID_COMMAND' })
      const removed = await send(b, 'stroke-delete', { type: 'map.stroke.delete', id: stroke.id })
      expect(await send(a, 'stroke-delete-again', { type: 'map.stroke.delete', id: stroke.id })).toMatchObject({ seq: removed.seq })
      await send(b, 'token-delete', { type: 'map.token.delete', id: token.id })
      await send(a, 'late-move', { type: 'map.token.update', id: token.id, patch: { x: 2, y: 4 } })
      const final = nextMessage(b, 'room.snapshot')
      b.send(JSON.stringify(sync))
      expect((await final).room.map).toEqual({ tokens: [], strokes: [] })
    } finally {
      a.close()
      b.close()
      legacy.close()
    }
  })

  it('enforces the combined map byte limit at commit and allows edits again after erasure', async () => {
    const { stub, room } = await createRoom('WRK015')
    const template: MapStroke = {
      id: 'capacity', color: '#233954', width: 0.16,
      points: Array.from({ length: MAP_STROKE_POINTS }, (_, index) => [+(index * 0.071).toFixed(2), +(12 + index % 59 * 0.247).toFixed(2)]),
    }
    await runInDurableObject(stub, async (_, state) => {
      const db = new RoomV2Storage(state.storage)
      let bytes = 0
      for (let index = 0; ; index++) {
        const stroke = { ...template, id: `filled-${index}` }
        const size = utf8Bytes(JSON.stringify(stroke))
        if (bytes + size > MAP_DATA_BYTES) break
        expect(db.transaction(() => db.saveMapItem('stroke', stroke))).toBe(true)
        bytes += size
      }
      expect(bytes).toBeGreaterThan(MAP_DATA_BYTES * 0.98)
    })
    const socket = await socketFor(stub, room, room.players[0])
    try {
      const add = { protocolVersion: 2, type: 'map.stroke.add', requestId: 'capacity', stroke: template }
      const rejected = nextMessage(socket, 'operation.error', add.requestId)
      socket.send(JSON.stringify(add))
      expect(await rejected).toMatchObject({ code: 'INVALID_COMMAND', message: expect.stringContaining('容量上限') })
      const removed = nextMessage(socket, 'operation.ack', 'free-space')
      socket.send(JSON.stringify({ protocolVersion: 2, type: 'map.stroke.delete', requestId: 'free-space', id: 'filled-0' }))
      expect((await removed).seq).toBe(1)
      const added = nextMessage(socket, 'operation.ack', add.requestId)
      socket.send(JSON.stringify(add))
      expect((await added).seq).toBe(2)
    } finally {
      socket.close()
    }
  })

  it('migrates existing receipt tables without losing their retry records', async () => {
    const { stub } = await createRoom('WRK013')
    await runInDurableObject(stub, async (_, state) => {
      state.storage.sql.exec('DROP TABLE panel_v2_receipts')
      state.storage.sql.exec('CREATE TABLE panel_v2_receipts (actor TEXT NOT NULL, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL, seq INTEGER NOT NULL, result_json TEXT NOT NULL, PRIMARY KEY (actor, request_id))')
      state.storage.sql.exec('INSERT INTO panel_v2_receipts (actor, request_id, payload_hash, seq, result_json) VALUES (?, ?, ?, ?, ?)', 'player-a', 'legacy-request', 'hash', 1, '{}')
      const db = new RoomV2Storage(state.storage)
      db.initialize()
      expect(db.receipt('player-a', 'legacy-request')).not.toBeNull()
      expect(state.storage.sql.exec<{ created_at_ms: number }>('SELECT created_at_ms FROM panel_v2_receipts WHERE request_id = ?', 'legacy-request').one().created_at_ms).toBe(0)
    })
  })

  it('prunes expired receipts while retaining recent and newly migrated receipts', async () => {
    const { stub } = await createRoom('WRK012')
    await runInDurableObject(stub, async (_, state) => {
      const db = new RoomV2Storage(state.storage)
      const now = Date.now()
      const day = 24 * 60 * 60 * 1000
      const add = (id: string, createdAtMs: number) => state.storage.sql.exec(
        'INSERT INTO panel_v2_receipts (actor, request_id, payload_hash, seq, result_json, created_at_ms) VALUES (?, ?, ?, 1, ?, ?)',
        'player-a', id, 'hash', '{}', createdAtMs,
      )
      add('expired', now - 32 * day)
      add('recent', now - day)
      add('legacy', 0)
      db.saveReceipt('player-a', 'trigger', 'hash', 2, {})
      expect(db.receipt('player-a', 'expired')).toBeNull()
      expect(db.receipt('player-a', 'legacy')).not.toBeNull()
      expect(db.receipt('player-a', 'recent')).not.toBeNull()
      state.storage.sql.exec('UPDATE panel_v2_receipt_gc SET legacy_epoch_ms = ?, last_pruned_at_ms = 0 WHERE id = 1', now - 32 * day)
      db.saveReceipt('player-a', 'next-trigger', 'hash', 3, {})
      expect(db.receipt('player-a', 'legacy')).toBeNull()
      expect(db.receipt('player-a', 'recent')).not.toBeNull()
    })
  })

  it('does not persist repeat joins and keeps signed sessions usable', async () => {
    const { stub, room } = await createRoom('WRK010')
    let lastPlayer: StoredMeta['players'][number] | undefined
    for (let index = 0; index < 16; index++) {
      const response = await stub.fetch(new Request('https://room-v2.internal/internal/v2/join', {
        method: 'POST', body: JSON.stringify({ playerId: `returning-${index}`, nickname: '重复加入的玩家' }),
      }))
      expect(response.status).toBe(200)
      lastPlayer = (await response.json() as { player: StoredMeta['players'][number] }).player
    }
    await runInDurableObject(stub, async (_, state) => {
      expect(new RoomV2Storage(state.storage).meta()?.players).toEqual([room.players[0]])
    })
    const socket = await socketFor(stub, room, lastPlayer!)
    const token = await signRoomV2Session(env.SESSION_SECRET, {
      roomId: room.roomId, inviteCode: room.inviteCode, playerId: lastPlayer!.id, nickname: lastPlayer!.nickname,
    })
    const snapshot = await stub.fetch(new Request('https://room-v2.internal/internal/v2/snapshot', { headers: { Authorization: `Bearer ${token}` } }))
    expect(snapshot.status).toBe(200)
    expect((await snapshot.json() as { room: { members: Array<{ id: string }> } }).room.members.map(member => member.id)).toEqual(['player-a', lastPlayer!.id])
    socket.close()
  })

  it('allows more than eight players online at once', async () => {
    const { stub, room } = await createRoom('WRK011')
    const sockets: WebSocket[] = []
    for (let index = 0; index < 10; index++) {
      const player = { id: `online-${index}`, nickname: `玩家${index}` }
      const joined = await stub.fetch(new Request('https://room-v2.internal/internal/v2/join', {
        method: 'POST', body: JSON.stringify({ playerId: player.id, nickname: player.nickname }),
      }))
      expect(joined.status).toBe(200)
      await joined.arrayBuffer()
      sockets.push(await socketFor(stub, room, player))
    }
    const token = await signRoomV2Session(env.SESSION_SECRET, {
      roomId: room.roomId, inviteCode: room.inviteCode, playerId: 'online-0', nickname: '玩家0',
    })
    const snapshot = await stub.fetch(new Request('https://room-v2.internal/internal/v2/snapshot', { headers: { Authorization: `Bearer ${token}` } }))
    expect((await snapshot.json() as { room: { members: Array<{ online: boolean }> } }).room.members.filter(member => member.online)).toHaveLength(10)
    for (const socket of sockets) socket.close()
  })

  it('keeps a legacy room after its old expiry alarm and still allows joining', async () => {
    const { stub, room } = await createRoom('WRK009')
    await runInDurableObject(stub, async (instance, state) => {
      const legacy = { ...room, expiresAt: '2020-01-01T00:00:00.000Z' }
      state.storage.sql.exec('UPDATE panel_v2_meta SET room_json = ? WHERE id = 1', JSON.stringify(legacy))
      await state.storage.setAlarm(Date.now() + 60_000)
      await instance.alarm()
      expect(await state.storage.getAlarm()).toBeNull()
      expect(new RoomV2Storage(state.storage).meta()?.roomId).toBe(room.roomId)
    })
    const joined = await stub.fetch(new Request('https://room-v2.internal/internal/v2/join', {
      method: 'POST', body: JSON.stringify({ playerId: 'late-player', nickname: '迟到玩家' }),
    }))
    expect(joined.status).toBe(200)
  })

  it('broadcasts a countdown to another member and includes it in later snapshots', async () => {
    const { stub, room } = await createRoom('WRK007')
    const first = await socketFor(stub, room, room.players[0])
    const second = await socketFor(stub, room, room.players[1])
    const changed = new Promise<RoomEvent>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timed out waiting for clock.changed')), 5_000)
      second.addEventListener('message', message => {
        const event = JSON.parse(String(message.data)) as RoomEvent
        if (event.type === 'clock.changed') { clearTimeout(timeout); resolve(event) }
      })
    })
    first.send(JSON.stringify({ type: 'clock.create', protocolVersion: 2, requestId: 'create-clock', id: 'clock-1', name: '援军抵达', max: 6 }))
    await expect(changed).resolves.toMatchObject({ type: 'clock.changed', clock: { id: 'clock-1', name: '援军抵达', value: 0, max: 6 } })
    await runInDurableObject(stub, async (_instance, state) => {
      const storage = new RoomV2Storage(state.storage)
      expect(storage.snapshot('player-b', [])?.room.clocks).toEqual([{ id: 'clock-1', name: '援军抵达', value: 0, max: 6 }])
    })
    first.close(); second.close()
  })
  it('updates online members when tabs connect and close, counting two tabs for one player once', async () => {
    const { stub, room } = await createRoom('WRK006')
    const first = await socketFor(stub, room, room.players[0])

    const joined = nextPresence(first)
    const second = await socketFor(stub, room, room.players[1])
    expect((await joined).members).toMatchObject([
      { id: 'player-a', online: true }, { id: 'player-b', online: true },
    ])

    const anotherTab = nextPresence(first)
    const third = await socketFor(stub, room, room.players[1])
    expect((await anotherTab).members.filter(member => member.online)).toHaveLength(2)

    const oneTabClosed = nextPresence(first)
    second.close()
    expect((await oneTabClosed).members.find(member => member.id === 'player-b')?.online).toBe(true)

    const lastTabClosed = nextPresence(first)
    third.close()
    expect((await lastTabClosed).members.find(member => member.id === 'player-b')).toBeUndefined()
    first.close()
  })

  it('uses the query session token when a same-origin preview forwards Basic Auth', async () => {
    const { stub, room } = await createRoom('WRK000')
    const socket = await socketFor(stub, room, room.players[0], 'Basic dGVzdGVyOnByZXZpZXc=')
    const snapshot = new Promise<{ type: string; room: { roomId: string } }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timed out waiting for room.snapshot')), 5_000)
      socket.addEventListener('message', message => {
        clearTimeout(timeout)
        resolve(JSON.parse(String(message.data)) as { type: string; room: { roomId: string } })
      })
    })
    socket.send(JSON.stringify({ type: 'room.sync', protocolVersion: 2, afterSeq: 0, pendingRequestIds: [] }))
    await expect(snapshot).resolves.toMatchObject({ type: 'room.snapshot', room: { roomId: room.roomId } })
    socket.close()
  })

  it('uses real SQLite membership and broadcasts one persisted roll to two WebSockets', async () => {
    const { stub, room } = await createRoom('WRK001')
    const first = await socketFor(stub, room, room.players[0])
    const second = await socketFor(stub, room, room.players[1])
    const firstRoll = nextRoll(first)
    const secondRoll = nextRoll(second)
    first.send(JSON.stringify({
      type: 'dice.roll', protocolVersion: 2, requestId: 'workerd-roll',
      payload: { mode: 'standard', modifier_mode: 'normal', repeat: 1, modifier: 0, dice: [{ sides: 20, count: 1 }] },
    }))
    const [initiator, observer] = await Promise.all([firstRoll, secondRoll])
    expect(initiator.requestId).toBe('workerd-roll')
    expect(observer.roll.id).toBe(initiator.roll.id)
    expect(observer.roll).toEqual(initiator.roll)

    await runInDurableObject(stub, async (_instance, state) => {
      const storage = new RoomV2Storage(state.storage)
      expect(storage.sessionAccess('player-a')).toMatchObject({ roomId: room.roomId, inviteCode: room.inviteCode, member: true })
      expect(storage.sessionAccess('missing')).toMatchObject({ member: false })
      expect(state.storage.sql.exec<{ seq: number }>('SELECT seq FROM panel_v2_meta WHERE id = 1').one().seq).toBe(1)
      expect(state.storage.sql.exec<{ count: number }>('SELECT COUNT(*) AS count FROM panel_v2_receipts WHERE actor = ? AND request_id = ?', 'player-a', 'workerd-roll').one().count).toBe(1)
      const record = state.storage.sql.exec<{ record_json: string }>('SELECT record_json FROM panel_v2_dice WHERE seq = 1').one()
      expect(JSON.parse(record.record_json)).toEqual(initiator.roll)
    })
    first.close(); second.close()
  })

  it('rolls back intermediate SQLite writes when a transaction throws', async () => {
    const { stub } = await createRoom('WRK002')
    await runInDurableObject(stub, async (_instance, state) => {
      expect(() => state.storage.transactionSync(() => {
        state.storage.sql.exec("UPDATE panel_v2_meta SET seq = 99 WHERE id = 1")
        state.storage.sql.exec("INSERT INTO panel_v2_dice (seq, id, record_json) VALUES (99, 'partial', '{}')")
        throw new Error('injected transaction failure')
      })).toThrow('injected transaction failure')
      expect(state.storage.sql.exec<{ seq: number }>('SELECT seq FROM panel_v2_meta WHERE id = 1').one().seq).toBe(0)
      expect(state.storage.sql.exec<{ count: number }>('SELECT COUNT(*) AS count FROM panel_v2_dice').one().count).toBe(0)
    })
  })

  it('trims existing padded resource arrays to the builder’s displayed maxima in snapshots', async () => {
    const { stub } = await createRoom('WRK003')
    await runInDurableObject(stub, async (_instance, state) => {
      const storage = new RoomV2Storage(state.storage)
      const sheet = { ruleSetId: 'daggerheart' as const, name: '阿德兰', hope: 3, hpMax: 18, stressMax: 18,
        hp: Array(18).fill(false) as boolean[], stress: Array(18).fill(false) as boolean[], armorBoxes: Array(12).fill(false) as boolean[],
        cards: [{ id: 'Human-HighStamina' }],
        desktopView: { version: 1 as const, evasion: '9', armorValue: '2', minorThreshold: '17', majorThreshold: '26',
          attributes: { agility: '+2', strength: '+3', finesse: '0', instinct: '+1', presence: '0', knowledge: '-1' },
          hpMax: 7, stressMax: 7, armorMax: 12, primaryWeaponAttribute: '', primaryWeaponRange: '', secondaryWeaponAttribute: '', secondaryWeaponRange: '' },
      }
      const resources = { hope: 3, hopeMax: 6, hp: [...sheet.hp], stress: [...sheet.stress], armor: [...sheet.armorBoxes] }
      resources.hp[0] = true
      resources.stress[0] = true
      storage.saveCharacter(sheet.name, 1, 0, sheet, summaryFromSheet(sheet, resources, 1, 0), resources)
      const character = storage.snapshot('player-a', [])!.room.characters[0]
      expect(character.resources.hp).toHaveLength(7)
      expect(character.resources.stress).toHaveLength(7)
      expect(character.resources.hp[0]).toBe(true)
      expect(character.resources.stress[0]).toBe(true)
      expect(character.minorThreshold).toBe('17')
    })
  })

  it('persists a clicked gold chest through a new storage read', async () => {
    const { stub } = await createRoom('WRK004')
    await runInDurableObject(stub, async (_instance, state) => {
      const storage = new RoomV2Storage(state.storage)
      const sheet = { ruleSetId: 'daggerheart' as const, name: '阿岚', hope: 2,
        hp: Array(6).fill(false) as boolean[], stress: Array(6).fill(false) as boolean[],
        armorBoxes: [false], gold: Array(20).fill(false) as boolean[], cards: [],
      }
      const resources = { hope: 2, hopeMax: 6, hp: sheet.hp, stress: sheet.stress, armor: sheet.armorBoxes, gold: Array(21).fill(false) as boolean[] }
      storage.saveCharacter(sheet.name, 1, 0, sheet, summaryFromSheet(sheet, resources, 1, 0), resources)
      const commands = new RoomV2Commands(storage, () => undefined)
      await commands.mutate('player-a', '甲', { type: 'character.setMark', protocolVersion: 2, requestId: 'gold-chest', name: sheet.name, generation: 1, resource: 'gold', index: 20, marked: true })
      const restored = new RoomV2Storage(state.storage)
      expect(restored.sheet(sheet.name)?.resources.gold?.[20]).toBe(true)
      expect((restored.sheet(sheet.name)?.sheet.gold as boolean[])[20]).toBe(true)
      expect(restored.snapshot('player-a', [])?.room.characters[0].resources.gold?.[20]).toBe(true)
    })
  })

  it('allows only the creator to permanently delete all room storage', async () => {
    const { stub, room } = await createRoom('WRK005')
    const tokenFor = (player: StoredMeta['players'][number]) => signRoomV2Session(env.SESSION_SECRET, {
      roomId: room.roomId, inviteCode: room.inviteCode, playerId: player.id, nickname: player.nickname,
    })
    const remove = async (player: StoredMeta['players'][number]) => stub.fetch(new Request('https://room-v2.internal/internal/v2/delete', {
      method: 'DELETE', headers: { Authorization: `Bearer ${await tokenFor(player)}` },
    }))

    expect((await remove(room.players[1])).status).toBe(403)
    expect((await remove(room.players[0])).status).toBe(200)

    const join = await stub.fetch(new Request('https://room-v2.internal/internal/v2/join', {
      method: 'POST', body: JSON.stringify({ playerId: 'late-player', nickname: '迟到者' }),
    }))
    expect(join.status).toBe(404)
  })

  it('requires the browser owner key and original nickname for new rooms, including after rejoining', async () => {
    const room = { ...meta('WRK008'), ownerKeyHash: await roomOwnerKeyHash('a'.repeat(64)) }
    const stub = env.ROOMS_V2.getByName(room.inviteCode)
    const created = await stub.fetch(new Request('https://room-v2.internal/internal/v2/create', { method: 'POST', body: JSON.stringify(room) }))
    expect(created.status).toBe(200)
    await created.arrayBuffer()
    const tokenFor = (playerId: string, nickname: string) => signRoomV2Session(env.SESSION_SECRET, {
      roomId: room.roomId, inviteCode: room.inviteCode, playerId, nickname,
    })
    const remove = async (playerId: string, nickname: string, key?: string) => stub.fetch(new Request('https://room-v2.internal/internal/v2/delete', {
      method: 'DELETE', headers: { Authorization: `Bearer ${await tokenFor(playerId, nickname)}`, ...(key ? { 'X-Room-Owner-Key': key } : {}) },
    }))
    expect((await remove('player-a', '甲')).status).toBe(403)
    expect((await remove('player-b', '乙', 'a'.repeat(64))).status).toBe(403)
    const joined = await stub.fetch(new Request('https://room-v2.internal/internal/v2/join', {
      method: 'POST', body: JSON.stringify({ playerId: 'player-c', nickname: '甲' }),
    }))
    expect(joined.status).toBe(200)
    await joined.arrayBuffer()
    expect((await remove('player-c', '甲', 'b'.repeat(64))).status).toBe(403)
    expect((await remove('player-c', '甲', 'a'.repeat(64))).status).toBe(200)
  })

  it('returns an owner key only on creation and forwards it for public deletion', async () => {
    const created = await routeRoomV2(new Request('https://rooms.example/api/v2/rooms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: '甲', room_name: '密钥测试' }),
    }), env)
    expect(created?.status).toBe(200)
    const payload = await created!.json() as { ownerKey: string; session: { inviteCode: string; token: string }; room: unknown }
    expect(payload.ownerKey).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(payload.room)).not.toContain('ownerKey')
    const joined = await routeRoomV2(new Request('https://rooms.example/api/v2/rooms/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: '甲', invite_code: payload.session.inviteCode }),
    }), env)
    const joinPayload = await joined!.json() as { ownerKey?: string; session: { token: string } }
    expect(joinPayload.ownerKey).toBeUndefined()
    const url = `https://rooms.example/api/v2/rooms/${payload.session.inviteCode}`
    const denied = await routeRoomV2(new Request(url, { method: 'DELETE', headers: { Authorization: `Bearer ${joinPayload.session.token}` } }), env)
    expect(denied?.status).toBe(403)
    const removed = await routeRoomV2(new Request(url, {
      method: 'DELETE', headers: { Authorization: `Bearer ${joinPayload.session.token}`, 'X-Room-Owner-Key': payload.ownerKey },
    }), env)
    expect(removed?.status).toBe(200)
  })
})
