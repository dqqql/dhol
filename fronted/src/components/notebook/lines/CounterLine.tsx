import React, { useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import type { NotebookCounterLine } from '@/types/notebook'

interface CounterLineProps {
  line: NotebookCounterLine
  lineHeight: number
  onUpdate: (updates: Partial<NotebookCounterLine>) => void
  onDelete: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function CounterLine({ line, lineHeight, onUpdate, onDelete, dragHandleProps }: CounterLineProps) {
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [isEditingMax, setIsEditingMax] = useState(false)
  const [editLabel, setEditLabel] = useState(line.label)
  const [editMax, setEditMax] = useState(String(line.max))

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
              onUpdate({ label: editLabel || '计数器' })
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
            {line.label || '计数器'}
          </button>
        )}

        <span style={{ fontSize: 12, color: '#6b7280' }}>
          /
          {isEditingMax ? (
            <input
              value={editMax}
              onChange={(event) => setEditMax(event.target.value)}
              onBlur={() => {
                const nextMax = Math.max(1, Math.min(12, Number.parseInt(editMax, 10) || 6))
                onUpdate({ max: nextMax, current: Math.min(line.current, nextMax) })
                setIsEditingMax(false)
              }}
              className="ml-1 w-10 rounded border border-amber-300 bg-white px-1 py-0.5 text-xs outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingMax(true)}
              style={{ marginLeft: 4, border: 'none', background: 'transparent', color: '#6b7280', fontSize: 12 }}
            >
              {line.max}
            </button>
          )}
        </span>

        <button type="button" onClick={onDelete} className="ml-auto text-gray-400 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2" style={{ minHeight: lineHeight }}>
        <button
          type="button"
          onClick={() => onUpdate({ current: Math.max(0, line.current - 1) })}
          className="rounded p-1 text-gray-500 hover:bg-gray-200"
        >
          <Minus size={14} />
        </button>

        <div className="flex flex-wrap gap-1">
          {Array.from({ length: line.max }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onUpdate({ current: index + 1 === line.current ? 0 : index + 1 })}
              style={{
                width: 16,
                height: 16,
                border: '2px solid #7c4f31',
                background: index < line.current ? '#7c4f31' : 'white',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => onUpdate({ current: Math.min(line.max, line.current + 1) })}
          className="rounded p-1 text-gray-500 hover:bg-gray-200"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}
