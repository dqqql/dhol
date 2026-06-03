import type { MobilePanelCharacterEntry } from '@dhgc/shared'
import { MoreHorizontal, Pencil, RefreshCw, ScrollText, Trash2, UserPlus } from 'lucide-react'
import { StatPill, handleCardKeyActivate } from '@/components/mobile-panel/MobileSharedWidgets'

function getCharacterTitle(entry: MobilePanelCharacterEntry) {
  if (entry.custom.display_name) return entry.custom.display_name

  const parts = [
    entry.decoded.specialCards.profession?.title,
    entry.decoded.specialCards.subclass?.title,
    entry.decoded.specialCards.ancestry1?.title,
    entry.decoded.specialCards.ancestry2?.title,
    entry.decoded.specialCards.community?.title,
  ].filter(Boolean)

  return parts.length ? `${parts.join('-')} LV${entry.decoded.level}` : `角色 LV${entry.decoded.level}`
}

function getIdentityLine(entry: MobilePanelCharacterEntry) {
  return [
    `LV${entry.decoded.level}`,
    entry.decoded.specialCards.profession?.title,
    entry.decoded.specialCards.subclass?.title,
    [entry.decoded.specialCards.ancestry1?.title, entry.decoded.specialCards.ancestry2?.title].filter(Boolean).join('/'),
    entry.decoded.specialCards.community?.title,
  ].filter(Boolean).join(' / ')
}

interface Props {
  orderedCharacters: MobilePanelCharacterEntry[]
  activeCharacterMenuId: string | null
  onSelectCharacter: (id: string) => void
  onToggleMenu: (id: string) => void
  onOpenActivityLog: () => void
  onOpenAddCharacter: () => void
  onEditCharacter: (id: string) => void
  onReplaceCharacter: (id: string) => void
  onDeleteCharacter: (id: string) => void
}

export function MobileCharacterList({
  orderedCharacters,
  activeCharacterMenuId,
  onSelectCharacter,
  onToggleMenu,
  onOpenActivityLog,
  onOpenAddCharacter,
  onEditCharacter,
  onReplaceCharacter,
  onDeleteCharacter,
}: Props) {
  return (
    <section
      style={{
        padding: 16,
        background: 'rgba(255,250,244,0.78)',
        border: '1px solid rgba(113, 88, 52, 0.12)',
        boxShadow: '0 12px 30px rgba(118, 83, 36, 0.08)',
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)' }}>角色列表</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            点击卡片查看详情。角色管理操作仍然收在每张卡片右上角的菜单里。
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} data-mobile-actions-root="true">
          <button className="btn btn-secondary btn-sm" type="button" onClick={onOpenActivityLog}>
            <ScrollText size={14} /> 活动日志
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={onOpenAddCharacter}>
            <UserPlus size={14} /> 添加角色
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {orderedCharacters.length ? orderedCharacters.map((entry) => {
          const isMenuOpen = activeCharacterMenuId === entry.id

          return (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectCharacter(entry.id)}
              onKeyDown={(event) => handleCardKeyActivate(event, () => onSelectCharacter(entry.id))}
              style={{
                padding: 14,
                textAlign: 'left',
                border: '1px solid rgba(113, 88, 52, 0.14)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(251,243,232,0.92))',
                boxShadow: '0 8px 18px rgba(118, 83, 36, 0.06)',
                cursor: 'pointer',
                display: 'grid',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>{getCharacterTitle(entry)}</div>
                  <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{getIdentityLine(entry)}</div>
                </div>

                <div style={{ position: 'relative' }} data-mobile-actions-root="true">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    aria-label={`${getCharacterTitle(entry)} 的角色操作`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleMenu(entry.id)
                    }}
                  >
                    <MoreHorizontal size={14} />
                  </button>

                  {isMenuOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: 0,
                        zIndex: 8,
                        minWidth: 156,
                        padding: 8,
                        border: '1px solid rgba(113, 88, 52, 0.18)',
                        background: 'rgba(255,252,247,0.98)',
                        boxShadow: '0 14px 30px rgba(118, 83, 36, 0.14)',
                        display: 'grid',
                        gap: 6,
                      }}
                    >
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => onEditCharacter(entry.id)}>
                        <Pencil size={12} /> 编辑信息
                      </button>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => onReplaceCharacter(entry.id)}>
                        <RefreshCw size={12} /> 替换角色码
                      </button>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => onDeleteCharacter(entry.id)}>
                        <Trash2 size={12} /> 删除角色
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                <StatPill label="希望" value={`${entry.tracker.hopeCurrent}/${entry.decoded.resources.hopeMax}`} />
                <StatPill label="生命" value={`${entry.tracker.hp.filter(Boolean).length}/${entry.tracker.hp.length}`} />
                <StatPill label="压力" value={`${entry.tracker.stress.filter(Boolean).length}/${entry.tracker.stress.length}`} />
                <StatPill label="护甲槽" value={`${entry.tracker.armor_slots.filter(Boolean).length}/${entry.tracker.armor_slots.length}`} />
                <StatPill label="金币" value={entry.tracker.goldCurrent} />
                <StatPill label="领域卡" value={entry.decoded.domains.length} />
              </div>
            </div>
          )
        }) : (
          <div
            style={{
              padding: 22,
              border: '1px dashed rgba(113, 88, 52, 0.24)',
              color: 'var(--text-secondary)',
              background: 'rgba(255,255,255,0.58)',
              textAlign: 'center',
              lineHeight: 1.8,
            }}
          >
            还没有角色。点击右下角的悬浮按钮，就可以添加角色或查看活动日志。
          </div>
        )}
      </div>
    </section>
  )
}

export { getCharacterTitle, getIdentityLine }
