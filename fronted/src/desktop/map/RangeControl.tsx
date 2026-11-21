import type { CSSProperties } from 'react'
import { MAP_RANGES } from './map-geometry'

const RANGE_STEPS = [{ label: '关闭', radius: 0, color: '#64748B' }, ...MAP_RANGES] as const

export default function RangeControl({ value, onChange }: { value: number; onChange(value: number): void }) {
  const current = RANGE_STEPS[value]
  const ratio = value / (RANGE_STEPS.length - 1)
  const label = current.radius ? `${current.label} ${current.radius}格` : '关闭'

  return (
    <div className="room-map-range-control">
      <div className="room-map-range-header">
        <output style={{ left: `calc(8px + (100% - 16px) * ${ratio})` }}>{label}</output>
      </div>
      <div className="room-map-range-slider-wrap">
        <div className="room-map-range-track-bg" aria-hidden="true" />
        <div className="room-map-range-track-fill" aria-hidden="true"
          style={{ width: `calc((100% - 16px) * ${ratio})`, backgroundColor: current.color }} />
        <div className="room-map-range-nodes" aria-hidden="true">
          {RANGE_STEPS.map((range, index) => (
            <span key={range.radius} className={`room-map-range-node ${index === value ? 'is-active' : ''}`}
              style={{ left: `calc(8px + (100% - 16px) * ${index / (RANGE_STEPS.length - 1)})`, '--node-color': range.color } as CSSProperties} />
          ))}
        </div>
        <input type="range" className="room-map-range-native-input" aria-label="范围显示" min="0"
          max={RANGE_STEPS.length - 1} step="1" value={value} aria-valuetext={label}
          onChange={event => onChange(Number(event.target.value))} />
      </div>
    </div>
  )
}
