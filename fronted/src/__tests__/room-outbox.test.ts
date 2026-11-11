import { describe, expect, it } from 'vitest'
import { RoomOutbox, OutboxPersistenceError, OUTBOX_RETRY_WINDOW_MS } from '../desktop/sync/room-outbox'

function memory() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}

const command = { protocolVersion: 2 as const, requestId: 'request-1', type: 'room.adjustFear' as const, delta: 1 as const }

describe('Room V2 outbox', () => {
  it('keeps the original request ID across reloads and isolates room and actor', () => {
    const storage = memory()
    new RoomOutbox(storage, 'room-a', 'player-a').add(command)
    expect(new RoomOutbox(storage, 'room-a', 'player-a').list()[0].command.requestId).toBe('request-1')
    expect(new RoomOutbox(storage, 'room-b', 'player-a').list()).toEqual([])
    expect(new RoomOutbox(storage, 'room-a', 'player-b').list()).toEqual([])
  })
  it('does not accept an operation when browser persistence fails', () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('quota') }, removeItem: () => undefined }
    const outbox = new RoomOutbox(storage, 'room-a', 'player-a')
    expect(() => outbox.add(command)).toThrow(OutboxPersistenceError)
    expect(outbox.list()).toEqual([])
  })
  it('stops retrying operations older than the server receipt window', () => {
    const storage = memory()
    const outbox = new RoomOutbox(storage, 'room-a', 'player-a')
    outbox.add(command)
    const createdAtMs = outbox.list()[0].createdAtMs
    expect(outbox.discardExpired(createdAtMs + OUTBOX_RETRY_WINDOW_MS - 1)).toBe(0)
    expect(outbox.discardExpired(createdAtMs + OUTBOX_RETRY_WINDOW_MS)).toBe(1)
    expect(new RoomOutbox(storage, 'room-a', 'player-a').list()).toEqual([])
  })
  it('timestamps legacy pending operations once so reloads do not extend their retry window', () => {
    const storage = memory()
    const key = 'dhol:desktop:v2:outbox:room-a:player-a'
    storage.setItem(key, JSON.stringify([{ command, ackSeq: null }]))
    const first = new RoomOutbox(storage, 'room-a', 'player-a').list()[0].createdAtMs
    expect(new RoomOutbox(storage, 'room-a', 'player-a').list()[0].createdAtMs).toBe(first)
  })
})
