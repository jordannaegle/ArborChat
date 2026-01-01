// src/renderer/src/components/notifications/Toast.tsx
// Individual toast notification component with progress bar

import { useEffect, useState, useCallback } from 'react'
import {
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Bot
} from 'lucide-react'
import type { Toast as ToastType } from '../../types/notification'
import { cn } from '../../lib/utils'

interface ToastProps {
  toast: ToastType
  onDismiss: () => void
}

// Icon and color mappings by notification type
const typeConfig = {
  info: {
    icon: Info,
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    progressColor: 'bg-blue-500'
  },
  success: {
    icon: CheckCircle2,
    borderColor: 'border-green-500',
    bgColor: 'bg-green-500/10',
    iconColor: 'text-green-500',
    progressColor: 'bg-green-500'
  },
  warning: {
    icon: AlertTriangle,
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    progressColor: 'bg-amber-500'
  },
  error: {
    icon: AlertCircle,
    borderColor: 'border-red-500',
    bgColor: 'bg-red-500/10',
    iconColor: 'text-red-500',
    progressColor: 'bg-red-500'
  },
  agent: {
    icon: Bot,
    borderColor: 'border-violet-500',
    bgColor: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
    progressColor: 'bg-violet-500'
  }
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [progress, setProgress] = useState(100)
  const [isExiting, setIsExiting] = useState(false)

  const config = typeConfig[toast.type]
  const Icon = config.icon

  // Handle dismiss with exit animation
  const handleDismiss = useCallback(() => {
    setIsExiting(true)
    setTimeout(onDismiss, 200) // Match animation duration
  }, [onDismiss])

  // Auto-dismiss with progress tracking
  useEffect(() => {
    if (!toast.duration) return

    const startTime = Date.now()
    const duration = toast.duration

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)

      if (remaining <= 0) {
        clearInterval(interval)
        handleDismiss()
      }
    }, 50)

    return () => clearInterval(interval)
  }, [toast.duration, handleDismiss])

  // Keyboard dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toast.dismissible !== false) {
        handleDismiss()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDismiss, toast.dismissible])

  return (
    <div
      role="alert"
      aria-live={toast.priority === 'high' ? 'assertive' : 'polite'}
      className={cn(
        'relative w-80 overflow-hidden rounded-lg border shadow-lg backdrop-blur-sm',
        'transition-all duration-200 ease-out',
        config.borderColor,
        config.bgColor,
        isExiting
          ? 'translate-x-full opacity-0'
          : 'translate-x-0 opacity-100 animate-in slide-in-from-right'
      )}
    >
      {/* Main content */}
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.iconColor)} />

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-white">{toast.title}</p>
          {toast.message && (
            <p className="mt-1 text-sm text-text-muted line-clamp-2">{toast.message}</p>
          )}
          {toast.action && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toast.action?.onClick()
                handleDismiss()
              }}
              className={cn(
                'mt-2 text-sm font-medium underline-offset-2 hover:underline',
                config.iconColor
              )}
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Dismiss button */}
        {toast.dismissible !== false && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 rounded-md p-1 text-text-muted hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {toast.duration && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div
            className={cn('h-full transition-all duration-100', config.progressColor)}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default Toast
