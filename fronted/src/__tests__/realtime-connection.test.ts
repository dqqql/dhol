import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientMessage } from '@dhgc/shared'
import { RoomSocketConnection } from '@/lib/realtime'

type SocketEventHandler = (event: { code?: number; reason?: string; data?: unknown }) => void

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  sentMessages: string[] = []
  private listeners = new Map<string, SocketEventHandler[]>()

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  addEventListener(type: string, handler: SocketEventHandler): void {
    const handlers = this.listeners.get(type) ?? []
    handlers.push(handler)
    this.listeners.set(type, handlers)
  }

  send(message: string): void {
    this.sentMessages.push(message)
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSING
  }

  emitOpen(): void {
    this.readyState = FakeWebSocket.OPEN
    this.emit('open', {})
  }

  emitClose(code = 1000, reason = ''): void {
    this.readyState = FakeWebSocket.CLOSED
    this.emit('close', { code, reason })
  }

  emitMessage(data: unknown): void {
    this.emit('message', { data })
  }

  private emit(type: string, event: { code?: number; reason?: string; data?: unknown }): void {
    for (const handler of this.listeners.get(type) ?? []) handler(event)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('RoomSocketConnection reconnect races', () => {
  it('ignores late events from the socket replaced by manualReconnect', () => {
    const onMessage = vi.fn()
    const onOpen = vi.fn()
    const onClose = vi.fn()
    const onError = vi.fn()
    const onStatusChange = vi.fn()
    const connection = new RoomSocketConnection('wss://example.test/room', {
      onMessage,
      onOpen,
      onClose,
      onError,
      onStatusChange,
    })

    connection.connect()
    const oldSocket = FakeWebSocket.instances[0]
    oldSocket.emitOpen()
    expect(onOpen).toHaveBeenCalledTimes(1)

    connection.manualReconnect()
    const newSocket = FakeWebSocket.instances[1]
    newSocket.emitOpen()
    expect(connection.isConnected).toBe(true)
    expect(onOpen).toHaveBeenCalledTimes(2)

    oldSocket.emitMessage(JSON.stringify({ type: 'pong', payload: { server_time: 'late' } }))
    oldSocket.emitOpen()
    oldSocket.emitClose(1006)

    const outgoing: ClientMessage = { type: 'ping', payload: {} }
    expect(connection.isConnected).toBe(true)
    expect(connection.send(outgoing)).toBe(true)
    expect(newSocket.sentMessages).toEqual([JSON.stringify(outgoing)])
    expect(onMessage).not.toHaveBeenCalled()
    expect(onOpen).toHaveBeenCalledTimes(2)
    expect(onClose).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(onStatusChange.mock.calls.map(([status]) => status)).toEqual(['connecting', 'connecting'])

    vi.runAllTimers()
    expect(FakeWebSocket.instances).toHaveLength(2)
  })
})
