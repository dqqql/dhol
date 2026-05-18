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
  const canAddPage = totalPages < maxPages
  const canDeletePage = totalPages > 1

  return (
    <div
      className="flex items-center justify-between px-3 py-2"
      style={{
        background: 'linear-gradient(180deg, #4E342E 0%, #3E2723 100%)',
        borderTop: '2px solid #3E2723',
      }}
    >
      <div className="w-20">
        {canDeletePage && (
          <button
            type="button"
            onClick={onDeletePage}
            className="p-1.5 text-amber-300/60 transition-colors hover:text-red-400"
            title="删除当前页"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onGoToPage(currentPage - 1)}
          disabled={currentPage <= 0}
          className="p-1 text-amber-200 transition-colors hover:text-amber-100 disabled:cursor-not-allowed disabled:text-amber-900"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1">
          {Array(totalPages).fill(0).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onGoToPage(index)}
              className={`h-2 w-2 rounded-full transition-all ${
                index === currentPage
                  ? 'bg-amber-200 scale-125'
                  : 'bg-amber-800 hover:bg-amber-600'
              }`}
              title={`第 ${index + 1} 页`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => onGoToPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          className="p-1 text-amber-200 transition-colors hover:text-amber-100 disabled:cursor-not-allowed disabled:text-amber-900"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex w-20 justify-end">
        {canAddPage && (
          <button
            type="button"
            onClick={onAddPage}
            className="p-1.5 text-amber-300/60 transition-colors hover:text-amber-100"
            title={`添加新页 (${totalPages}/${maxPages})`}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
