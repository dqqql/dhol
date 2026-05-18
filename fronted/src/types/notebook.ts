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

export interface NotebookDie {
  sides: number
  value: number
}

export interface NotebookDiceLine {
  type: 'dice'
  id: string
  label: string
  dice: NotebookDie[]
}

export type NotebookLine = NotebookTextLine | NotebookCounterLine | NotebookDiceLine

export interface NotebookPage {
  id: string
  lines: NotebookLine[]
}

export interface NotebookData {
  pages: NotebookPage[]
  currentPageIndex: number
  isOpen: boolean
}
