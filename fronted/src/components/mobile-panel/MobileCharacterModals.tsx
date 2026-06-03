import React from 'react'
import type { MobilePanelCharacterEntry, MobilePanelExperience } from '@dhgc/shared'
import { BookText, Pencil, RefreshCw, Shield, Swords, Trash2, UserPlus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { NumberAdjuster, StatPill, TrackDots } from '@/components/mobile-panel/MobileSharedWidgets'
import { InfoBlock, SectionCard } from '@/components/mobile-panel/MobileMarkdownRenderer'

const MAX_EXPERIENCES = 6

export type ExperienceDraft = {
  id: string
  name: string
  value: string
}

export function buildEmptyExperienceDrafts(): ExperienceDraft[] {
  return Array.from({ length: MAX_EXPERIENCES }, (_, index) => ({
    id: `draft_${index}`,
    name: '',
    value: '',
  }))
}

export function buildExperienceDrafts(source?: MobilePanelExperience[]): ExperienceDraft[] {
  const drafts = buildEmptyExperienceDrafts()
  source?.slice(0, MAX_EXPERIENCES).forEach((item, index) => {
    drafts[index] = {
      id: item.id || `draft_${index}`,
      name: item.name,
      value: item.value,
    }
  })
  return drafts
}

export function normalizeExperiences(drafts: ExperienceDraft[]): MobilePanelExperience[] {
  return drafts
    .map((item, index) => ({
      id: item.id || `exp_${index}`,
      name: item.name.trim(),
      value: item.value.trim(),
    }))
    .filter((item) => item.name || item.value)
}

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

function toggleTrackValue(track: boolean[], index: number) {
  return track.map((value, currentIndex) => (currentIndex === index ? !value : value))
}

interface AddModalProps {
  isOpen: boolean
  draftCode: string
  draftDisplayName: string
  draftExperiences: ExperienceDraft[]
  onClose: () => void
  onCodeChange: (code: string) => void
  onDisplayNameChange: (name: string) => void
  onExperienceChange: (index: number, key: 'name' | 'value', value: string) => void
  onSubmit: () => void
}

export function MobileAddCharacterModal({
  isOpen,
  draftCode,
  draftDisplayName,
  draftExperiences,
  onClose,
  onCodeChange,
  onDisplayNameChange,
  onExperienceChange,
  onSubmit,
}: AddModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} title="添加角色" maxWidth={640}>
      <div style={{ display: 'grid', gap: 14 }}>
        <textarea
          className="input"
          value={draftCode}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="粘贴角色码"
          rows={5}
          style={{ resize: 'vertical', fontFamily: 'monospace' }}
        />
        <input className="input" value={draftDisplayName} onChange={(event) => onDisplayNameChange(event.target.value)} placeholder="自定义角色名称（可选）" />
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>经历列表</div>
          {draftExperiences.map((item, index) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
              <input className="input" value={item.name} onChange={(event) => onExperienceChange(index, 'name', event.target.value)} placeholder={`经历 ${index + 1}`} />
              <input className="input" value={item.value} onChange={(event) => onExperienceChange(index, 'value', event.target.value)} placeholder="加值" />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" type="button" onClick={onClose}>取消</button>
          <button className="btn btn-primary" type="button" onClick={onSubmit}>
            <UserPlus size={14} /> 导入角色
          </button>
        </div>
      </div>
    </Modal>
  )
}

interface DetailModalProps {
  character: MobilePanelCharacterEntry | null
  onClose: () => void
  onUpdateResource: (id: string, key: string, value: number | boolean[]) => void
}

export function MobileCharacterDetailModal({ character, onClose, onUpdateResource }: DetailModalProps) {
  return (
    <Modal
      open={Boolean(character)}
      onClose={onClose}
      title={character ? getCharacterTitle(character) : '角色详情'}
      maxWidth={720}
    >
      {character && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{getIdentityLine(character)}</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <StatPill label="闪避" value={character.decoded.evasion} />
            <StatPill label="护甲值" value={character.decoded.armor} />
            <StatPill label="重伤阈值" value={character.decoded.damageThresholds.minor} />
            <StatPill label="严重阈值" value={character.decoded.damageThresholds.major} />
            <StatPill label="熟练值" value={character.decoded.proficiency} />
            <StatPill label="金币" value={character.tracker.goldCurrent} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <StatPill label="敏捷" value={character.decoded.attributes.agility} />
            <StatPill label="力量" value={character.decoded.attributes.strength} />
            <StatPill label="灵巧" value={character.decoded.attributes.finesse} />
            <StatPill label="本能" value={character.decoded.attributes.instinct} />
            <StatPill label="风度" value={character.decoded.attributes.presence} />
            <StatPill label="知识" value={character.decoded.attributes.knowledge} />
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>资源追踪</div>
              <NumberAdjuster
                label={`希望点 / ${character.decoded.resources.hopeMax}`}
                value={character.tracker.hopeCurrent}
                max={character.decoded.resources.hopeMax}
                onChange={(value) => onUpdateResource(character.id, 'hopeCurrent', value)}
              />
              <NumberAdjuster
                label="金币"
                value={character.tracker.goldCurrent}
                onChange={(value) => onUpdateResource(character.id, 'goldCurrent', value)}
              />
              <TrackDots
                label={`生命点 / ${character.decoded.resources.hpMax}`}
                values={character.tracker.hp}
                onToggle={(index) => onUpdateResource(character.id, 'hp', toggleTrackValue(character.tracker.hp, index))}
              />
              <TrackDots
                label={`压力点 / ${character.decoded.resources.stressMax}`}
                values={character.tracker.stress}
                onToggle={(index) => onUpdateResource(character.id, 'stress', toggleTrackValue(character.tracker.stress, index))}
              />
              <TrackDots
                label={`护甲槽 / ${character.decoded.resources.armorMax}`}
                values={character.tracker.armor_slots}
                onToggle={(index) => onUpdateResource(character.id, 'armor_slots', toggleTrackValue(character.tracker.armor_slots, index))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <SectionCard icon={<Shield size={14} />} title="职业与社群">
              {character.decoded.specialCards.profession && (
                <InfoBlock title={character.decoded.specialCards.profession.title} body={character.decoded.specialCards.profession.text} />
              )}
              {character.decoded.specialCards.profession?.hopeFeature && (
                <InfoBlock title="希望特性" body={character.decoded.specialCards.profession.hopeFeature} />
              )}
              {character.decoded.specialCards.subclass && (
                <InfoBlock title={character.decoded.specialCards.subclass.title} body={character.decoded.specialCards.subclass.text} />
              )}
              {character.decoded.specialCards.community && (
                <InfoBlock title={character.decoded.specialCards.community.title} body={character.decoded.specialCards.community.text} />
              )}
            </SectionCard>

            <SectionCard icon={<Swords size={14} />} title="种族与领域">
              {character.decoded.specialCards.ancestry1 && (
                <InfoBlock title={character.decoded.specialCards.ancestry1.title} body={character.decoded.specialCards.ancestry1.text} />
              )}
              {character.decoded.specialCards.ancestry2 && (
                <InfoBlock title={character.decoded.specialCards.ancestry2.title} body={character.decoded.specialCards.ancestry2.text} />
              )}
              {character.decoded.domains.map((domain) => (
                <InfoBlock key={domain.id} title={domain.title} body={domain.text} />
              ))}
            </SectionCard>

            <SectionCard icon={<BookText size={14} />} title="经历">
              {character.custom.experiences.length ? character.custom.experiences.map((experience) => (
                <div
                  key={experience.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.84)',
                    border: '1px solid rgba(113, 88, 52, 0.12)',
                  }}
                >
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{experience.name || '未命名经历'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700 }}>{experience.value || '-'}</div>
                </div>
              )) : (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>暂未填写自定义经历。</div>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </Modal>
  )
}

interface EditModalProps {
  character: MobilePanelCharacterEntry | null
  draftDisplayName: string
  draftExperiences: ExperienceDraft[]
  onClose: () => void
  onDisplayNameChange: (name: string) => void
  onExperienceChange: (index: number, key: 'name' | 'value', value: string) => void
  onSubmit: () => void
}

export function MobileEditCharacterModal({
  character,
  draftDisplayName,
  draftExperiences,
  onClose,
  onDisplayNameChange,
  onExperienceChange,
  onSubmit,
}: EditModalProps) {
  return (
    <Modal open={Boolean(character)} onClose={onClose} title="编辑角色信息" maxWidth={640}>
      <div style={{ display: 'grid', gap: 14 }}>
        <input className="input" value={draftDisplayName} onChange={(event) => onDisplayNameChange(event.target.value)} placeholder="自定义角色名称" />
        {draftExperiences.map((item, index) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
            <input className="input" value={item.name} onChange={(event) => onExperienceChange(index, 'name', event.target.value)} placeholder={`经历 ${index + 1}`} />
            <input className="input" value={item.value} onChange={(event) => onExperienceChange(index, 'value', event.target.value)} placeholder="加值" />
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" type="button" onClick={onClose}>取消</button>
          <button className="btn btn-primary" type="button" onClick={onSubmit}>
            <Pencil size={14} /> 保存
          </button>
        </div>
      </div>
    </Modal>
  )
}

interface ReplaceModalProps {
  character: MobilePanelCharacterEntry | null
  replaceCode: string
  onClose: () => void
  onCodeChange: (code: string) => void
  onSubmit: () => void
}

export function MobileReplaceCharacterModal({ character, replaceCode, onClose, onCodeChange, onSubmit }: ReplaceModalProps) {
  return (
    <Modal open={Boolean(character)} onClose={onClose} title="替换角色码" maxWidth={640}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
          替换后会保留当前角色的自定义名称、经历和已追踪的资源进度，并按新角色的上限自动裁剪。
        </div>
        <textarea
          className="input"
          value={replaceCode}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="粘贴新的 dhc3_ 或旧版 dhc2_ 角色码"
          rows={5}
          style={{ resize: 'vertical', fontFamily: 'monospace' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" type="button" onClick={onClose}>取消</button>
          <button className="btn btn-primary" type="button" onClick={onSubmit}>
            <RefreshCw size={14} /> 替换
          </button>
        </div>
      </div>
    </Modal>
  )
}

interface DeleteModalProps {
  character: MobilePanelCharacterEntry | null
  onClose: () => void
  onConfirm: () => void
}

export function MobileDeleteCharacterModal({ character, onClose, onConfirm }: DeleteModalProps) {
  return (
    <Modal open={Boolean(character)} onClose={onClose} title="删除角色" maxWidth={520}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
          {character ? `确认删除「${getCharacterTitle(character)}」吗？此操作会立刻同步给房间内所有成员。` : ''}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" type="button" onClick={onClose}>取消</button>
          <button
            className="btn btn-primary"
            type="button"
            style={{ background: 'linear-gradient(180deg, #b12d3f, #8f1f34)', borderColor: '#8f1f34' }}
            onClick={onConfirm}
          >
            <Trash2 size={14} /> 删除
          </button>
        </div>
      </div>
    </Modal>
  )
}

interface ActivityLogModalProps {
  isOpen: boolean
  logs: Array<{ id: string; created_at: string; actor_name: string; message: string }>
  onClose: () => void
}

export function MobileActivityLogModal({ isOpen, logs, onClose }: ActivityLogModalProps) {
  return (
    <Modal open={isOpen} onClose={onClose} title="活动日志" maxWidth={640}>
      <div style={{ display: 'grid', gap: 10, maxHeight: '70vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
        {logs.length ? [...logs].reverse().map((item) => (
          <div
            key={item.id}
            style={{
              padding: 12,
              border: '1px solid rgba(113, 88, 52, 0.12)',
              background: 'rgba(255,255,255,0.84)',
              display: 'grid',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>{item.actor_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleString()}</div>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{item.message}</div>
          </div>
        )) : (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>还没有活动记录。</div>
        )}
      </div>
    </Modal>
  )
}
