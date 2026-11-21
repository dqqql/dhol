import { useId } from 'react'
import classTokens from './assets/class-tokens.png'
import natureTokens from './assets/monster-tokens-nature.png'
import magicTokens from './assets/monster-tokens-magic.png'

const REGIONS: Record<string, { view: string; source: string; width: number; height: number }> = {}
for (const [id, x, y] of [
  ['bard', 65, 90], ['druid', 447, 90], ['guardian', 831, 90],
  ['ranger', 65, 447], ['rogue', 447, 447], ['seraph', 831, 447],
  ['sorcerer', 65, 807], ['warrior', 447, 807], ['wizard', 831, 807],
] as const) REGIONS[id] = { view: `${x} ${y} 350 350`, source: classTokens, width: 1254, height: 1254 }
for (const [id, y] of [['dragon', 3], ['golem', 283], ['ghost', 562]] as const) {
  REGIONS[id] = { view: `18 ${y} 274 274`, source: natureTokens, width: 304, height: 837 }
}
for (const [id, x] of [['dark-mage', 12], ['demon', 311]] as const) {
  REGIONS[id] = { view: `${x} 6 274 274`, source: magicTokens, width: 601, height: 283 }
}

const LEGACY_CLASSES: Record<string, string> = { hero: 'guardian', beast: 'druid', skull: 'rogue', marker: 'wizard' }

export default function TokenIcon({ image, x = 0, y = 0, size = 32 }: { image: string; x?: number; y?: number; size?: number }) {
  const clipId = useId()
  const id = Object.hasOwn(REGIONS, image) ? image : Object.hasOwn(LEGACY_CLASSES, image) ? LEGACY_CLASSES[image] : 'guardian'
  const region = REGIONS[id]
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs><clipPath id={clipId}><circle cx="50" cy="50" r="50" /></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
        <svg width="100" height="100" viewBox={region.view} preserveAspectRatio="xMidYMid slice">
          <image href={region.source} width={region.width} height={region.height} />
        </svg>
      </g>
    </svg>
  )
}
