import { useState } from 'react'
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
  const [formOpen, setFormOpen] = useState(() => library.length === 0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EnemyFormState>(DEFAULT_FORM)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')

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

  return (
    <div
      className="modal-overlay show"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enemy-library-title"
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-box enemy-library-modal">
        <div className="modal-bar">
          <div className="enemy-library-bar-title">
            <h2 id="enemy-library-title">战斗 · 敌人库</h2>
            <span className="enemy-library-badge">库 {library.length}</span>
            <span className="enemy-library-badge enemy-library-badge--red">手牌 {handCount}</span>
          </div>
          <div className="enemy-library-bar-actions">
            <button type="button" className="button--primary" onClick={openCreate}>+ 新建敌人</button>
            <button
              type="button"
              className="button--ghost"
              onClick={() => setHint('批量导入功能将在下一步版本中支持（将支持预设区间与文本/JSON 导入）。')}
            >
              批量导入
            </button>
            {handCount > 0 && (
              <button
                type="button"
                className="button--ghost"
                onClick={() => {
                  onClearHand()
                  setHint('已清空当前手牌。')
                }}
              >
                清空手牌
              </button>
            )}
            <button type="button" onClick={onClose}>关闭</button>
          </div>
        </div>

        <div className="modal-content enemy-library-body">
          {hint && (
            <div className="enemy-library-hint" role="status">
              <span>{hint}</span>
              <button type="button" onClick={() => setHint('')}>关闭提示</button>
            </div>
          )}

          {formOpen && (
            <form
              className="enemy-form-card"
              onSubmit={event => {
                event.preventDefault()
                submitForm(false)
              }}
            >
              <div className="enemy-form-head">
                <h3>{editingId ? '编辑敌人模板' : '新建敌人'}</h3>
                <button type="button" className="button--ghost" onClick={() => { setFormOpen(false); setError('') }}>收起</button>
              </div>
              <div className="enemy-form-grid">
                <label className="enemy-field enemy-field--wide">
                  <span>名字</span>
                  <input
                    autoFocus
                    maxLength={48}
                    placeholder="例如：蛮力丧尸"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </label>
                <label className="enemy-field">
                  <span>生命点</span>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    step={1}
                    value={form.hpMax}
                    onChange={e => setForm(prev => ({ ...prev, hpMax: e.target.value }))}
                  />
                </label>
                <label className="enemy-field">
                  <span>压力点</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={1}
                    value={form.stressMax}
                    onChange={e => setForm(prev => ({ ...prev, stressMax: e.target.value }))}
                  />
                </label>
                <label className="enemy-field">
                  <span>重度阈值</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    step={1}
                    value={form.majorThreshold}
                    onChange={e => setForm(prev => ({ ...prev, majorThreshold: e.target.value }))}
                  />
                </label>
                <label className="enemy-field">
                  <span>严重阈值</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    step={1}
                    value={form.severeThreshold}
                    onChange={e => setForm(prev => ({ ...prev, severeThreshold: e.target.value }))}
                  />
                </label>
                <label className="enemy-field">
                  <span>难度</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    step={1}
                    value={form.difficulty}
                    onChange={e => setForm(prev => ({ ...prev, difficulty: e.target.value }))}
                  />
                </label>
                <label className="enemy-field">
                  <span>攻击加值</span>
                  <input
                    type="number"
                    min={-50}
                    max={100}
                    step={1}
                    value={form.attackModifier}
                    onChange={e => setForm(prev => ({ ...prev, attackModifier: e.target.value }))}
                  />
                </label>
                <label className="enemy-field enemy-field--wide">
                  <span>伤害骰（支持骰池或固定值，如 1d8+3、2d6+1d4、4）</span>
                  <input
                    placeholder="1d8+3"
                    value={form.damageFormula}
                    onChange={e => setForm(prev => ({ ...prev, damageFormula: e.target.value }))}
                  />
                  <small className={`enemy-formula-preview ${parsedPreview.kind === 'error' ? 'is-error' : ''}`}>
                    {parsedPreview.kind === 'error'
                      ? parsedPreview.message
                      : parsedPreview.kind === 'flat'
                        ? `固定伤害：${parsedPreview.normalized}`
                        : `解析公式：${parsedPreview.normalized}`}
                  </small>
                </label>
              </div>

              {error && <p className="enemy-form-error" role="alert">{error}</p>}

              <div className="enemy-form-actions">
                <button type="button" onClick={() => { setFormOpen(false); setError('') }}>取消</button>
                <button type="submit">仅保存到库</button>
                <button type="button" className="btn-enemy-primary" onClick={() => submitForm(true)}>
                  保存并加入手牌
                </button>
              </div>
            </form>
          )}

          {library.length === 0 ? (
            <div className="enemy-library-empty">
              <p>敌人库暂无敌人，点击上方「+ 新建敌人」创建你的第一张敌人卡。</p>
            </div>
          ) : (
            <div className="enemy-library-list">
              {library.map(item => (
                <article key={item.id} className="enemy-lib-row">
                  <div className="enemy-lib-main">
                    <div className="enemy-lib-name-row">
                      <strong>{item.name}</strong>
                      <span className="enemy-lib-diff">难度 {item.difficulty}</span>
                    </div>
                    <div className="enemy-lib-stats">
                      <span>生命 <b>{item.hpMax}</b></span>
                      <span>压力 <b>{item.stressMax}</b></span>
                      <span>阈值 <b>{item.majorThreshold}/{item.severeThreshold}</b></span>
                      <span>命中 <b>{formatSignedModifier(item.attackModifier)}</b></span>
                      <span>伤害 <b>{item.damageFormula}</b></span>
                    </div>
                  </div>
                  <div className="enemy-lib-actions">
                    <button
                      type="button"
                      className="btn-enemy-primary"
                      onClick={() => {
                        onAddToHand(item)
                        setHint(`已将【${item.name}】加入底部手牌。`)
                      }}
                    >
                      加入手牌
                    </button>
                    <button type="button" onClick={() => onDuplicateTemplate(item.id)}>复制</button>
                    <button type="button" onClick={() => openEdit(item)}>编辑</button>
                    <button
                      type="button"
                      className="button--danger"
                      onClick={() => onDeleteTemplate(item.id)}
                    >
                      删除
                    </button>
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
