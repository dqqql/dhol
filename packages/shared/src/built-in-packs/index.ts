import ageOfUmbra from './age-of-umbra.dhpack.json'
import beastFeast from './beast-feast.dhpack.json'
import breathOfTheFoulwild from './breath-of-the-foulwild.dhpack.json'
import fiveFlagsToFlame from './five-flags-to-flame.dhpack.json'
import oneHundredAdventureReasons from './one-hundred-adventure-reasons.dhpack.json'
import oneHundredStrangeSettings from './one-hundred-strange-settings.dhpack.json'
import { assertDhPack } from '../validators'
import type { DhPack } from '../types'

export interface BuiltInPack extends DhPack {
  id: string
  description?: string
}

function defineBuiltInPack(
  value: unknown,
  fallback: { id: string; description?: string },
): BuiltInPack {
  const pack = assertDhPack(value)
  const id = typeof pack.id === 'string' && pack.id.trim() ? pack.id.trim() : fallback.id
  const description = typeof pack.description === 'string' && pack.description.trim()
    ? pack.description.trim()
    : fallback.description

  return {
    ...pack,
    id,
    ...(description ? { description } : {}),
  }
}

export const BUILT_IN_PACKS: BuiltInPack[] = [
  defineBuiltInPack(ageOfUmbra, {
    id: 'campaign-age-of-umbra',
    description: '圣火庇护、亡灵诅咒、旧世废墟与末世暗影。',
  }),
  defineBuiltInPack(beastFeast, {
    id: 'campaign-beast-feast',
    description: '地下迷宫、怪物料理、魔诱核衰退与食材争夺。',
  }),
  defineBuiltInPack(breathOfTheFoulwild, {
    id: 'campaign-breath-of-the-foulwild',
    description: '无尽之春、石化蛇疫、红花苦役与具身神明撕裂下的绝境求生。',
  }),
  defineBuiltInPack(fiveFlagsToFlame, {
    id: 'campaign-five-flags-to-flame',
    description: '五国冷战、边境停战、神权断层与魔导革命。',
  }),
  defineBuiltInPack(oneHundredAdventureReasons, {
    id: 'adventure-reasons-100',
    description: '百条可直接投入战役的动机、委托与冲突引子。',
  }),
  defineBuiltInPack(oneHundredStrangeSettings, {
    id: 'strange-settings-100',
    description: '百条可直接嵌入世界观的地点、生态、气候与社会设定。',
  }),
]
