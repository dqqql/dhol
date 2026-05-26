import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, X } from 'lucide-react'
import { NotebookPage } from './NotebookPage'
import { NotebookPagination } from './NotebookPagination'
import { NotebookToolbar } from './NotebookToolbar'
import type { NotebookData, NotebookLine, NotebookPage as NotebookPageType } from '@/types/notebook'

const MAX_LINES_PER_PAGE = 10
const MAX_PAGES = 5

const defaultNotebookData: NotebookData = {
  pages: [{ id: 'page-1', lines: [] }],
  currentPageIndex: 0,
  isOpen: false,
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function getStorageKey(roomId: string) {
  return `gm-panel:notebook:${roomId}`
}

function getPositionKey(roomId: string) {
  return `gm-panel:notebook-position:${roomId}`
}

function sanitizeNotebookData(value: NotebookData): NotebookData {
  return {
    ...value,
    pages: value.pages.map((page) => ({
      ...page,
      lines: page.lines.filter((line): line is NotebookLine => line.type === 'text' || line.type === 'counter'),
    })),
  }
}

export function FloatingNotebook({ roomId }: { roomId: string }) {
  const [notebook, setNotebook] = useState<NotebookData>(defaultNotebookData)
  const [position, setPosition] = useState({ x: 72, y: 88 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(roomId))
      const nextNotebook = stored ? JSON.parse(stored) as NotebookData : defaultNotebookData
      setNotebook(isNotebookData(nextNotebook) ? sanitizeNotebookData(nextNotebook) : defaultNotebookData)
    } catch {
      setNotebook(defaultNotebookData)
    }

    try {
      const storedPosition = localStorage.getItem(getPositionKey(roomId))
      if (!storedPosition) return
      const parsed = JSON.parse(storedPosition) as { x?: number; y?: number }
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        setPosition({ x: parsed.x, y: parsed.y })
      }
    } catch {
      // Ignore invalid persisted position.
    }
  }, [roomId])

  useEffect(() => {
    localStorage.setItem(getStorageKey(roomId), JSON.stringify(notebook))
  }, [notebook, roomId])

  useEffect(() => {
    localStorage.setItem(getPositionKey(roomId), JSON.stringify(position))
  }, [position, roomId])

  const updateNotebook = useCallback((updater: (current: NotebookData) => NotebookData) => {
    setNotebook((current) => {
      const next = updater(current)
      return isNotebookData(next) ? sanitizeNotebookData(next) : current
    })
  }, [])

  const updateCurrentPage = useCallback((updater: (page: NotebookPageType) => NotebookPageType) => {
    updateNotebook((current) => {
      const pages = [...current.pages]
      const currentPage = pages[current.currentPageIndex] ?? pages[0] ?? { id: createId(), lines: [] }
      pages[current.currentPageIndex] = updater(currentPage)
      return { ...current, pages }
    })
  }, [updateNotebook])

  const addLine = useCallback((line: NotebookLine) => {
    updateCurrentPage((page) => ({ ...page, lines: [...page.lines, line] }))
  }, [updateCurrentPage])

  const updateLine = useCallback((lineId: string, updates: Partial<NotebookLine>) => {
    updateCurrentPage((page) => ({
      ...page,
      lines: page.lines.map((line) => line.id === lineId ? { ...line, ...updates } as NotebookLine : line),
    }))
  }, [updateCurrentPage])

  const deleteLine = useCallback((lineId: string) => {
    updateCurrentPage((page) => ({
      ...page,
      lines: page.lines.filter((line) => line.id !== lineId),
    }))
  }, [updateCurrentPage])

  const reorderLines = useCallback((fromIndex: number, toIndex: number) => {
    updateCurrentPage((page) => {
      const nextLines = [...page.lines]
      const [moved] = nextLines.splice(fromIndex, 1)
      nextLines.splice(toIndex, 0, moved)
      return { ...page, lines: nextLines }
    })
  }, [updateCurrentPage])

  const addPage = useCallback(() => {
    updateNotebook((current) => {
      if (current.pages.length >= MAX_PAGES) return current
      const nextPages = [...current.pages, { id: createId(), lines: [] }]
      return {
        ...current,
        pages: nextPages,
        currentPageIndex: nextPages.length - 1,
      }
    })
  }, [updateNotebook])

  const deleteCurrentPage = useCallback(() => {
    updateNotebook((current) => {
      if (current.pages.length <= 1) return current
      const nextPages = current.pages.filter((_, index) => index !== current.currentPageIndex)
      return {
        ...current,
        pages: nextPages,
        currentPageIndex: Math.min(current.currentPageIndex, nextPages.length - 1),
      }
    })
  }, [updateNotebook])

  const goToPage = useCallback((index: number) => {
    updateNotebook((current) => (
      index >= 0 && index < current.pages.length
        ? { ...current, currentPageIndex: index }
        : current
    ))
  }, [updateNotebook])

  const toggleOpen = useCallback(() => {
    updateNotebook((current) => ({ ...current, isOpen: !current.isOpen }))
  }, [updateNotebook])

  const currentPage = useMemo(
    () => notebook.pages[notebook.currentPageIndex] ?? notebook.pages[0] ?? defaultNotebookData.pages[0],
    [notebook],
  )

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('.notebook-content')) return
    setIsDragging(true)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: position.x,
      offsetY: position.y,
    }
  }, [position])

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !dragRef.current) return
    const dx = event.clientX - dragRef.current.startX
    const dy = event.clientY - dragRef.current.startY
    setPosition({
      x: Math.max(12, dragRef.current.offsetX + dx),
      y: Math.max(12, dragRef.current.offsetY + dy),
    })
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    dragRef.current = null
  }, [])

  useEffect(() => {
    if (!isDragging) return
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp, isDragging])

  if (!notebook.isOpen) {
    return (
      <button
        type="button"
        onClick={toggleOpen}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 60,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          border: '1px solid rgba(223, 200, 82, 0.36)',
          background: 'linear-gradient(135deg, #fffdf7, #ead8b3)',
          color: '#27185a',
          boxShadow: '0 14px 28px rgba(35, 20, 68, 0.14)',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        <BookOpen size={16} />
        本地笔记
      </button>
    )
  }

  return (
    <div
      className="fixed z-50 print:hidden"
      style={{
        left: position.x,
        top: position.y,
        width: 360,
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          border: '4px solid #27185a',
          background: 'linear-gradient(135deg, #27185a 0%, #180f3b 100%)',
          boxShadow: '0 20px 42px rgba(17, 11, 39, 0.30)',
        }}
      >
        <div
          className="flex cursor-move select-none items-center justify-between px-3 py-2"
          onMouseDown={handleMouseDown}
          style={{
            background: 'linear-gradient(180deg, #27185a 0%, #180f3b 100%)',
            borderBottom: '2px solid rgba(223,200,82,0.34)',
          }}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-200" />
            <span className="text-sm font-medium text-amber-100">本地笔记</span>
          </div>
          <button
            type="button"
            onClick={toggleOpen}
            className="p-1 transition-colors hover:bg-amber-900/50"
          >
            <X className="h-4 w-4 text-amber-200" />
          </button>
        </div>

        <div
          className="notebook-content relative flex flex-col"
          style={{
            height: 400,
            background: '#fff7df',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative flex-1 overflow-x-visible overflow-y-auto">
            <NotebookPage
              page={currentPage}
              onUpdateLine={updateLine}
              onDeleteLine={deleteLine}
              onReorderLines={reorderLines}
            />
          </div>

          <NotebookToolbar
            onAddText={() => addLine({ type: 'text', id: createId(), label: '笔记', content: '' })}
            onAddCounter={() => addLine({ type: 'counter', id: createId(), label: '计数器', current: 0, max: 6 })}
            disabled={currentPage.lines.length >= MAX_LINES_PER_PAGE}
          />
        </div>

        <NotebookPagination
          currentPage={notebook.currentPageIndex}
          totalPages={notebook.pages.length}
          maxPages={MAX_PAGES}
          onGoToPage={goToPage}
          onAddPage={addPage}
          onDeletePage={deleteCurrentPage}
        />
      </div>
    </div>
  )
}

function isNotebookData(value: unknown): value is NotebookData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as NotebookData
  return Array.isArray(candidate.pages)
    && typeof candidate.currentPageIndex === 'number'
    && typeof candidate.isOpen === 'boolean'
}
