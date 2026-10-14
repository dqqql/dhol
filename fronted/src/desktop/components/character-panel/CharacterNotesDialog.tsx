import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'

export default function CharacterNotesDialog({ storageKey, name, onClose }: { storageKey: string; name: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: (() => { try { return localStorage.getItem(storageKey) ?? '' } catch { return '' } })(),
    contentType: 'markdown',
    onUpdate: ({ editor: current }) => { try { localStorage.setItem(storageKey, current.getMarkdown()) } catch { /* Local storage may be unavailable. */ } },
  }, [storageKey])

  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close() }, [])

  return <dialog ref={dialog} className="notes-dialog" onCancel={onClose} aria-labelledby="notes-title">
    <div className="notes-dialog__bar"><div><small>本机笔记 · 自动保存</small><h2 id="notes-title">{name}的笔记</h2></div><button type="button" onClick={onClose}>关闭</button></div>
    <div className="notes-dialog__hint">输入 Markdown 快捷格式后按空格，例如「- 」生成列表，「# 」生成标题。</div>
    <EditorContent editor={editor} className="notes-editor" aria-label={`${name}的笔记编辑器`} />
  </dialog>
}
