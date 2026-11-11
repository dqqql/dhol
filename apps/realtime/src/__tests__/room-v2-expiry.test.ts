import { describe, expect, it } from 'vitest'
import { RoomV2DurableObject } from '../room-v2'

describe('Room V2 legacy expiry alarms', () => {
  it('cancels an old alarm without deleting room data or closing sockets', async () => {
    const calls: string[] = []
    const ctx = {
      storage: {
        sql: { exec: () => ({ toArray: () => [] }) },
        deleteAlarm: async () => { calls.push('alarm') },
        deleteAll: async () => { calls.push('storage') },
      },
      getWebSockets: () => [{ close: () => { calls.push('socket') } }],
      blockConcurrencyWhile: (callback: () => Promise<void>) => callback(),
    }
    const room = new RoomV2DurableObject(ctx as never, { SESSION_SECRET: 'test' } as never)
    await room.alarm()
    expect(calls).toEqual(['alarm'])
  })
})
