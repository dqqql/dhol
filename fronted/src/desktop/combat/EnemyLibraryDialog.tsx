import { useEffect, useRef, useState } from 'react'
import { formatSignedModifier, parseDamageFormula } from './damage-formula'
import type { EnemyTemplate } from './enemy-types'

interface EnemyFormState {
  name: string
  hpMax: string
  stressMax: string
  majorThreshold: string
  severeThreshold: string
  difficulty: string
  attackModifier: string
  damageFormula: string
}

const DEFAULT_FORM: EnemyFormState = {
  name: '',
  hpMax: '6',
  stressMax: '3',
  majorThreshold: '6',
  severeThreshold: '12',
  difficulty: '12',
  attackModifier: '2',
  damageFormula: '1d8+2',
}

function formFromTemplate(item: EnemyTemplate): EnemyFormState {
  return {
    name: item.name,
    hpMax: String(item.hpMax),
    stressMax: String(item.stressMax),
    majorThreshold: String(item.majorThreshold),
    severeThreshold: String(item.severeThreshold),
    difficulty: String(item.difficulty),
    attackModifier: String(item.attackModifier),
    damageFormula: item.damageFormula,
  }
}

export default function EnemyLibraryDialog({
  library,
  handCount,
  onClose,
  onSaveTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onAddToHand,
  onClearHand,
}: {
  library: EnemyTemplate[]
  handCount: number
  onClose: () => void
  onSaveTemplate: (draft: Omit<EnemyTemplate, 'id' | 'createdAt'>, editingId: string | null, alsoAddToHand: boolean) => void
  onDuplicateTemplate: (id: string) => void
  onDeleteTemplate: (id: string) => void
  onAddToHand: (template: EnemyTemplate) => void
  onClearHand: () => void
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EnemyFormState>(DEFAULT_FORM)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')

  const editorRef = useRef<HTMLDivElement>(null)
  const createButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!formOpen) return
    editorRef.current?.querySelector('input')?.focus()
    const close = () => { setFormOpen(false); setError('') }
    const outside = (event: PointerEvent) => {
      if (!editorRef.current?.contains(event.target as Node)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
        createButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
    }
  }, [formOpen, editingId])

  function openCreate() {
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setError('')
    setFormOpen(true)
  }

  function openEdit(item: EnemyTemplate) {
    setEditingId(item.id)
    setForm(formFromTemplate(item))
    setError('')
    setFormOpen(true)
  }

  function submitForm(alsoAddToHand: boolean) {
    const name = form.name.trim()
    if (!name) {
      setError('请填写敌人名字。')
      return
    }

    const hpMax = Number(form.hpMax)
    const stressMax = Number(form.stressMax)
    const majorThreshold = Number(form.majorThreshold)
    const severeThreshold = Number(form.severeThreshold)
    const difficulty = Number(form.difficulty)
    const attackModifier = Number(form.attackModifier)

    if (!Number.isInteger(hpMax) || hpMax < 1 || hpMax > 30) {
      setError('生命点需为 1 ~ 30 的整数。')
      return
    }
    if (!Number.isInteger(stressMax) || stressMax < 0 || stressMax > 20) {
      setError('压力点需为 0 ~ 20 的整数。')
      return
    }
    if (!Number.isInteger(majorThreshold) || majorThreshold < 0 || !Number.isInteger(severeThreshold) || severeThreshold < 0) {
      setError('伤害阈值需为非负整数。')
      return
    }
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 99) {
      setError('难度需为 1 ~ 99 的整数。')
      return
    }
    if (!Number.isInteger(attackModifier) || attackModifier < -50 || attackModifier > 100) {
      setError('攻击加值需为整数（例如 2 或 -1）。')
      return
    }

    const parsedDamage = parseDamageFormula(form.damageFormula)
    if (parsedDamage.kind === 'error') {
      setError(parsedDamage.message)
      return
    }

    onSaveTemplate(
      {
        name: name.slice(0, 48),
        hpMax,
        stressMax,
        majorThreshold,
        severeThreshold,
        difficulty,
        attackModifier,
        damageFormula: parsedDamage.normalized.replace(/\s+/g, ''),
      },
      editingId,
      alsoAddToHand
    )

    setFormOpen(false)
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setError('')
    setHint(alsoAddToHand ? `已保存【${name}】并加入底部手牌。` : `已保存【${name}】到敌人库。`)
  }

  const parsedPreview = parseDamageFormula(form.damageFormula)

  function field(key: keyof EnemyFormState, label: string, min?: number, max?: number) {
    return <label className="enemy-field">
      <span>{label}</span>
      <input type={min === undefined ? 'text' : 'number'} min={min} max={max} step={min === undefined ? undefined : 1}
        maxLength={key === 'name' ? 48 : undefined} value={form[key]}
        placeholder={key === 'name' ? '例如：蛮力丧尸' : key === 'damageFormula' ? '1d8+2' : undefined}
        onChange={event => setForm(prev => ({ ...prev, [key]: event.target.value }))} />
    </label>
  }

  return (
    <div className="modal-overlay show" role="dialog" aria-modal="true" aria-labelledby="enemy-library-title"
      onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal-box enemy-library-modal">
        <div className="modal-bar">
          <div className="enemy-library-bar-title">
            <h2 id="enemy-library-title">敌人库</h2>
            <span className="enemy-library-badge">库 {library.length}</span>
            <span className="enemy-library-badge enemy-library-badge--red">手牌 {handCount}</span>
          </div>
          <div className="enemy-library-bar-actions">
            <div className="enemy-editor-anchor" ref={editorRef}>
              <button ref={createButtonRef} type="button" className="button--primary" aria-expanded={formOpen}
                aria-controls="enemy-editor" onClick={() => formOpen ? setFormOpen(false) : openCreate()}>+ 添加敌人</button>
              {formOpen && (
                <form id="enemy-editor" className="enemy-form-popover enemy-card-face" aria-label={editingId ? '编辑敌人' : '添加敌人'}
                  onSubmit={event => { event.preventDefault(); submitForm(false) }}>
                  <div className="enemy-editor-heading">
                    <strong>{editingId ? '编辑敌人' : '添加敌人'}</strong>
                    <button type="button" aria-label="关闭敌人编辑" onClick={() => setFormOpen(false)}>×</button>
                  </div>
                  <header className="enemy-card-head">
                    {field('name', '名字')}
                    <div className="enemy-card-hp-strip" aria-hidden="true"><span style={{ width: '100%' }} /></div>
                  </header>
                  <div className="enemy-card-combat-stats">
                    {field('attackModifier', '命中加值', -50, 100)}
                    {field('damageFormula', '伤害骰')}
                    <div className="enemy-threshold-fields">
                      {field('majorThreshold', '重度阈值', 0, 999)}
                      {field('severeThreshold', '严重阈值', 0, 999)}
                    </div>
                    {field('difficulty', '难度', 1, 99)}
                  </div>
                  <div className="enemy-card-tracks">
                    {(['hpMax', 'stressMax'] as const).map(key => (
                      <div key={key} className="enemy-editor-track">
                        {field(key, key === 'hpMax' ? '生命点' : '压力点', key === 'hpMax' ? 1 : 0, key === 'hpMax' ? 30 : 20)}
                        <div className="enemy-track-pips" aria-hidden="true">
                          {Array.from({ length: Math.min(key === 'hpMax' ? 30 : 20, Math.max(0, Number(form[key]) || 0)) }, (_, i) =>
                            <span key={i} className={`enemy-pip enemy-pip--${key === 'hpMax' ? 'hp' : 'stress'}`} />)}
                        </div>
                      </div>
                    ))}
                    <small className={`enemy-formula-preview ${parsedPreview.kind === 'error' ? 'is-error' : ''}`}>
                      {parsedPreview.kind === 'error' ? parsedPreview.message : `伤害：${parsedPreview.normalized}`}
                    </small>
                    {error && <p className="enemy-form-error" role="alert">{error}</p>}
                    <div className="enemy-form-actions">
                      <button type="submit">保存到库</button>
                      <button type="button" className="btn-enemy-primary" onClick={() => submitForm(true)}>保存并加入手牌</button>
                    </div>
                  </div>
                </form>
              )}
            </div>
            {handCount > 0 && <button type="button" onClick={() => { onClearHand(); setHint('已清空当前手牌。') }}>清空手牌</button>}
            <button type="button" onClick={onClose}>关闭</button>
          </div>
        </div>
        <div className="modal-content enemy-library-body">
          {hint && <div className="enemy-library-hint" role="status"><span>{hint}</span><button type="button" onClick={() => setHint('')}>关闭提示</button></div>}
          {library.length === 0 ? <div className="enemy-library-empty"><p>敌人库暂无敌人，点击「+ 添加敌人」创建第一张敌人卡。</p></div> : (
            <div className="enemy-library-list">
              {library.map(item => (
                <article key={item.id} className="enemy-lib-row">
                  <div className="enemy-card-face">
                    <header className="enemy-card-head">
                      <div className="enemy-card-title-wrap"><strong className="enemy-card-name">{item.name}</strong><span className="enemy-card-mini-hp">{item.hpMax}/{item.hpMax}</span></div>
                      <div className="enemy-card-hp-strip" aria-hidden="true"><span style={{ width: '100%' }} /></div>
                    </header>
                    <div className="enemy-card-combat-stats">
                      <div className="enemy-stat-cell"><span>命中加值</span><b>{formatSignedModifier(item.attackModifier)}</b></div>
                      <div className="enemy-stat-cell"><span>伤害骰</span><b>{item.damageFormula}</b></div>
                      <div className="enemy-stat-cell"><span>阈值(重/严)</span><b>{item.majorThreshold} / {item.severeThreshold}</b></div>
                      <div className="enemy-stat-cell"><span>难度</span><b>{item.difficulty}</b></div>
                    </div>
                    <div className="enemy-card-tracks">
                      {([['生命', item.hpMax, 'hp'], ['压力', item.stressMax, 'stress']] as const).map(([label, max, resource]) => (
                        <div className="enemy-track-row" key={resource}>
                          <div className="enemy-track-label"><span>{label}</span><b>0/{max}</b></div>
                          <div className="enemy-track-pips" aria-hidden="true">{Array.from({ length: max }, (_, i) => <span key={i} className={`enemy-pip enemy-pip--${resource}`} />)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="enemy-lib-actions">
                    <button type="button" className="btn-enemy-primary" onClick={() => { onAddToHand(item); setHint(`已将【${item.name}】加入底部手牌。`) }}>加入手牌</button>
                    <button type="button" onClick={() => onDuplicateTemplate(item.id)}>复制</button>
                    <button type="button" onClick={() => openEdit(item)}>编辑</button>
                    <button type="button" className="button--danger" onClick={() => onDeleteTemplate(item.id)}>删除</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
