import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { nodeInputRule } from '@tiptap/core'
import HorizontalRule from '@tiptap/extension-horizontal-rule'

const FourStarRule = HorizontalRule.extend({
  addInputRules() { return [nodeInputRule({ find: /^\*{4}\s$/, type: this.type })] },
})

function loadNote(key: string): string {
  try { return localStorage.getItem(key) ?? '' } catch { return '' }
}

export default function CharacterNotesDialog({ storageKey, name, onClose }: { storageKey: string; name: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const editor = useEditor({
    extensions: [StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      blockquote: false, code: false, codeBlock: false, hardBreak: false,
      italic: false, link: false, orderedList: false, strike: false, underline: false,
      horizontalRule: false,
    }), FourStarRule, Markdown],
    content: loadNote(storageKey),
    contentType: 'markdown',
    onUpdate: () => { setDirty(true); setSaveError(false) },
  }, [storageKey])

  function save() {
    if (!editor) return
    try { localStorage.setItem(storageKey, editor.getMarkdown()); setDirty(false); setSaveError(false) }
    catch { setSaveError(true) }
  }

  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close() }, [])

  return <dialog ref={dialog} className="notes-dialog" onCancel={onClose} aria-labelledby="notes-title">
    <div className="notes-dialog__bar"><div><small>本机笔记 · {dirty ? '未保存' : '已保存'}</small><h2 id="notes-title">{name}的笔记</h2></div><div className="notes-dialog__actions"><button type="button" className="button--primary" disabled={!editor || !dirty} onClick={save}>保存</button><button type="button" onClick={onClose}>关闭</button></div></div>
    <div className="notes-dialog__hint" aria-label="支持的 Markdown 格式"><span># 一级标题</span><span>## 二级标题</span><span>### 三级标题</span><span>- 列表</span><span>**文字** 加粗</span><span>**** 分隔线</span></div>
    {saveError && <p className="notes-dialog__error" role="alert">保存失败，请检查浏览器存储空间。</p>}
    {editor ? <EditorContent editor={editor} className="notes-editor" aria-label={`${name}的笔记编辑器`} /> : <div className="notes-loading" role="status"><span className="notes-loading__spinner" aria-hidden="true" />正在加载笔记编辑器…</div>}
  </dialog>
}
