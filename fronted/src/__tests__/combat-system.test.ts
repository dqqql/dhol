import { describe, expect, it } from 'vitest'
import { parseDamageFormula, parseEvasionValue } from '../desktop/combat/damage-formula'
import { createHandCardFromTemplate, nextNumberedName } from '../desktop/combat/enemy-storage'
import type { EnemyTemplate } from '../desktop/combat/enemy-types'

describe('combat damage formula parser', () => {
  it('parses standard dice pool expressions with modifiers', () => {
    const parsed = parseDamageFormula(' 2d8 + 1d4 - 2 ')
    expect(parsed).toEqual({
      kind: 'dice',
      dice: [
        { sides: 4, count: 1 },
        { sides: 8, count: 2 },
      ],
      modifier: -2,
      normalized: '1d4 + 2d8 - 2',
    })
  })

  it('supports shorthand d12 and flat numeric damage', () => {
    expect(parseDamageFormula('d12')).toEqual({
      kind: 'dice',
      dice: [{ sides: 12, count: 1 }],
      modifier: 0,
      normalized: '1d12',
    })
    expect(parseDamageFormula('6')).toEqual({
      kind: 'flat',
      value: 6,
      normalized: '6',
    })
  })

  it('rejects unsupported die faces and negative dice terms', () => {
    expect(parseDamageFormula('1d7+2').kind).toBe('error')
    expect(parseDamageFormula('1d8-1d4').kind).toBe('error')
  })
})

describe('evasion parsing and enemy naming', () => {
  it('extracts integer evasion from character summary strings', () => {
    expect(parseEvasionValue('12')).toBe(12)
    expect(parseEvasionValue('闪避 14')).toBe(14)
    expect(parseEvasionValue(null)).toBeNull()
  })

  it('appends #N suffixes for duplicate templates and hand instances', () => {
    expect(nextNumberedName('蛮力丧尸', ['蛮力丧尸'], true)).toBe('蛮力丧尸 #2')
    expect(nextNumberedName('蛮力丧尸 #2', ['蛮力丧尸', '蛮力丧尸 #2'], true)).toBe('蛮力丧尸 #3')

    const template: EnemyTemplate = {
      id: 't1',
      name: '哥布林',
      hpMax: 5,
      stressMax: 2,
      majorThreshold: 5,
      severeThreshold: 10,
      difficulty: 11,
      attackModifier: 2,
      damageFormula: '1d6+2',
      createdAt: 1,
    }
    const first = createHandCardFromTemplate(template, [])
    const second = createHandCardFromTemplate(template, [first.name])
    expect(first.name).toBe('哥布林')
    expect(second.name).toBe('哥布林 #2')
  })
})
