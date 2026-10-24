import { env, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { summaryFromSheet, type RoomEvent } from '@dhgc/shared/desktop'
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

describe('Room V2 workerd integration', () => {
  it('allows joining after more than sixteen member records have accumulated', async () => {
    const { stub } = await createRoom('WRK010')
    for (let index = 0; index < 16; index++) {
      const response = await stub.fetch(new Request('https://room-v2.internal/internal/v2/join', {
        method: 'POST', body: JSON.stringify({ playerId: `returning-${index}`, nickname: '重复加入的玩家' }),
      }))
      expect(response.status).toBe(200)
      await response.arrayBuffer()
    }
    const response = await stub.fetch(new Request('https://room-v2.internal/internal/v2/join', {
      method: 'POST', body: JSON.stringify({ playerId: 'new-player', nickname: '新玩家' }),
    }))
    expect(response.status).toBe(200)
    const payload = await response.json() as { room: { members: Array<{ id: string }> } }
    expect(payload.room.members).toHaveLength(19)
    expect(payload.room.members.at(-1)?.id).toBe('new-player')
  })

  it('limits distinct online players to eight, including direct WebSocket reconnects', async () => {
    const { stub, room } = await createRoom('WRK011')
    const players = Array.from({ length: 9 }, (_, index) => ({ id: `online-${index}`, nickname: `玩家${index}` }))
    await runInDurableObject(stub, async (_, state) => {
      new RoomV2Storage(state.storage).updateMeta({ ...room, players })
    })
    const sockets: WebSocket[] = []
    for (const player of players.slice(0, 8)) sockets.push(await socketFor(stub, room, player))
    sockets.push(await socketFor(stub, room, players[0]))

    const join = await stub.fetch(new Request('https://room-v2.internal/internal/v2/join', {
      method: 'POST', body: JSON.stringify({ playerId: 'another-player', nickname: '后来者' }),
    }))
    expect(join.status).toBe(409)
    expect(await join.json()).toEqual({ code: 'ROOM_FULL' })

    const token = await signRoomV2Session(env.SESSION_SECRET, {
      roomId: room.roomId, inviteCode: room.inviteCode, playerId: players[8].id, nickname: players[8].nickname,
    })
    const denied = await stub.fetch(new Request(`https://room-v2.internal/internal/v2/ws?token=${token}`, { headers: { Upgrade: 'websocket' } }))
    expect(denied.status).toBe(101)
    const deniedSocket = denied.webSocket!
    const closed = new Promise<CloseEvent>(resolve => deniedSocket.addEventListener('close', resolve, { once: true }))
    deniedSocket.accept()
    expect((await closed).code).toBe(4008)
    for (const socket of sockets) socket.close()
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
    expect((await lastTabClosed).members.find(member => member.id === 'player-b')?.online).toBe(false)
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
