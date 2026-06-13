import { useMemo } from 'react'
import { Check, Hand, OctagonX, Users } from 'lucide-react'
import { useStore } from '@/store/useStore'

export function FloatingXCard() {
  const { room, currentPlayerId, raiseXCard, acknowledgeXCard } = useStore()

  const xCard = room?.x_card ?? null
  const isActive = Boolean(xCard)

  const onlinePlayers = useMemo(
    () => (room?.players ?? []).filter((player) => player.is_online),
    [room?.players],
  )

  const acknowledgedIds = useMemo(
    () => new Set(xCard?.acknowledged_player_ids ?? []),
    [xCard?.acknowledged_player_ids],
  )

  const readCount = onlinePlayers.filter((player) => acknowledgedIds.has(player.id)).length
  const totalCount = onlinePlayers.length
  const hasAcknowledged = acknowledgedIds.has(currentPlayerId)

  return (
    <>
      <button
        type="button"
        className="gm-floating-tool gm-floating-tool--xcard"
        onClick={() => raiseXCard()}
        title="打出 X 卡：匿名向所有人发出暂停信号"
      >
        <OctagonX size={16} />
        X 卡
        {isActive && (
          <span className="gm-floating-tool--xcard__count">{readCount}/{totalCount}</span>
        )}
      </button>

      {isActive && (
        <div className="xcard-overlay" role="alertdialog" aria-modal="true" aria-label="X 卡提示">
          <div className="xcard-dialog">
            <div className="xcard-dialog__icon">
              <Hand size={40} strokeWidth={2.5} />
            </div>
            <h2 className="xcard-dialog__title">有人打出了 X 卡</h2>
            <p className="xcard-dialog__body">
              一位匿名玩家打出了 <strong>X 卡</strong>。请暂停当前内容，
              照顾在场每个人的感受。无需追问是谁、也无需解释原因。
            </p>

            <div className="xcard-dialog__readers">
              <Users size={15} />
              <span>已有 <strong>{readCount}</strong> / {totalCount} 人阅读</span>
            </div>

            {hasAcknowledged ? (
              <button type="button" className="xcard-dialog__btn xcard-dialog__btn--waiting" disabled>
                <Check size={18} />
                已读 · 等待其他人确认
              </button>
            ) : (
              <button
                type="button"
                className="xcard-dialog__btn"
                onClick={() => acknowledgeXCard()}
              >
                我已阅读
              </button>
            )}

            <p className="xcard-dialog__hint">所有在线玩家都点击「我已阅读」后，此提示会自动消失。</p>
          </div>
        </div>
      )}
    </>
  )
}
