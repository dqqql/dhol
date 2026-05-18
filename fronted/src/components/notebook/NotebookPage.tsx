import React, { useMemo, useState } from 'react'
import { CounterLine } from './lines/CounterLine'
import { DiceLine } from './lines/DiceLine'
import { TextLine } from './lines/TextLine'
import type { NotebookLine, NotebookPage as NotebookPageType } from '@/types/notebook'

interface NotebookPageProps {
  page: NotebookPageType
  onUpdateLine: (lineId: string, updates: Partial<NotebookLine>) => void
  onDeleteLine: (lineId: string) => void
  onReorderLines: (fromIndex: number, toIndex: number) => void
}

export function NotebookPage({ page, onUpdateLine, onDeleteLine, onReorderLines }: NotebookPageProps) {
  const lineHeight = 28
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const dragHandleProps = useMemo(() => (
    (index: number): React.HTMLAttributes<HTMLDivElement> => ({
      draggable: true,
      onDragStart: () => setDraggedIndex(index),
      onDragEnd: () => {
        if (draggedIndex !== null && dragOverIndex !== null) {
          const targetIndex = dragOverIndex > draggedIndex ? dragOverIndex - 1 : dragOverIndex
          if (targetIndex !== draggedIndex) {
            onReorderLines(draggedIndex, targetIndex)
          }
        }
        setDraggedIndex(null)
        setDragOverIndex(null)
      },
    })
  ), [dragOverIndex, draggedIndex, onReorderLines])

  return (
    <div
      className="relative min-h-[260px] py-2 pl-8 pr-3"
      style={{
        backgroundImage: `repeating-linear-gradient(
          transparent,
          transparent ${lineHeight - 1}px,
          #b3d4e8 ${lineHeight - 1}px,
          #b3d4e8 ${lineHeight}px
        )`,
        backgroundPosition: '0 6px',
      }}
    >
      {page.lines.length === 0 ? (
        <div style={{ lineHeight: `${lineHeight}px`, color: '#94a3b8', fontSize: 13 }}>
          点击下方按钮添加内容...
        </div>
      ) : (
        <div className="space-y-1">
          {page.lines.map((line, index) => (
            <div
              key={line.id}
              className="relative"
              onDragOver={(event) => {
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                const midY = rect.top + rect.height / 2
                setDragOverIndex(event.clientY < midY ? index : index + 1)
              }}
            >
              {draggedIndex !== null && dragOverIndex === index && (
                <div className="absolute left-0 right-0 top-0 h-px bg-amber-500" />
              )}

              {line.type === 'text' && (
                <TextLine
                  line={line}
                  lineHeight={lineHeight}
                  onUpdate={(updates) => onUpdateLine(line.id, updates)}
                  onDelete={() => onDeleteLine(line.id)}
                  dragHandleProps={dragHandleProps(index)}
                />
              )}
              {line.type === 'counter' && (
                <CounterLine
                  line={line}
                  lineHeight={lineHeight}
                  onUpdate={(updates) => onUpdateLine(line.id, updates)}
                  onDelete={() => onDeleteLine(line.id)}
                  dragHandleProps={dragHandleProps(index)}
                />
              )}
              {line.type === 'dice' && (
                <DiceLine
                  line={line}
                  lineHeight={lineHeight}
                  onUpdate={(updates) => onUpdateLine(line.id, updates)}
                  onDelete={() => onDeleteLine(line.id)}
                  dragHandleProps={dragHandleProps(index)}
                />
              )}
            </div>
          ))}

          {draggedIndex !== null && dragOverIndex === page.lines.length && (
            <div className="h-px bg-amber-500" />
          )}
        </div>
      )}
    </div>
  )
}
