import { describe, expect, it, vi } from 'vitest'
import { RoomDurableObject } from '../index'
import {
  SOCKET_SESSION_ATTACHMENT_ERROR_CODE,
  SOCKET_SESSION_ATTACHMENT_ERROR_MESSAGE,
  SocketSessionAttachmentError,
  getPlayerTag,
  prepareSocketSession,
  readSocketSessionAttachment,
  serializeSocketSessionAttachment,
  validateSocketSessionAttachment,
} from '../socket-session'
import type { RoomState } from '../../../../packages/shared/src/index'

class FakeSocket {
  accepted = false
  readyState = 1
  serializedAttachment: unknown = undefined
  deserializedAttachment: unknown = null
  sentMessages: string[] = []
  listeners = new Map<string, EventListener>()
  closeCode: number | undefined
  closeReason: string | undefined

  accept(): void {
    this.accepted = true
  }

  serializeAttachment(attachment: unknown): void {
    this.serializedAttachment = attachment
    this.deserializedAttachment = attachment
  }

  deserializeAttachment(): unknown {
    return this.deserializedAttachment
  }

  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, listener)
  }

  send(message: string): void {
    this.sentMessages.push(message)
  }

  close(code?: number, reason?: string): void {
    this.closeCode = code
    this.closeReason = reason
    this.readyState = 3
  }
}

class FakeWebSocketPair {
  static lastPair: FakeWebSocketPair | undefined
  0: FakeSocket
  1: FakeSocket

  constructor() {
    this[0] = new FakeSocket()
    this[1] = new FakeSocket()
    FakeWebSocketPair.lastPair = this
  }
}

function createRoom(): RoomState {
  return {
    room_type: 'gm-panel',
    room_id: 'room-1',
    room_name: 'Socket session test',
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
    dice_rolls: [],
    x_card: null,
    snapshot_version: 1,
    updated_at: '2026-07-05T00:00:00.000Z',
  }
}

