import { Clock3, Plus, Trash2 } from 'lucide-react'
import type { ResourceTrackerCountdown } from '@dhgc/shared'
import { NumberAdjuster } from '@/components/mobile-panel/MobileSharedWidgets'

interface Props {
  fearValue: number
  fearMax: number
  countdowns: ResourceTrackerCountdown[]
  countdownName: string
  countdownMax: string
  onCountdownNameChange: (name: string) => void
  onCountdownMaxChange: (max: string) => void
  onUpdateFear: (value: number) => void
  onUpdateCountdown: (id: string, value: number) => void
  onDeleteCountdown: (id: string) => void
  onCreateCountdown: () => void
}

export function MobileFearAndCountdowns({
  fearValue,
  fearMax,
  countdowns,
  countdownName,
  countdownMax,
  onCountdownNameChange,
  onCountdownMaxChange,
  onUpdateFear,
  onUpdateCountdown,
  onDeleteCountdown,
  onCreateCountdown,
}: Props) {
  return (
    <section
      style={{
        padding: 16,
        background: 'linear-gradient(145deg, rgba(76,41,21,0.92), rgba(120,72,38,0.88))',
        color: '#fff5ea',
        border: '1px solid rgba(255,236,214,0.2)',
        boxShadow: '0 18px 40px rgba(86, 52, 28, 0.18)',
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: '0.08em', fontWeight: 800, color: 'rgba(255,245,234,0.78)' }}>MOBILE PANEL</div>
          <div style={{ marginTop: 4, fontSize: 24, fontWeight: 950 }}>恐惧点与进度钟</div>
          <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.7, color: 'rgba(255,245,234,0.76)' }}>
            管理全队共享资源，也可以同时浏览角色列表。
          </div>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            border: '1px solid rgba(255,245,234,0.2)',
            background: 'rgba(255,245,234,0.08)',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <Clock3 size={14} />
          {countdowns.length} 个进度钟
        </div>
      </div>

      <NumberAdjuster
        label="恐惧点"
        value={fearValue}
        max={fearMax}
        onChange={onUpdateFear}
      />

      <div style={{ display: 'grid', gap: 10 }}>
        {countdowns.length ? countdowns.map((countdown) => (
          <div
            key={countdown.id}
            style={{
              padding: 12,
              background: 'rgba(255,245,234,0.1)',
              border: '1px solid rgba(255,245,234,0.14)',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{countdown.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,245,234,0.72)' }}>{countdown.value}/{countdown.max}</div>
              </div>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => onDeleteCountdown(countdown.id)}>
                <Trash2 size={13} /> 删除
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={countdown.max}
              value={countdown.value}
              onChange={(event) => onUpdateCountdown(countdown.id, Number(event.target.value))}
            />
          </div>
        )) : (
          <div
            style={{
              padding: '14px 16px',
              border: '1px dashed rgba(255,245,234,0.26)',
              background: 'rgba(255,245,234,0.06)',
              fontSize: 13,
              lineHeight: 1.7,
              color: 'rgba(255,245,234,0.78)',
            }}
          >
            还没有进度钟。你可以先在下方创建一个新的共享倒计时。
          </div>
        )}

        <div
          style={{
            padding: 12,
            background: 'rgba(255,245,234,0.1)',
            border: '1px dashed rgba(255,245,234,0.28)',
            display: 'grid',
            gap: 10,
          }}
        >
          <input
            className="input"
            value={countdownName}
            onChange={(event) => onCountdownNameChange(event.target.value)}
            placeholder="新进度钟名称"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={countdownMax}
              onChange={(event) => onCountdownMaxChange(event.target.value)}
              placeholder="最大值"
              inputMode="numeric"
            />
            <button className="btn btn-primary" type="button" onClick={onCreateCountdown}>
              <Plus size={14} /> 添加
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
