import { describe, expect, it, vi } from 'vitest'
import { RoomDurableObject } from '../index'
import {
  SOCKET_SESSION_ATTACHMENT_ERROR_CODE,
  SOCKET_SESSION_ATTACHMENT_ERROR_MESSAGE,
  SocketSessionAttachmentError,
  getPlayerTag,
  prepareSocketSession,
  readSocketSessionAttachment,
  validateSocketSessionAttachment,
} from '../socket-session'
import type { RoomState } from '../../../../packages/shared/src/index'

class FakeSocket {
  accepted = false
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

function createContext() {
  return {
    storage: {
      get: vi.fn(async () => undefined),
      put: vi.fn(async () => undefined),
      list: vi.fn(async () => new Map<string, string>()),
      setAlarm: vi.fn(async () => undefined),
      getAlarm: vi.fn(async () => null),
    },
    waitUntil: vi.fn(),
  } as unknown as DurableObjectState
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

    try {
      const durableObject = new RoomDurableObject(createContext(), {
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
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('socket session disconnects', () => {
  it('keeps a player online while another socket for that player remains', async () => {
    const ctx = createContext()
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()
    const firstSocket = {} as WebSocket
    const secondSocket = {} as WebSocket

    ;(durableObject as unknown as { room: RoomState | null }).room = room
    ;(durableObject as unknown as { sockets: Map<WebSocket, { playerId: string; nickname: string }> }).sockets = new Map([
      [firstSocket, { playerId: 'player-1', nickname: 'Host' }],
      [secondSocket, { playerId: 'player-1', nickname: 'Host' }],
    ])

    await (durableObject as unknown as { disconnect(socket: WebSocket): Promise<void> }).disconnect(firstSocket)

    expect(room.players[0].is_online).toBe(true)
    expect((ctx.storage.put as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('does not persist or broadcast again when disconnect is repeated after attachment recovery', async () => {
    const ctx = createContext()
    const durableObject = new RoomDurableObject(ctx, { ALLOWED_ORIGIN: '*' } as never)
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
    const observer = new FakeSocket()

    ;(durableObject as unknown as { room: RoomState | null }).room = room
    ;(durableObject as unknown as { sockets: Map<WebSocket, { playerId: string; nickname: string }> }).sockets = new Map([
      [socket as unknown as WebSocket, { playerId: 'player-1', nickname: 'Host' }],
      [observer as unknown as WebSocket, { playerId: 'player-2', nickname: 'Guest' }],
    ])

    const disconnect = (durableObject as unknown as {
      disconnect(socket: WebSocket): Promise<void>
    }).disconnect

    await disconnect.call(durableObject, socket as unknown as WebSocket)
    await disconnect.call(durableObject, socket as unknown as WebSocket)

    expect(room.players.find(player => player.id === 'player-1')?.is_online).toBe(false)
    expect(ctx.storage.put).toHaveBeenCalledOnce()
    expect(observer.sentMessages).toHaveLength(1)
    expect(JSON.parse(observer.sentMessages[0])).toEqual(expect.objectContaining({
      type: 'room.updated',
      payload: expect.objectContaining({ reason: 'player.offline' }),
    }))
  })

  it('restores a missing map session from a valid attachment before handling a message', async () => {
    const durableObject = new RoomDurableObject(createContext(), { ALLOWED_ORIGIN: '*' } as never)
    const room = createRoom()
    const socket = new FakeSocket()
    socket.deserializedAttachment = { playerId: 'player-1', nickname: 'Host' }

    ;(durableObject as unknown as { room: RoomState | null }).room = room
    await (durableObject as unknown as {
      handleMessage(socket: WebSocket, data: string): Promise<void>
    }).handleMessage(socket as unknown as WebSocket, JSON.stringify({
      type: 'ping',
      requestId: 'request-1',
    }))

    expect((durableObject as unknown as {
      sockets: Map<WebSocket, { playerId: string; nickname: string }>
    }).sockets.get(socket as unknown as WebSocket)).toEqual({
      playerId: 'player-1',
      nickname: 'Host',
    })
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

    await (durableObject as unknown as {
      handleMessage(socket: WebSocket, data: string): Promise<void>
    }).handleMessage(socket as unknown as WebSocket, JSON.stringify({ type: 'ping' }))

    expect(socket.sentMessages.map(message => JSON.parse(message))).toEqual([{
      type: 'error',
      payload: {
        code: SOCKET_SESSION_ATTACHMENT_ERROR_CODE,
        message: SOCKET_SESSION_ATTACHMENT_ERROR_MESSAGE,
      },
    }])
    expect(socket.closeCode).toBe(1008)
    expect(socket.closeReason).toBe(SOCKET_SESSION_ATTACHMENT_ERROR_MESSAGE)

    await (durableObject as unknown as {
      disconnect(socket: WebSocket): Promise<void>
    }).disconnect(socket as unknown as WebSocket)
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
})
