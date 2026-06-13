import { describe, expect, it } from 'vitest'
import { normalizeDiceRollRequest, rollDicePool } from '../dice'

function sequence(values: number[]) {
  let index = 0
  return () => values[index++] ?? 0
}

describe('normalizeDiceRollRequest', () => {
  it('merges matching dice and sorts the pool', () => {
    const request = normalizeDiceRollRequest({
      mode: 'standard',
      modifier_mode: 'normal',
      repeat: 1,
      modifier: 3,
      dice: [{ sides: 8, count: 2 }, { sides: 6, count: 1 }, { sides: 8, count: 1 }],
    })

    expect(request.dice).toEqual([{ sides: 6, count: 1 }, { sides: 8, count: 3 }])
  })

  it('rejects advantage on non-d20 pools', () => {
    expect(() => normalizeDiceRollRequest({
      mode: 'standard',
      modifier_mode: 'advantage',
      repeat: 1,
      modifier: 0,
      dice: [{ sides: 8, count: 2 }],
    })).toThrow('只有单枚 d20')
  })
})

describe('rollDicePool', () => {
  it('rolls d20 advantage, keeps the higher die, and detects a natural 20', () => {
    const rolled = rollDicePool({
      mode: 'standard',
      modifier_mode: 'advantage',
      repeat: 1,
      modifier: 2,
      dice: [{ sides: 20, count: 1 }],
    }, sequence([0.2, 0.999]))

    expect(rolled.results[0]).toMatchObject({
      primary_rolls: [5, 20],
      kept_primary: 20,
      total: 22,
      critical: true,
    })
  })

  it('rolls duality dice and adds an advantage d6 without changing the outcome comparison', () => {
    const rolled = rollDicePool({
      mode: 'dual',
      modifier_mode: 'advantage',
      repeat: 1,
      modifier: 2,
      dice: [],
    }, sequence([0.74, 0.24, 0.49]))

    expect(rolled.results[0]).toMatchObject({
      hope: 9,
      fear: 3,
      advantage_roll: 3,
      outcome: 'hope',
      total: 17,
      critical: false,
    })
  })

  it('marks matching duality dice as a critical success', () => {
    const rolled = rollDicePool({
      mode: 'dual',
      modifier_mode: 'disadvantage',
      repeat: 1,
      modifier: -2,
      dice: [],
    }, sequence([0.5, 0.5, 0]))

    expect(rolled.results[0]).toMatchObject({
      hope: 7,
      fear: 7,
      advantage_roll: 1,
      outcome: 'critical',
      total: 11,
      critical: true,
    })
  })

  it('returns one result per repeat for a visual multi-roll', () => {
    const rolled = rollDicePool({
      mode: 'standard',
      modifier_mode: 'advantage',
      repeat: 2,
      modifier: 3,
      dice: [{ sides: 20, count: 1 }],
    }, sequence([0, 0.5, 0.25, 0.75]))

    expect(rolled.results.map((result) => result.total)).toEqual([14, 19])
  })
})
