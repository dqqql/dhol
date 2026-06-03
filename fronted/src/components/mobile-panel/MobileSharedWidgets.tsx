import React from 'react'

export function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(113, 88, 52, 0.14)',
        display: 'grid',
        gap: 4,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 900 }}>{value}</div>
    </div>
  )
}

export function TrackDots({
  label,
  values,
  onToggle,
}: {
  label: string
  values: boolean[]
  onToggle: (index: number) => void
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {values.map((value, index) => (
          <button
            key={`${label}-${index}`}
            type="button"
            onClick={() => onToggle(index)}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: `1px solid ${value ? '#8b5e34' : 'rgba(113, 88, 52, 0.2)'}`,
              background: value ? 'linear-gradient(180deg, #c99b63, #8b5e34)' : 'rgba(255,255,255,0.82)',
              color: value ? '#fff7ee' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  )
}

export function NumberAdjuster({
  label,
  value,
  min = 0,
  max,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 14px',
        border: '1px solid rgba(113, 88, 52, 0.14)',
        background: 'rgba(255,255,255,0.88)',
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)' }}>{value}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => onChange(Math.max(min, value - 1))}>-</button>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={() => onChange(max == null ? value + 1 : Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  )
}

export function handleCardKeyActivate(event: React.KeyboardEvent<HTMLElement>, onActivate: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onActivate()
  }
}
