import React, { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { NotebookTextLine } from '@/types/notebook'

interface TextLineProps {
  line: NotebookTextLine
  lineHeight: number
  onUpdate: (updates: Partial<NotebookTextLine>) => void
  onDelete: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function TextLine({ line, lineHeight, onUpdate, onDelete, dragHandleProps }: TextLineProps) {
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editLabel, setEditLabel] = useState(line.label)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${Math.max(lineHeight, textareaRef.current.scrollHeight)}px`
  }, [line.content, lineHeight])

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
              onUpdate({ label: editLabel || '笔记' })
              setIsEditingLabel(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onUpdate({ label: editLabel || '笔记' })
                setIsEditingLabel(false)
              }
            }}
            className="rounded border border-amber-300 bg-white px-1 py-0.5 text-xs outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingLabel(true)}
            style={{ border: 'none', background: 'transparent', color: '#7c4f31', fontSize: 12, fontWeight: 700 }}
          >
            {line.label || '笔记'}
          </button>
        )}

        <button type="button" onClick={onDelete} className="ml-auto text-gray-400 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={line.content}
        onChange={(event) => onUpdate({ content: event.target.value })}
        placeholder="输入文本..."
        style={{
          width: '100%',
          resize: 'none',
          border: 'none',
          background: 'transparent',
          outline: 'none',
          padding: 0,
          fontSize: 14,
          lineHeight: `${lineHeight}px`,
          color: '#1f2937',
        }}
      />
    </div>
  )
}
