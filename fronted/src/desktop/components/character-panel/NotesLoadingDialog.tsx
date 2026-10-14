import { useEffect, useRef } from 'react'

export default function NotesLoadingDialog({ name, onClose }: { name: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close() }, [])

  return <dialog ref={dialog} className="notes-dialog notes-dialog--loading" onCancel={onClose} aria-labelledby="notes-loading-title">
    <div className="notes-dialog__bar"><h2 id="notes-loading-title">{name}的笔记</h2><button type="button" onClick={onClose}>关闭</button></div>
    <div className="notes-loading" role="status"><span className="notes-loading__spinner" aria-hidden="true" />正在加载笔记编辑器…</div>
  </dialog>
}
