import React from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'

interface NotebookPaginationProps {
  currentPage: number
  totalPages: number
  maxPages: number
  onGoToPage: (index: number) => void
  onAddPage: () => void
  onDeletePage: () => void
}

export function NotebookPagination({
  currentPage,
  totalPages,
  maxPages,
  onGoToPage,
  onAddPage,
  onDeletePage,
}: NotebookPaginationProps) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2"
      style={{
        background: 'linear-gradient(180deg, #4e342e 0%, #3e2723 100%)',
        borderTop: '2px solid #3e2723',
      }}
    >
      <button
        type="button"
        onClick={onDeletePage}
        disabled={totalPages <= 1}
        style={buttonStyle(totalPages <= 1)}
        title="删除当前页"
      >
        <Trash2 size={14} />
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onGoToPage(currentPage - 1)}
          disabled={currentPage <= 0}
          style={buttonStyle(currentPage <= 0)}
          title="上一页"
        >
          <ChevronLeft size={14} />
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onGoToPage(index)}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                border: 'none',
                background: index === currentPage ? '#fde68a' : '#8d6e63',
                cursor: 'pointer',
                transform: index === currentPage ? 'scale(1.25)' : 'none',
              }}
              title={`第 ${index + 1} 页`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => onGoToPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          style={buttonStyle(currentPage >= totalPages - 1)}
          title="下一页"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <button
        type="button"
        onClick={onAddPage}
        disabled={totalPages >= maxPages}
        style={buttonStyle(totalPages >= maxPages)}
        title={`新增页面 (${totalPages}/${maxPages})`}
      >
        <Plus size={14} />
      </button>
    </div>
  )
}

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: disabled ? '#6d4c41' : '#fde68a',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
