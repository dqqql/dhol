import React, { useCallback, useState } from 'react'
import { CounterLine } from './lines/CounterLine'
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

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null) {
      let targetIndex = dragOverIndex
      if (targetIndex > draggedIndex) {
        targetIndex -= 1
      }

      if (targetIndex !== draggedIndex) {
        onReorderLines(draggedIndex, targetIndex)
      }
    }

    setDraggedIndex(null)
    setDragOverIndex(null)
  }, [draggedIndex, dragOverIndex, onReorderLines])

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null)
  }, [])

  const createDragHandleProps = (index: number): React.HTMLAttributes<HTMLDivElement> => ({
    draggable: true,
    onDragStart: () => handleDragStart(index),
    onDragEnd: handleDragEnd,
  })

  return (
    <div
      className="relative min-h-[260px] px-3 py-2 pl-8"
      style={{
        backgroundImage: `repeating-linear-gradient(
          transparent,
          transparent ${lineHeight - 1}px,
          #B3D4E8 ${lineHeight - 1}px,
          #B3D4E8 ${lineHeight}px
        )`,
        backgroundPosition: '0 6px',
      }}
    >
      {page.lines.length === 0 ? (
        <div className="select-none text-sm italic text-gray-400" style={{ lineHeight: `${lineHeight}px` }}>
          点击下方按钮添加内容...
        </div>
      ) : (
        <div className="relative space-y-0">
          {draggedIndex !== null && dragOverIndex === 0 && (
            <div
              className="-mx-8 h-px bg-teal-400"
              style={{ boxShadow: '0 0 4px rgba(139, 224, 213, 0.85)' }}
            />
          )}

          {page.lines.map((line, index) => (
            <div
              key={line.id}
              className={`group relative transition-all duration-150 ${
                draggedIndex === index ? 'bg-teal-100/50 opacity-50' : ''
              } ${
                draggedIndex !== null && draggedIndex !== index ? 'border-t border-teal-200/60 bg-teal-50/30' : ''
              }`}
              style={{
                minHeight: lineHeight,
                marginLeft: draggedIndex !== null && draggedIndex !== index ? '-32px' : undefined,
                paddingLeft: draggedIndex !== null && draggedIndex !== index ? '32px' : undefined,
              }}
              onDragOver={(event) => {
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                const midY = rect.top + rect.height / 2
                setDragOverIndex(event.clientY < midY ? index : index + 1)
              }}
              onDragLeave={handleDragLeave}
            >
              {draggedIndex !== null && dragOverIndex === index && draggedIndex !== index && (
                <div
                  className="absolute -top-px left-0 right-0 z-10 -mx-8 h-px bg-teal-400"
                  style={{ boxShadow: '0 0 4px rgba(139, 224, 213, 0.85)' }}
                />
              )}

              {draggedIndex !== null && dragOverIndex === index + 1 && draggedIndex !== index && (
                <div
                  className="absolute -bottom-px left-0 right-0 z-10 -mx-8 h-px bg-teal-400"
                  style={{ boxShadow: '0 0 4px rgba(139, 224, 213, 0.85)' }}
                />
              )}

              {line.type === 'text' && (
                <TextLine
                  line={line}
                  lineHeight={lineHeight}
                  onUpdate={(updates) => onUpdateLine(line.id, updates)}
                  onDelete={() => onDeleteLine(line.id)}
                  dragHandleProps={createDragHandleProps(index)}
                />
              )}

              {line.type === 'counter' && (
                <CounterLine
                  line={line}
                  lineHeight={lineHeight}
                  onUpdate={(updates) => onUpdateLine(line.id, updates)}
                  onDelete={() => onDeleteLine(line.id)}
                  dragHandleProps={createDragHandleProps(index)}
                />
              )}
            </div>
          ))}

          {draggedIndex !== null && (
            <div
              className="-mx-8 h-8 px-8"
              onDragOver={(event) => {
                event.preventDefault()
                setDragOverIndex(page.lines.length)
              }}
              onDragLeave={handleDragLeave}
            >
              {dragOverIndex === page.lines.length && (
                <div
                  className="h-px bg-teal-400"
                  style={{ boxShadow: '0 0 4px rgba(139, 224, 213, 0.85)' }}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
