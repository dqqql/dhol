import { describe, expect, it } from 'vitest'
import type { DiceRollRecord } from '../types'
import type { ServerMessage } from '../protocol'

const roll: DiceRollRecord = {
  id: 'dice_roll_1',
  created_at: '2026-09-16T00:00:00.000Z',
  actor_player_id: 'player_1',
  actor_name: 'Alice',
  normalized_formula: '1d20+2',
  request: {
    mode: 'standard',
    modifier_mode: 'normal',
    repeat: 1,
    modifier: 2,
    dice: [{ sides: 20, count: 1 }],
  },
  mode: 'standard',
  modifier_mode: 'normal',
  results: [{
    total: 15,
    critical: false,
    primary_rolls: [13],
    terms: [{ notation: '1d20', sides: 20, count: 1, rolls: [13], subtotal: 13 }],
  }],
}

describe('ServerMessage dice protocol', () => {
  it('defines dice.rolled with one roll record and its snapshot version', () => {
    const message: Extract<ServerMessage, { type: 'dice.rolled' }> = {
      type: 'dice.rolled',
      payload: {
        roll,
        snapshot_version: 12,
      },
    }

    expect(message).toEqual({
      type: 'dice.rolled',
      payload: {
        roll,
        snapshot_version: 12,
      },
    })
  })

  it('defines dice.historyCleared with the resulting snapshot version', () => {
    const message: Extract<ServerMessage, { type: 'dice.historyCleared' }> = {
      type: 'dice.historyCleared',
      payload: {
        snapshot_version: 13,
      },
    }

    expect(message).toEqual({
      type: 'dice.historyCleared',
      payload: {
        snapshot_version: 13,
      },
    })
  })

  it('keeps the existing room snapshot and update message contracts', () => {
    const snapshot: Extract<ServerMessage, { type: 'room.snapshot' }> = {
      type: 'room.snapshot',
      payload: {
        state: {} as never,
        you: { player_id: 'player_1' },
      },
    }
    const updated: Extract<ServerMessage, { type: 'room.updated' }> = {
      type: 'room.updated',
      payload: {
        state: {} as never,
        reason: 'dice.roll',
      },
    }

    expect(snapshot.type).toBe('room.snapshot')
    expect(updated.type).toBe('room.updated')
  })
})
