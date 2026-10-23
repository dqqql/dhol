import { memo, useState } from 'react'
import type { CharacterSummary, TrackResource } from '@dhgc/shared/desktop'
import ResourceTrack from './ResourceTrack'

const attributes: Array<[keyof CharacterSummary['attributes'], string]> = [
  ['agility', '敏捷'], ['strength', '力量'], ['finesse', '灵巧'],
  ['instinct', '本能'], ['presence', '风度'], ['knowledge', '知识'],
]

function weaponDamageDice(damage: string | null): string | null {
  return damage?.replace(/^(?:敏捷|力量|灵巧|本能|风度|知识)\s*[：:]\s*/, '').trim() || null
}

function CharacterSummaryCard({ character, ready, onHope, onMark, onDetail, onNotes, onDelete, onAddIndicator, onAdjustIndicator, onQuickRollStat }: {
  character: CharacterSummary
  ready: boolean
  onHope: (delta: 1 | -1) => void
  onMark: (resource: TrackResource, index: number, marked: boolean) => void
  onDetail: () => void
  onNotes: () => void
  onDelete: () => void
  onAddIndicator: (name: string, value: number) => void
  onAdjustIndicator: (id: string, delta: 1 | -1) => void
  onQuickRollStat: (character: CharacterSummary, statName: string, statVal: string) => void
}) {
  const [addingIndicator, setAddingIndicator] = useState(false)
  const [indicatorName, setIndicatorName] = useState('')
  const [indicatorValue, setIndicatorValue] = useState('1')
  const value = (item: string | null) => item ?? '—'
  const primaryDamageDice = weaponDamageDice(character.primaryWeaponDamage)
  const secondaryDamageDice = weaponDamageDice(character.secondaryWeaponDamage)
  const hopeSlots = Array.from({ length: character.resources.hopeMax || 6 }, (_, i) => i < character.resources.hope)
  const indicators = character.resources.indicators ?? []

  return <article className="character-card" aria-labelledby={`character-${character.generation}`}>
    {indicators.length > 0 && <div className="character-indicators" aria-label={`${character.name}的指示物`}>
      {indicators.map((indicator, index) => <span key={indicator.id} className="character-indicator-anchor">
        <button type="button" className={`character-indicator character-indicator--${index % 6}`} aria-label={`${indicator.name} ${indicator.value}，左键增加，右键减少`} aria-describedby={`indicator-tip-${character.generation}-${indicator.id}`} disabled={!ready} onClick={() => onAdjustIndicator(indicator.id, 1)} onContextMenu={event => { event.preventDefault(); if (ready) onAdjustIndicator(indicator.id, -1) }}>{indicator.value}</button>
        <span id={`indicator-tip-${character.generation}-${indicator.id}`} className="character-indicator-tooltip" role="tooltip">
          <strong>{indicator.name} · {indicator.value}</strong>
          <span>左键增加 · 右键减少</span>
        </span>
      </span>)}
    </div>}
    <header className="character-card__identity">
      <div className="player-title-row">
        <h2 id={`character-${character.generation}`} className="player-name">{character.name}</h2>
        <span className="player-sub">{[character.profession, character.level && `${character.level}级`].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="character-card__actions">
        <button type="button" className="btn-indicator-add" disabled={!ready || indicators.length >= 6} onClick={() => setAddingIndicator(open => !open)}>指示物</button>
        <button type="button" className="btn-remove-player" disabled={!ready} onClick={onDelete}>移除</button>
      </div>
    </header>
    {addingIndicator && <form className="indicator-popover" onSubmit={event => { event.preventDefault(); const number = Number(indicatorValue); if (!indicatorName.trim() || !Number.isSafeInteger(number) || number < 1 || number > 999) return; onAddIndicator(indicatorName.trim(), number); setIndicatorName(''); setIndicatorValue('1'); setAddingIndicator(false) }}>
      <label>名字<input autoFocus maxLength={32} value={indicatorName} onChange={event => setIndicatorName(event.target.value)} required /></label>
      <label>初始数值<input type="number" min="1" max="999" step="1" value={indicatorValue} onChange={event => setIndicatorValue(event.target.value)} required /></label>
      <div><button type="button" onClick={() => setAddingIndicator(false)}>取消</button><button type="submit" className="button--primary">添加</button></div>
    </form>}
    <section className="character-card__resources" aria-label="四项资源">
      <div className="hope-control">
        <div className="hope-control__label">
          <strong className="track-title--blue">希望</strong>
          <span>{character.resources.hope} / {character.resources.hopeMax}</span>
        </div>
        <div className="hope-wrap">
          <div className="hope-diamonds">
            {hopeSlots.map((active, i) => <span key={i} className={`hope-diamond ${active ? 'active' : ''}`} />)}
          </div>
          <b className="hope-number">{character.resources.hope}</b>
        </div>
        <div className="track-steppers">
          <button type="button" disabled={!ready || character.resources.hope === 0} onClick={() => onHope(-1)} aria-label="减少一点希望">−</button>
          <button type="button" disabled={!ready || character.resources.hope === character.resources.hopeMax} onClick={() => onHope(1)} aria-label="增加一点希望">+</button>
        </div>
      </div>
      <ResourceTrack resource="hp" marks={character.resources.hp} disabled={!ready} onChange={(index, marked) => onMark('hp', index, marked)} />
      <ResourceTrack resource="stress" marks={character.resources.stress} disabled={!ready} onChange={(index, marked) => onMark('stress', index, marked)} />
      <ResourceTrack resource="armor" marks={character.resources.armor} disabled={!ready} onChange={(index, marked) => onMark('armor', index, marked)} />
    </section>
    <dl className="character-card__combat">
      <div><dt>闪避</dt><dd>{value(character.evasion)}</dd></div>
      <div><dt>护甲值</dt><dd>{value(character.armorValue)}</dd></div>
      <div><dt>轻伤阈值</dt><dd>{value(character.minorThreshold)}</dd></div>
      <div><dt>重伤阈值</dt><dd>{value(character.majorThreshold)}</dd></div>
    </dl>
    <dl className="character-card__attributes">
      {attributes.map(([key, label]) => {
        const val = value(character.attributes[key])
        return <div key={key} className="attr-cell"><button type="button" disabled={!ready || character.attributes[key] === null}
          aria-label={`${character.name} ${label}${val}，掷二元骰`} onClick={() => onQuickRollStat(character, label, val)}>
          <span>{label}</span><strong>{val}</strong>
        </button></div>
      })}
    </dl>
    <div className="character-card__weapons">
      <div className="weapon-info"><small>主武器</small><strong>{value(character.primaryWeaponName)}</strong><span className="weapon-info__stats">{primaryDamageDice && <span className="weapon-info__damage">{primaryDamageDice}</span>}<span className="weapon-info__details">{[character.primaryWeaponTrait, character.primaryWeaponRange].filter(Boolean).join(' · ') || '属性 / 攻击距离未填写'}</span></span></div>
      {character.experiences?.map((experience, index) => <div className="experience-info" key={`${experience.kind}-${index}`}>
        <small>{experience.kind === 'ancestry' ? '种族经历' : '经历'}</small>
        <strong>{experience.name}</strong>
        <span>{experience.bonus ?? '—'}</span>
      </div>)}
      {character.secondaryWeaponName && <div className="weapon-info"><small>副武器</small><strong>{character.secondaryWeaponName}</strong><span className="weapon-info__stats">{secondaryDamageDice && <span className="weapon-info__damage">{secondaryDamageDice}</span>}<span className="weapon-info__details">{[character.secondaryWeaponTrait, character.secondaryWeaponRange].filter(Boolean).join(' · ') || '属性 / 攻击距离未填写'}</span></span></div>}
    </div>
    <footer>
      <button type="button" className="button button--primary btn-detail" onClick={onDetail}>完整信息</button>
      <button type="button" className="btn-notes" onClick={onNotes}>笔记</button>
    </footer>
  </article>
}

export default memo(CharacterSummaryCard)
