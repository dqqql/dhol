import type { DicePoolEntry } from '@dhgc/shared/desktop'

const ALLOWED_SIDES = new Set([4, 6, 8, 10, 12, 20, 100])
const MAX_DICE_PER_TYPE = 100
const MAX_MODIFIER = 100_000

export type ParsedDamageFormula =
  | { kind: 'dice'; dice: DicePoolEntry[]; modifier: number; normalized: string }
  | { kind: 'flat'; value: number; normalized: string }
  | { kind: 'error'; message: string }

/**
 * Parse a damage string such as "1d8+3", "2d6 + 1d4 - 1", or a fixed number like "5"
 * into standard DicePoolEntry[] + modifier accepted by the room dice protocol.
 */
export function parseDamageFormula(raw: string): ParsedDamageFormula {
  const cleaned = raw
    .trim()
    .replaceAll('＋', '+')
    .replaceAll('－', '-')
    .replaceAll('D', 'd')
    .replace(/\s+/g, '')

  if (!cleaned) {
    return { kind: 'error', message: '请填写伤害骰或固定伤害，例如 1d8+3' }
  }

  const normalizedInput = cleaned.startsWith('+') || cleaned.startsWith('-') ? cleaned : `+${cleaned}`
  const tokenPattern = /([+-])([^+-]+)/g
  const countsBySides = new Map<number, number>()
  let modifier = 0
  let consumed = 0

  for (const match of normalizedInput.matchAll(tokenPattern)) {
    if (match.index !== consumed) {
      return { kind: 'error', message: '伤害公式格式有误，示例：1d8+3、2d6' }
    }
    consumed += match[0].length
    const sign = match[1] === '-' ? -1 : 1
    const body = match[2]

    const dieMatch = /^(\d*)d(\d+)$/.exec(body)
    if (dieMatch) {
      if (sign < 0) {
        return { kind: 'error', message: '暂不支持减去骰子，请仅对固定加值使用减号' }
      }
      const count = dieMatch[1] ? Number(dieMatch[1]) : 1
      const sides = Number(dieMatch[2])
      if (!Number.isSafeInteger(count) || count < 1 || count > MAX_DICE_PER_TYPE) {
        return { kind: 'error', message: `单种骰子数量需在 1 ~ ${MAX_DICE_PER_TYPE} 之间` }
      }
      if (!ALLOWED_SIDES.has(sides)) {
        return { kind: 'error', message: `仅支持 d4/d6/d8/d10/d12/d20/d100（不支持 d${sides}）` }
      }
      const nextCount = (countsBySides.get(sides) ?? 0) + count
      if (nextCount > MAX_DICE_PER_TYPE) {
        return { kind: 'error', message: `d${sides} 总数量不能超过 ${MAX_DICE_PER_TYPE}` }
      }
      countsBySides.set(sides, nextCount)
      continue
    }

    if (/^\d+$/.test(body)) {
      modifier += sign * Number(body)
      continue
    }

    return { kind: 'error', message: `无法识别的表达式 "${body}"，示例：1d8+3` }
  }

  if (consumed !== normalizedInput.length) {
    return { kind: 'error', message: '伤害公式格式有误，示例：1d8+3、2d6' }
  }

  if (!Number.isSafeInteger(modifier) || Math.abs(modifier) > MAX_MODIFIER) {
    return { kind: 'error', message: '固定加值超出允许范围' }
  }

  const dice: DicePoolEntry[] = [...countsBySides.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([sides, count]) => ({ sides, count }))

  if (dice.length === 0) {
    return { kind: 'flat', value: modifier, normalized: String(modifier) }
  }

  const dicePart = dice.map(entry => `${entry.count}d${entry.sides}`).join(' + ')
  const modPart = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : ''
  return {
    kind: 'dice',
    dice,
    modifier,
    normalized: `${dicePart}${modPart}`,
  }
}

export function parseEvasionValue(evasion: string | null): number | null {
  if (!evasion) return null
  const match = /-?\d+/.exec(evasion.trim())
  if (!match) return null
  const num = Number(match[0])
  return Number.isSafeInteger(num) ? num : null
}

export function formatSignedModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}
