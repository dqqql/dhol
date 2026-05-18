export interface NotebookTextLine {
  type: 'text'
  id: string
  label: string
  content: string
}

export interface NotebookCounterLine {
  type: 'counter'
  id: string
  label: string
  current: number
  max: number
}

export type NotebookLine = NotebookTextLine | NotebookCounterLine

export interface NotebookPage {
  id: string
  lines: NotebookLine[]
}

export interface NotebookData {
  pages: NotebookPage[]
  currentPageIndex: number
  isOpen: boolean
}
