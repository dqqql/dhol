import type { LightAbsorbFlight } from './enemy-types'

export interface Point2D {
  x: number
  y: number
}

export default function AimingArrowOverlay({
  from,
  to,
  hasTargetHover,
  flights,
}: {
  from: Point2D | null
  to: Point2D | null
  hasTargetHover: boolean
  flights: LightAbsorbFlight[]
}) {
  const showArrow = from !== null && to !== null

  if (!showArrow && flights.length === 0) return null

  let arrowPath = ''
  let angleDeg = 0
  if (showArrow) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.hypot(dx, dy)
    // Control points create an upward Slay-the-Spire arc.
    const lift = Math.min(220, Math.max(80, dist * 0.42))
    const c1x = from.x + dx * 0.18
    const c1y = from.y - lift
    const c2x = to.x - dx * 0.12
    const c2y = to.y - lift * 0.35
    arrowPath = `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`
    angleDeg = (Math.atan2(to.y - c2y, to.x - c2x) * 180) / Math.PI
  }

  return (
    <div className="combat-overlay-layer" aria-hidden="true">
      {showArrow && (
        <svg className="combat-arrow-svg">
          <defs>
            <filter id="combat-arrow-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#E6332A" floodOpacity="0.6" />
            </filter>
          </defs>
          <path
            d={arrowPath}
            className={`combat-arrow-path ${hasTargetHover ? 'is-locked' : ''}`}
            filter="url(#combat-arrow-glow)"
          />
          <g transform={`translate(${to.x}, ${to.y}) rotate(${angleDeg})`}>
            <polygon
              points="0,0 -18,-9 -14,0 -18,9"
              className={`combat-arrow-head ${hasTargetHover ? 'is-locked' : ''}`}
            />
          </g>
        </svg>
      )}

      {flights.map(flight => {
        const dx = flight.toX - flight.fromX
        const dy = flight.toY - flight.fromY
        const length = Math.hypot(dx, dy)
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI
        return (
          <div
            key={flight.id}
            className="combat-absorb-flight"
            style={{
              left: `${flight.fromX}px`,
              top: `${flight.fromY}px`,
              ['--flight-dx' as string]: `${dx}px`,
              ['--flight-dy' as string]: `${dy}px`,
              ['--flight-deg' as string]: `${deg}deg`,
              ['--flight-len' as string]: `${Math.min(180, Math.max(60, length * 0.25))}px`,
            }}
          >
            <span className="combat-absorb-tail" />
            <span className="combat-absorb-orb" />
          </div>
        )
      })}
    </div>
  )
}
