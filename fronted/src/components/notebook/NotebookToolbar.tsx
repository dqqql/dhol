import React from 'react'
import { Dices, Hash, Type } from 'lucide-react'

interface NotebookToolbarProps {
  onAddText: () => void
  onAddCounter: () => void
  onAddDice: () => void
  disabled?: boolean
}

export function NotebookToolbar({ onAddText, onAddCounter, onAddDice, disabled }: NotebookToolbarProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid rgba(124, 79, 49, 0.18)',
    background: disabled ? 'rgba(255,255,255,0.4)' : 'rgba(255,248,235,0.96)',
    color: disabled ? '#9ca3af' : '#7c4f31',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
    fontWeight: 700,
  }

  return (
    <div
      className="flex items-center justify-center gap-2 px-3 py-2"
      style={{
        borderTop: '1px solid #d7ccc8',
        background: 'rgba(253, 246, 227, 0.88)',
      }}
    >
      <button type="button" onClick={onAddText} disabled={disabled} style={baseStyle}>
        <Type size={14} />
        文本
      </button>
      <button type="button" onClick={onAddCounter} disabled={disabled} style={baseStyle}>
        <Hash size={14} />
        计数器
      </button>
      <button type="button" onClick={onAddDice} disabled={disabled} style={baseStyle}>
        <Dices size={14} />
        骰子
      </button>
    </div>
  )
}
