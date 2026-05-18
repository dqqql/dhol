import React, { useEffect, useRef, useState } from 'react'
import { Check, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Annotation } from '@/types'
import { useStore } from '@/store/useStore'

interface AnnotationNodeProps {
  annotation: Annotation
  canvasScale: number
  selected: boolean
  editing: boolean
  onSelect: (annotationId: string) => void
  onStartEdit: (annotationId: string) => void
  onStopEdit: () => void
}

const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 48

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function AnnotationNode({
  annotation,
  canvasScale,
  selected,
  editing,
  onSelect,
  onStartEdit,
  onStopEdit,
}: AnnotationNodeProps) {
  const { updateAnnotationLocal, commitAnnotationUpdate, removeAnnotation } = useStore()
  const [draftText, setDraftText] = useState(annotation.text)
  const dragStart = useRef<{ mx: number; my: number; x: number; y: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraftText(annotation.text)
  }, [annotation.id, annotation.text])

  useEffect(() => {
    if (!editing || !textareaRef.current) return
    textareaRef.current.focus()
    textareaRef.current.select()
  }, [editing])

  const saveText = () => {
    const nextText = draftText.trim()
    if (!nextText) {
      removeAnnotation(annotation.id)
      onStopEdit()
      return
    }

    updateAnnotationLocal(annotation.id, { text: nextText })
    commitAnnotationUpdate(annotation.id, { text: nextText })
    onStopEdit()
  }

  const updateFontSize = (delta: number) => {
    const nextFontSize = clamp(annotation.font_size + delta, MIN_FONT_SIZE, MAX_FONT_SIZE)
    updateAnnotationLocal(annotation.id, { font_size: nextFontSize })
    commitAnnotationUpdate(annotation.id, { font_size: nextFontSize })
    onSelect(annotation.id)
  }

  const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (editing || event.button !== 0) return

    event.stopPropagation()
    onSelect(annotation.id)
    dragStart.current = {
      mx: event.clientX,
      my: event.clientY,
      x: annotation.x,
      y: annotation.y,
    }

    const onMove = (moveEvent: MouseEvent) => {
      if (!dragStart.current) return
      const dx = (moveEvent.clientX - dragStart.current.mx) / canvasScale
      const dy = (moveEvent.clientY - dragStart.current.my) / canvasScale

      updateAnnotationLocal(annotation.id, {
        x: dragStart.current.x + dx,
        y: dragStart.current.y + dy,
      })
    }

    const onUp = () => {
      const latest = useStore.getState().room?.annotations.find((item) => item.id === annotation.id)
      if (latest) {
        commitAnnotationUpdate(annotation.id, { x: latest.x, y: latest.y })
      }

      dragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      data-annotation-node="true"
      style={{
        position: 'absolute',
        left: annotation.x,
        top: annotation.y,
        minWidth: editing ? 220 : undefined,
        maxWidth: editing ? 280 : 320,
        zIndex: selected || editing ? 18 : 10,
      }}
      onMouseDown={onMouseDown}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(annotation.id)
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
        onStartEdit(annotation.id)
      }}
    >
      {(selected || editing) && (
        <div
          className="glass-panel-sm"
          style={{
            position: 'absolute',
            left: 0,
            bottom: '100%',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            zIndex: 2,
          }}
        >
          <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24, padding: 0 }} onClick={(event) => {
            event.stopPropagation()
            updateFontSize(-2)
          }} title="缩小字号">
            <Minus size={12} />
          </button>
          <div style={{ minWidth: 38, textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
            {annotation.font_size}px
          </div>
          <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24, padding: 0 }} onClick={(event) => {
            event.stopPropagation()
            updateFontSize(2)
          }} title="放大字号">
            <Plus size={12} />
          </button>
          {!editing && (
            <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24, padding: 0 }} onClick={(event) => {
              event.stopPropagation()
              onStartEdit(annotation.id)
            }} title="编辑标注">
              <Pencil size={12} />
            </button>
          )}
          {editing && (
            <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24, padding: 0 }} onClick={(event) => {
              event.stopPropagation()
              saveText()
            }} title="保存标注">
              <Check size={12} />
            </button>
          )}
          <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24, padding: 0, color: 'var(--accent-rose)' }} onClick={(event) => {
            event.stopPropagation()
            removeAnnotation(annotation.id)
            onStopEdit()
          }} title="删除标注">
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {editing ? (
        <textarea
          ref={textareaRef}
          className="input"
          rows={3}
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          onBlur={saveText}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              saveText()
            }

            if (event.key === 'Escape') {
              event.preventDefault()
              setDraftText(annotation.text)
              onStopEdit()
            }
          }}
          style={{
            minHeight: 104,
            fontSize: annotation.font_size,
            lineHeight: 1.45,
            padding: '12px 14px',
            resize: 'none',
            background: 'rgba(255,255,255,0.98)',
            boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
          }}
        />
      ) : (
        <div
          className="glass-panel-sm"
          style={{
            padding: '10px 12px',
            borderColor: selected ? 'rgba(37,99,235,0.28)' : 'var(--border-subtle)',
            boxShadow: selected ? '0 0 0 3px rgba(37,99,235,0.12), 0 10px 24px rgba(15,23,42,0.08)' : '0 4px 12px rgba(15,23,42,0.06)',
            cursor: 'grab',
          }}
        >
          <div
            style={{
              fontSize: annotation.font_size,
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
              fontWeight: 500,
              letterSpacing: '0.02em',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {annotation.text}
          </div>
        </div>
      )}
    </div>
  )
}