function createContext(initialSockets: Array<{ socket: WebSocket; tags?: string[] }> = []) {
  const sockets = new Map<WebSocket, string[]>(
    initialSockets.map(({ socket, tags = [] }) => [socket, tags]),
  )
  const put = vi.fn(async () => undefined)
  const list = vi.fn(async () => new Map<string, string>())
  const deleteEntry = vi.fn(async () => undefined)
  const context = {
    storage: {
      get: vi.fn(async () => undefined),
      put,
      list,
      delete: deleteEntry,
      transaction: vi.fn((closure: (txn: DurableObjectTransaction) => Promise<unknown>) => closure({
        put,
        list,
        delete: deleteEntry,
      } as unknown as DurableObjectTransaction)),
      deleteAll: vi.fn(async () => undefined),
      deleteAlarm: vi.fn(async () => undefined),
      setAlarm: vi.fn(async () => undefined),
      getAlarm: vi.fn(async () => null),
    },
    waitUntil: vi.fn(),
    acceptWebSocket: vi.fn((socket: WebSocket, tags: string[] = []) => {
      sockets.set(socket, tags)
      if ('accepted' in socket) {
        ;(socket as unknown as FakeSocket).accepted = true
      }
    }),
    getWebSockets: vi.fn((tag?: string) => Array.from(sockets.entries())
      .filter(([socket, tags]) => (
        (socket as unknown as { readyState?: number }).readyState !== 3
        && (!tag || tags.includes(tag))
      ))
      .map(([socket]) => socket)),
  }
  return context as unknown as DurableObjectState & typeof context
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function signTestSession(secret: string): Promise<string> {
  const payload = {
    room_id: 'room-1',
    invite_code: 'ABC123',
    player_id: 'player-1',
    nickname: 'Host',
    exp: Math.floor(Date.now() / 1000) + 60,
  }
  const body = encodeBase64Url(JSON.stringify(payload))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return `${body}.${encodeBase64Url(new Uint8Array(signature))}`
}

function encodeBase64Url(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

describe('socket session connection integration', () => {
  it('serializes only player identity when a websocket connection is accepted', async () => {
    vi.stubGlobal('WebSocketPair', FakeWebSocketPair)
    vi.stubGlobal('Response', class {
      readonly status: number
      readonly webSocket: unknown

      constructor(_body: unknown, init: { status?: number; webSocket?: unknown } = {}) {
        this.status = init.status ?? 200
        this.webSocket = init.webSocket
      }
    })

    const ctx = createContext()
    try {
      const durableObject = new RoomDurableObject(ctx, {
        SESSION_SECRET: 'test-secret',
        ALLOWED_ORIGIN: '*',
      } as never)
      ;(durableObject as unknown as { room: RoomState | null }).room = createRoom()
      const token = await signTestSession('test-secret')

      const response = await durableObject.fetch(new Request(
        `https://room.local/api/rooms/ABC123/ws?token=${encodeURIComponent(token)}`,
        { headers: { Upgrade: 'websocket' } },
      ))
      const pair = FakeWebSocketPair.lastPair

      expect(response.status).toBe(101)
      expect(pair).toBeDefined()
      expect(pair?.[1].serializedAttachment).toEqual({
        playerId: 'player-1',
        nickname: 'Host',
      })
      expect(Object.keys(pair?.[1].serializedAttachment as object)).toEqual(['playerId', 'nickname'])
      expect(ctx.acceptWebSocket).toHaveBeenCalledWith(pair?.[1], ['player:player-1'])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('registers the hibernatable websocket before persistence completes', async () => {
    vi.stubGlobal('WebSocketPair', FakeWebSocketPair)
    vi.stubGlobal('Response', class {
      readonly status: number
      readonly webSocket: unknown

      constructor(_body: unknown, init: { status?: number; webSocket?: unknown } = {}) {
        this.status = init.status ?? 200
        this.webSocket = init.webSocket
      }
    })

    const ctx = createContext()
    const saveGate = createDeferred<void>()
    ;(ctx.storage.put as ReturnType<typeof vi.fn>).mockImplementation(() => saveGate.promise)

    try {
      const durableObject = new RoomDurableObject(ctx, {
        SESSION_SECRET: 'test-secret',
        ALLOWED_ORIGIN: '*',
      } as never)
      ;(durableObject as unknown as { room: RoomState | null }).room = createRoom()
      const token = await signTestSession('test-secret')

      const responsePromise = durableObject.fetch(new Request(
        `https://room.local/api/rooms/ABC123/ws?token=${encodeURIComponent(token)}`,
        { headers: { Upgrade: 'websocket' } },
      ))
      try {
        await vi.waitFor(() => expect(ctx.storage.put).toHaveBeenCalledOnce())

        const pair = FakeWebSocketPair.lastPair
        expect(pair?.[1].accepted).toBe(true)
        expect(ctx.acceptWebSocket).toHaveBeenCalledWith(pair?.[1], ['player:player-1'])
        expect(pair?.[1].listeners.size).toBe(0)

        saveGate.resolve(undefined)
        const response = await responsePromise
        expect(response.status).toBe(101)
      } finally {
        saveGate.resolve(undefined)
        await responsePromise.catch(() => undefined)
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('socket session disconnects', () => {
  it('keeps a player online while another socket for that player remains', async () => {
    const room = createRoom()
    const firstSocket = new FakeSocket()
    const secondSocket = new FakeSocket()
    firstSocket.deserializedAttachment = { playerId: 'player-1', nickname: 'Host' }
    secondSocket.deserializedAttachment = { playerId: 'player-1', nickname: 'Host' }
    const ctx = createContext([
      { socket: firstSocket as unknown as WebSocket, tags: ['player:player-1'] },
      { socket: secondSocket as unknown as WebSocket, tags: ['player:player-1'] },
    ])
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)

    ;(durableObject as unknown as { room: RoomState | null }).room = room
    firstSocket.readyState = 3
    await durableObject.webSocketClose(firstSocket as unknown as WebSocket, 1000, '', true)

    expect(room.players[0].is_online).toBe(true)
    expect((ctx.storage.put as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('marks the player offline when their last tagged socket closes', async () => {
    const room = createRoom()
    room.players.push({
      id: 'player-2',
      nickname: 'Guest',
      color: '#2563eb',
      is_host: false,
      is_online: true,
      joined_at: '2026-07-05T00:00:00.000Z',
      last_seen_at: '2026-07-05T00:00:00.000Z',
    })
    const socket = new FakeSocket()
    socket.deserializedAttachment = { playerId: 'player-1', nickname: 'Host' }
    socket.readyState = 3
    const observer = new FakeSocket()
    observer.deserializedAttachment = { playerId: 'player-2', nickname: 'Guest' }
    const ctx = createContext([
      { socket: socket as unknown as WebSocket, tags: ['player:player-1'] },
      { socket: observer as unknown as WebSocket, tags: ['player:player-2'] },
    ])
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)

    ;(durableObject as unknown as { room: RoomState | null }).room = room
    await durableObject.webSocketClose(socket as unknown as WebSocket, 1000, '', true)

    expect(room.players.find(player => player.id === 'player-1')?.is_online).toBe(false)
    expect(ctx.storage.put).toHaveBeenCalledOnce()
    expect(observer.sentMessages).toHaveLength(1)
    expect(JSON.parse(observer.sentMessages[0])).toMatchObject({
      type: 'room.updated',
      payload: { reason: 'player.offline' },
    })
  })

  it('does not persist an invalid attachment during close handling', async () => {
    const ctx = createContext()
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()
    const socket = new FakeSocket()
    socket.deserializedAttachment = null

    ;(durableObject as unknown as { room: RoomState | null }).room = room
    await durableObject.webSocketClose(socket as unknown as WebSocket, 1006, '', false)

    expect(room.players[0].is_online).toBe(true)
    expect(ctx.storage.put).not.toHaveBeenCalled()
  })

  it('handles websocket errors through the hibernation event handler', async () => {
    const room = createRoom()
    const socket = new FakeSocket()
    socket.deserializedAttachment = { playerId: 'player-1', nickname: 'Host' }
    socket.readyState = 3
    const ctx = createContext([
      { socket: socket as unknown as WebSocket, tags: ['player:player-1'] },
    ])
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)
    ;(durableObject as unknown as { room: RoomState | null }).room = room

    await durableObject.webSocketError(socket as unknown as WebSocket, new Error('connection failed'))

    expect(room.players[0].is_online).toBe(false)
    expect(ctx.storage.put).toHaveBeenCalledOnce()
  })

  it('closes every hibernatable socket when the room expires', async () => {
    const socket = new FakeSocket()
    socket.deserializedAttachment = { playerId: 'player-1', nickname: 'Host' }
    const observer = new FakeSocket()
    const ctx = createContext([
      { socket: socket as unknown as WebSocket },
      { socket: observer as unknown as WebSocket },
    ])
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()

    ;(durableObject as unknown as { room: RoomState | null }).room = room
    await (durableObject as unknown as { purgeRoom(reason: 'expired'): Promise<void> }).purgeRoom('expired')

    expect(socket.closeCode).toBe(1001)
    expect(observer.closeCode).toBe(1001)
    expect(ctx.storage.deleteAlarm).toHaveBeenCalledOnce()
    expect(ctx.storage.deleteAll).toHaveBeenCalledOnce()

    await durableObject.webSocketClose(socket as unknown as WebSocket, 1001, 'Room expired', true)
    expect(ctx.storage.put).not.toHaveBeenCalled()
  })

  it('closes a socket whose broadcast send fails and continues broadcasting', () => {
    const socket = new FakeSocket()
    socket.send = () => { throw new Error('socket is closed') }
    const observer = new FakeSocket()
    const ctx = createContext([
      { socket: socket as unknown as WebSocket },
      { socket: observer as unknown as WebSocket },
    ])
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)

    ;(durableObject as unknown as { broadcast(message: unknown): void }).broadcast({
      type: 'room.updated',
    })

    expect(socket.closeCode).toBe(1011)
    expect(observer.sentMessages).toHaveLength(1)
  })

  it('keeps a player online when a replacement socket connects while disconnect waits', async () => {
    const room = createRoom()
    const oldSocket = new FakeSocket()
    oldSocket.deserializedAttachment = { playerId: 'player-1', nickname: 'Host' }
    const replacementSocket = new FakeSocket()
    replacementSocket.deserializedAttachment = { playerId: 'player-1', nickname: 'Host' }
    const ctx = createContext([
      { socket: oldSocket as unknown as WebSocket, tags: ['player:player-1'] },
    ])
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)

    ;(durableObject as unknown as { room: RoomState | null }).room = room
    oldSocket.readyState = 3
    const disconnectPromise = durableObject.webSocketClose(oldSocket as unknown as WebSocket, 1000, '', true)
    ctx.acceptWebSocket(replacementSocket as unknown as WebSocket, ['player:player-1'])

    await disconnectPromise

    expect(room.players[0].is_online).toBe(true)
    expect(ctx.storage.put).not.toHaveBeenCalled()
  })

  it('does not persist or broadcast again when disconnect is repeated', async () => {
    const room = createRoom()
    room.players.push({
      id: 'player-2',
      nickname: 'Guest',
      color: '#2563eb',
      is_host: false,
      is_online: true,
      joined_at: '2026-07-05T00:00:00.000Z',
      last_seen_at: '2026-07-05T00:00:00.000Z',
    })
    const socket = new FakeSocket()
    socket.deserializedAttachment = { playerId: 'player-1', nickname: 'Host' }
    socket.readyState = 3
    const observer = new FakeSocket()
    observer.deserializedAttachment = { playerId: 'player-2', nickname: 'Guest' }
    const ctx = createContext([
      { socket: socket as unknown as WebSocket, tags: ['player:player-1'] },
      { socket: observer as unknown as WebSocket, tags: ['player:player-2'] },
    ])
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)

    ;(durableObject as unknown as { room: RoomState | null }).room = room
    await durableObject.webSocketClose(socket as unknown as WebSocket, 1000, '', true)
    await durableObject.webSocketClose(socket as unknown as WebSocket, 1000, '', true)

    expect(room.players.find(player => player.id === 'player-1')?.is_online).toBe(false)
    expect(ctx.storage.put).toHaveBeenCalledOnce()
    expect(observer.sentMessages).toHaveLength(1)
    expect(JSON.parse(observer.sentMessages[0])).toEqual(expect.objectContaining({
      type: 'room.updated',
      payload: expect.objectContaining({ reason: 'player.offline' }),
    }))
  })

  it('handles a message from its serialized attachment after hibernation', async () => {
    const durableObject = new RoomDurableObject(createContext(), { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()
    const socket = new FakeSocket()
    socket.deserializedAttachment = { playerId: 'player-1', nickname: 'Host' }

    ;(durableObject as unknown as { room: RoomState | null }).room = room
    await durableObject.webSocketMessage(socket as unknown as WebSocket, JSON.stringify({
      type: 'ping',
      requestId: 'request-1',
    }))

    expect(socket.sentMessages.map(message => JSON.parse(message))).toEqual([
      expect.objectContaining({ type: 'pong', requestId: 'request-1' }),
      expect.objectContaining({ type: 'ack', requestId: 'request-1' }),
    ])
  })

  it.each([
    ['an invalid attachment', { playerId: 'player-1', nickname: '' }],
    ['a missing attachment', null],
  ])('rejects %s during message handling with a stable error and close', async (_label, attachment) => {
    const durableObject = new RoomDurableObject(createContext(), { ALLOWED_ORIGIN: '*' } as never)
    const socket = new FakeSocket()
    socket.deserializedAttachment = attachment

    await durableObject.webSocketMessage(socket as unknown as WebSocket, JSON.stringify({ type: 'ping' }))

    expect(socket.sentMessages.map(message => JSON.parse(message))).toEqual([{
      type: 'error',
      payload: {
        code: SOCKET_SESSION_ATTACHMENT_ERROR_CODE,
        message: SOCKET_SESSION_ATTACHMENT_ERROR_MESSAGE,
      },
    }])
    expect(socket.closeCode).toBe(1008)
    expect(socket.closeReason).toBe(SOCKET_SESSION_ATTACHMENT_ERROR_MESSAGE)

    await durableObject.webSocketClose(socket as unknown as WebSocket, 1008, '', false)
    expect(socket.sentMessages).toHaveLength(1)
  })
})

describe('socket session attachment helpers', () => {
  it.each([
    ['null', null],
    ['a primitive', 'session'],
    ['an array', []],
    ['an empty object', {}],
    ['a missing nickname', { playerId: 'player-1' }],
    ['a missing playerId', { nickname: 'Host' }],
    ['an empty playerId', { playerId: '', nickname: 'Host' }],
    ['a blank playerId', { playerId: ' \t', nickname: 'Host' }],
    ['an empty nickname', { playerId: 'player-1', nickname: '' }],
    ['a blank nickname', { playerId: 'player-1', nickname: ' \n' }],
    ['a non-string playerId', { playerId: 123, nickname: 'Host' }],
    ['a non-string nickname', { playerId: 'player-1', nickname: false }],
  ])('rejects %s with a stable typed error', (_label, value) => {
    expect(() => validateSocketSessionAttachment(value)).toThrowError(SocketSessionAttachmentError)

    try {
      validateSocketSessionAttachment(value)
    } catch (error) {
      expect(error).toBeInstanceOf(SocketSessionAttachmentError)
      expect(error).toMatchObject({
        name: 'SocketSessionAttachmentError',
        code: SOCKET_SESSION_ATTACHMENT_ERROR_CODE,
        message: SOCKET_SESSION_ATTACHMENT_ERROR_MESSAGE,
      })
    }
  })

  it('reads a valid serialized attachment back into a session', () => {
    const socket = {
      deserializeAttachment: vi.fn(() => ({ playerId: 'player-1', nickname: 'Host' })),
    }

    expect(readSocketSessionAttachment(socket)).toEqual({
      playerId: 'player-1',
      nickname: 'Host',
    })
    expect(socket.deserializeAttachment).toHaveBeenCalledOnce()
  })

  it('serializes only the session identity and exposes its player tag', () => {
    const socket = { serializeAttachment: vi.fn() }

    const registration = prepareSocketSession(socket, 'player-1', 'Host')

    expect(socket.serializeAttachment).toHaveBeenCalledOnce()
    expect(socket.serializeAttachment).toHaveBeenCalledWith({
      playerId: 'player-1',
      nickname: 'Host',
    })
    expect(registration.session).toEqual({ playerId: 'player-1', nickname: 'Host' })
    expect(registration.tag).toBe('player:player-1')
    expect(registration.tags).toEqual(['player:player-1'])
    expect(getPlayerTag('player-1')).toBe('player:player-1')
  })

  it('does not silently skip a required attachment serializer', () => {
    expect(() => serializeSocketSessionAttachment({} as never, {
      playerId: 'player-1',
      nickname: 'Host',
    })).toThrow(TypeError)
  })

  it('does not silently skip a required attachment deserializer', () => {
    expect(() => readSocketSessionAttachment({} as never)).toThrow(TypeError)
  })
})
