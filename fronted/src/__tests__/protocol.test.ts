import { describe, expect, it } from 'vitest'
import type { DiceRollRecord, ServerMessage } from '@dhgc/shared'

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

describe('frontend realtime protocol', () => {
  it('can consume a single dice.rolled message from shared protocol', () => {
    const message: Extract<ServerMessage, { type: 'dice.rolled' }> = {
      type: 'dice.rolled',
      payload: { roll, snapshot_version: 12 },
    }

    expect(message.payload.roll.id).toBe('dice_roll_1')
    expect(message.payload.snapshot_version).toBe(12)
  })
})
