import React, { useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { NotebookDiceLine, NotebookDie } from '@/types/notebook'

const DICE_TYPES = [4, 6, 8, 10, 12, 20] as const

interface DiceLineProps {
  line: NotebookDiceLine
  lineHeight: number
  onUpdate: (updates: Partial<NotebookDiceLine>) => void
  onDelete: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function DiceLine({ line, lineHeight, onUpdate, onDelete, dragHandleProps }: DiceLineProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editLabel, setEditLabel] = useState(line.label)

  const updateDie = (index: number, value: number) => {
    const nextDice = [...line.dice]
    nextDice[index] = { ...nextDice[index], value }
    onUpdate({ dice: nextDice })
  }

  const rollDie = (die: NotebookDie, index: number) => {
    updateDie(index, Math.floor(Math.random() * die.sides) + 1)
  }

  const rollAll = () => {
    onUpdate({
      dice: line.dice.map((die) => ({
        ...die,
        value: Math.floor(Math.random() * die.sides) + 1,
      })),
    })
  }

  return (
    <div className="relative">
      <div
        {...dragHandleProps}
        className="absolute -left-8 bottom-0 top-0 w-6 cursor-grab rounded hover:bg-amber-100/40"
        title="拖拽排序"
      />

      <div className="flex items-center gap-2" style={{ minHeight: lineHeight }}>
        {isEditingLabel ? (
          <input
            value={editLabel}
            onChange={(event) => setEditLabel(event.target.value)}
            onBlur={() => {
              onUpdate({ label: editLabel || '骰子' })
              setIsEditingLabel(false)
            }}
            className="rounded border border-amber-300 bg-white px-1 py-0.5 text-xs outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingLabel(true)}
            style={{ border: 'none', background: 'transparent', color: '#7c4f31', fontSize: 12, fontWeight: 700 }}
          >
            {line.label || '骰子'}
          </button>
        )}

        <button type="button" onClick={rollAll} className="rounded p-1 text-gray-500 hover:bg-gray-200" title="全部重掷">
          <RefreshCw size={14} />
        </button>

        <button type="button" onClick={onDelete} className="ml-auto text-gray-400 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-2" style={{ minHeight: lineHeight * 2 }}>
        {line.dice.map((die, index) => (
          <div key={`${die.sides}-${index}`} className="relative">
            <button
              type="button"
              onClick={() => rollDie(die, index)}
              style={{
                width: 44,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                border: '2px solid #8b7355',
                background: 'linear-gradient(135deg, #f8f1d9 0%, #ddd8c4 100%)',
                color: '#7c4f31',
                fontWeight: 800,
                cursor: 'pointer',
              }}
              title="点击重掷"
            >
              {die.value}
            </button>
            <div style={{ marginTop: 4, textAlign: 'center', fontSize: 10, color: '#6b7280' }}>d{die.sides}</div>
          </div>
        ))}

        {line.dice.length < 6 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAdding((current) => !current)}
              style={{
                width: 44,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed #cbd5e1',
                background: 'rgba(255,255,255,0.7)',
                color: '#6b7280',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
            </button>
            {isAdding && (
              <div
                className="absolute left-0 top-full z-10 mt-2 flex gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
              >
                {DICE_TYPES.map((sides) => (
                  <button
                    key={sides}
                    type="button"
                    onClick={() => {
                      const nextDie: NotebookDie = { sides, value: Math.floor(Math.random() * sides) + 1 }
                      onUpdate({ dice: [...line.dice, nextDie] })
                      setIsAdding(false)
                    }}
                    className="rounded px-2 py-1 text-xs hover:bg-amber-50"
                  >
                    d{sides}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
