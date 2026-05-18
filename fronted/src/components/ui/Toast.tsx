import React from 'react'
import { useStore } from '@/store/useStore'
import type { Toast } from '@/types'
import { X, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

const TOAST_ICONS: Record<Toast['type'], React.ReactNode> = {
  info:    <Info size={14} />,
  success: <CheckCircle size={14} />,
  warning: <AlertTriangle size={14} />,
  error:   <XCircle size={14} />,
}

const TOAST_COLORS: Record<Toast['type'], string> = {
  info:    'var(--accent-cyan)',
  success: 'var(--accent-emerald)',
  warning: 'var(--accent-amber)',
  error:   'var(--accent-rose)',
}

export function ToastContainer() {
  const { toasts, removeToast } = useStore()

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="toast"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span style={{ color: TOAST_COLORS[toast.type], flexShrink: 0 }}>
            {TOAST_ICONS[toast.type]}
          </span>
          <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{toast.message}</span>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            style={{ marginLeft: 4, padding: 2 }}
            onClick={() => removeToast(toast.id)}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
