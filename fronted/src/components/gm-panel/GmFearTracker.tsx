import { useEffect, useState } from 'react'
import type { ResourceTrackerCountdown } from '@dhgc/shared'
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import type { GmPanelThemeDefinition } from '@/components/gm-panel/gmPanelThemes'

function IconButton(props: {
  children: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
  theme: GmPanelThemeDefinition
}) {
  const { children, title, onClick, disabled = false, theme } = props

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${theme.colors.iconBorder}`,
        background: disabled ? theme.colors.iconBackgroundDisabled : theme.colors.iconBackground,
        color: disabled ? theme.colors.iconTextDisabled : theme.colors.iconText,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export function GmFearTracker(props: {
  value: number
  max: number
  countdowns: ResourceTrackerCountdown[]
  editable: boolean
  draftName: string
  draftMax: string
  onDraftNameChange: (value: string) => void
  onDraftMaxChange: (value: string) => void
  onChange: (value: number) => void
  onCreateCountdown: () => void
  onUpdateCountdown: (countdownId: string, value: number) => void
  onDeleteCountdown: (countdownId: string) => void
  theme: GmPanelThemeDefinition
}) {
  const {
    value,
    max,
    countdowns,
    editable,
    draftName,
    draftMax,
    onDraftNameChange,
    onDraftMaxChange,
    onChange,
    onCreateCountdown,
    onUpdateCountdown,
    onDeleteCountdown,
    theme,
  } = props

  const [showCreator, setShowCreator] = useState(false)
  const [visibleStart, setVisibleStart] = useState(0)
  const visibleCount = 6
  const maxStart = Math.max(0, countdowns.length - visibleCount)
  const visibleCountdowns = countdowns.slice(visibleStart, visibleStart + visibleCount)
  const hasOverflow = countdowns.length > visibleCount

  useEffect(() => {
    setVisibleStart((current) => Math.min(current, maxStart))
  }, [maxStart])

  useEffect(() => {
    if (!editable) {
      setShowCreator(false)
    }
  }, [editable])

  function handleCreateCountdown() {
    onCreateCountdown()
    setShowCreator(false)
  }

  return (
    <>
      <section
        style={{
          padding: 20,
          border: `1px solid ${theme.colors.fearPanelBorder}`,
          background: theme.colors.fearPanelBackground,
          boxShadow: theme.colors.fearPanelShadow,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 18,
              alignItems: 'flex-start',
              flex: '1 1 720px',
              minWidth: 0,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ width: 180, maxWidth: '100%', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '5px 12px',
                    background: theme.colors.fearBadgeBackground,
                    color: theme.colors.fearBadgeText,
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                    boxShadow: theme.colors.fearBadgeShadow,
                  }}
                >
                  恐惧点
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 64, lineHeight: 0.9, fontWeight: 900, color: theme.colors.fearValue, letterSpacing: 0 }}>{value}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: theme.colors.fearValueMuted }}>/ {max}</span>
              </div>
              {editable && (
                <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: theme.colors.fearHint }}>
                  点击下方刻度即可把恐惧点设置到对应数值。
                </div>
              )}
            </div>

            <div style={{ flex: '1 1 420px', minWidth: 280, paddingTop: 4 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 14,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: theme.colors.countdownTitle, letterSpacing: '0.01em' }}>进度钟</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 20 }}>
                  {hasOverflow && (
                    <>
                      <IconButton theme={theme} title="上一个进度钟" onClick={() => setVisibleStart((current) => Math.max(0, current - 1))} disabled={visibleStart === 0}>
                        <ChevronLeft size={14} />
                      </IconButton>
                      <IconButton
                        theme={theme}
                        title="下一个进度钟"
                        onClick={() => setVisibleStart((current) => Math.min(maxStart, current + 1))}
                        disabled={visibleStart >= maxStart}
                      >
                        <ChevronRight size={14} />
                      </IconButton>
                    </>
                  )}
                  {countdowns.length > visibleCount && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: theme.colors.countdownOverflow }}>
                      {visibleStart + 1}-{Math.min(visibleStart + visibleCount, countdowns.length)} / {countdowns.length}
                    </div>
                  )}
                </div>
              </div>

              {visibleCountdowns.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 10, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 4 }}>
                  {visibleCountdowns.map((countdown) => (
                    <div
                      key={countdown.id}
                      style={{
                        width: 'fit-content',
                        maxWidth: '100%',
                        flex: '0 0 auto',
                        padding: 14,
                        border: `1px solid ${theme.colors.countdownCardBorder}`,
                        background: theme.colors.countdownCardBackground,
                        boxShadow: theme.colors.countdownCardShadow,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: theme.colors.countdownName,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {countdown.name}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: theme.colors.countdownValue }}>
                          {countdown.value} / {countdown.max}
                        </div>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => onDeleteCountdown(countdown.id)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: theme.colors.countdownDelete,
                              cursor: 'pointer',
                              padding: 0,
                              marginLeft: 'auto',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Array.from({ length: countdown.max }, (_, index) => {
                          const step = index + 1
                          const active = step <= countdown.value
                          return (
                            <button
                              key={step}
                              type="button"
                              disabled={!editable}
                              onClick={() => editable && onUpdateCountdown(countdown.id, step)}
                              style={{
                                width: 28,
                                height: 28,
                                border: active ? `1px solid ${theme.colors.countdownStepActiveBorder}` : `1px solid ${theme.colors.countdownStepInactiveBorder}`,
                                background: active ? theme.colors.countdownStepActiveBackground : theme.colors.countdownStepInactiveBackground,
                                color: active ? theme.colors.countdownStepActiveText : theme.colors.countdownStepInactiveText,
                                fontSize: 12,
                                fontWeight: 800,
                                cursor: editable ? 'pointer' : 'default',
                                boxShadow: active ? theme.colors.countdownStepActiveShadow : 'none',
                                transition: 'all var(--transition-fast)',
                              }}
                            >
                              {step}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: theme.colors.countdownOverflow }}>还没有进度钟。</div>
              )}
            </div>
          </div>

          {editable && (
            <div style={{ display: 'grid', gap: 8, minWidth: 220, width: 276, maxWidth: '100%' }}>
              <button
                className="btn btn-sm"
                onClick={() => onChange(Math.max(0, value - 1))}
                style={{
                  background: theme.colors.hopeActionBackground,
                  borderColor: theme.colors.hopeActionBorder,
                  color: theme.colors.hopeActionText,
                }}
              >
                - 暗影消散
              </button>
              <button
                className="btn btn-sm"
                onClick={() => onChange(Math.min(max, value + 1))}
                style={{
                  background: theme.colors.fearActionBackground,
                  borderColor: theme.colors.fearActionBorder,
                  color: theme.colors.fearActionText,
                }}
              >
                + 恐惧滋生
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onChange(0)}>
                <RefreshCw size={13} /> 重置
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreator(true)}>
                管理进度钟
              </button>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${max}, minmax(56px, 1fr))`,
            gap: 8,
          }}
        >
          {Array.from({ length: max }).map((_, index) => {
            const step = index + 1
            const active = step <= value
            const opacity = 0.12 + (index / Math.max(1, max - 1)) * 0.88

            return (
              <button
                key={step}
                type="button"
                disabled={!editable}
                onClick={() => editable && onChange(step)}
                style={{
                  height: 44,
                  border: active ? `1px solid ${theme.colors.fearTrackActiveBorder}` : `1px solid ${theme.colors.fearTrackInactiveBorder}`,
                  background: active ? `rgba(${theme.colors.fearTrackActiveRgb}, ${opacity})` : theme.colors.fearTrackInactiveBackground,
                  color: active ? theme.colors.fearTrackActiveText : theme.colors.fearTrackInactiveText,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: editable ? 'pointer' : 'default',
                  boxShadow: active ? `0 2px 8px rgba(${theme.colors.fearTrackActiveRgb}, ${opacity * 0.3})` : 'none',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {step}
              </button>
            )
          })}
        </div>
      </section>

      <Modal open={showCreator} onClose={() => setShowCreator(false)} title="管理进度钟" maxWidth={420}>
        <div style={{ display: 'grid', gap: 12 }}>
          <input
            className="input"
            value={draftName}
            onChange={(event) => onDraftNameChange(event.target.value)}
            placeholder="新的进度钟名称"
          />
          <input
            className="input"
            value={draftMax}
            onChange={(event) => onDraftMaxChange(event.target.value)}
            placeholder="6"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowCreator(false)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={handleCreateCountdown}>
              <Plus size={14} /> 添加
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
