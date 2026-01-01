// src/renderer/src/components/notifications/ToastContainer.tsx
// Fixed-position container for toast notifications

import { Toast } from './Toast'
import type { Toast as ToastType } from '../../types/notification'

interface ToastContainerProps {
  toasts: ToastType[]
  onDismiss: (id: string) => void
  maxVisible?: number
}

export function ToastContainer({ 
  toasts, 
  onDismiss, 
  maxVisible = 5 
}: ToastContainerProps) {
  // Sort by priority (high first) then by creation time (newest first)
  const sortedToasts = [...toasts].sort((a, b) => {
    const priorityOrder = { high: 0, normal: 1, low: 2 }
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return b.createdAt - a.createdAt
  })

  const visibleToasts = sortedToasts.slice(0, maxVisible)
  const hiddenCount = toasts.length - visibleToasts.length

  return (
    <div 
      className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2"
      aria-label="Notifications"
      role="region"
    >
      {/* Hidden count indicator */}
      {hiddenCount > 0 && (
        <div className="text-center text-xs text-text-muted">
          +{hiddenCount} more notification{hiddenCount > 1 ? 's' : ''}
        </div>
      )}

      {/* Visible toasts */}
      {visibleToasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  )
}

export default ToastContainer
