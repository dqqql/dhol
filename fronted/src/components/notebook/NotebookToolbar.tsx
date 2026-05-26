import React from 'react'
import { Hash, Type } from 'lucide-react'

interface NotebookToolbarProps {
  onAddText: () => void
  onAddCounter: () => void
  disabled?: boolean
}

export function NotebookToolbar({ onAddText, onAddCounter, disabled }: NotebookToolbarProps) {
  const buttonClass = disabled
    ? 'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors text-gray-400 cursor-not-allowed'
    : 'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors hover:bg-teal-100 text-violet-950'

  return (
    <div
      className="flex items-center justify-center gap-2 border-t px-3 py-2"
      style={{
        borderColor: '#d8d3e8',
        backgroundColor: 'rgba(247, 242, 255, 0.82)',
      }}
    >
      {disabled && (
        <span className="mr-2 text-[10px] text-gray-400">已达上限</span>
      )}
      <button
        type="button"
        onClick={onAddText}
        disabled={disabled}
        className={buttonClass}
        title={disabled ? '已达每页上限' : '添加文本'}
      >
        <Type className="h-3.5 w-3.5" />
        <span>文本</span>
      </button>
      <button
        type="button"
        onClick={onAddCounter}
        disabled={disabled}
        className={buttonClass}
        title={disabled ? '已达每页上限' : '添加计数器'}
      >
        <Hash className="h-3.5 w-3.5" />
        <span>计数器</span>
      </button>
    </div>
  )
}
