import classTokens from './assets/class-tokens.png'

// Regions in the supplied nine-class illustration; SVG clips each region without
// duplicating or resampling the source artwork.
const CLASS_REGIONS: Record<string, string> = {
  bard: '38 90 386 348',
  druid: '434 90 386 348',
  guardian: '831 90 385 348',
  ranger: '38 448 386 353',
  rogue: '434 448 386 353',
  seraph: '831 448 385 353',
  sorcerer: '38 813 386 385',
  warrior: '434 813 386 385',
  wizard: '831 813 385 385',
}

// Existing room data keeps its original IDs, names and positions.
const LEGACY_CLASSES: Record<string, string> = {
  hero: 'guardian',
  beast: 'druid',
  skull: 'rogue',
  marker: 'wizard',
}

export default function TokenIcon({ image, x = 0, y = 0, size = 32 }: { image: string; x?: number; y?: number; size?: number }) {
  const classId = Object.hasOwn(CLASS_REGIONS, image) ? image : Object.hasOwn(LEGACY_CLASSES, image) ? LEGACY_CLASSES[image] : 'guardian'
  const region = CLASS_REGIONS[classId]
  return (
    <svg x={x} y={y} width={size} height={size} viewBox={region} preserveAspectRatio="xMidYMid slice" overflow="hidden" aria-hidden="true">
      <image href={classTokens} width="1254" height="1254" />
    </svg>
  )
}
