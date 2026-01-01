// src/renderer/src/contexts/NotificationContext.tsx
// Context for managing toast notifications, history, and DND (Phase 5-6)

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect
} from 'react'
import type {
  Toast,
  NotificationPreferences,
  DesktopNotificationPayload,
  ArchivedNotification,
  DNDSettings
} from '../types/notification'
import { 
  DEFAULT_NOTIFICATION_PREFERENCES, 
  TOAST_DURATIONS,
  NOTIFICATION_HISTORY_LIMIT 
} from '../types/notification'

// ID generation
let toastIdCounter = 0
function generateToastId(): string {
  return `toast-${++toastIdCounter}-${Date.now()}`
}

// Storage keys
const PREFERENCES_KEY = 'arborchat:notification-preferences'
const HISTORY_KEY = 'arborchat:notification-history'

// State type
interface NotificationState {
  toasts: Toast[]
  history: ArchivedNotification[]
  preferences: NotificationPreferences
}

// Action types
type NotificationAction =
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'DISMISS_TOAST'; payload: string }
  | { type: 'CLEAR_ALL_TOASTS' }
  | { type: 'UPDATE_PREFERENCES'; payload: Partial<NotificationPreferences> }
  | { type: 'SET_PREFERENCES'; payload: NotificationPreferences }
  | { type: 'ADD_TO_HISTORY'; payload: ArchivedNotification }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'SET_HISTORY'; payload: ArchivedNotification[] }
  | { type: 'SET_DND'; payload: Partial<DNDSettings> }

// Initial state
const initialState: NotificationState = {
  toasts: [],
  history: [],
  preferences: DEFAULT_NOTIFICATION_PREFERENCES
}

// Reducer
function notificationReducer(
  state: NotificationState,
  action: NotificationAction
): NotificationState {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.payload]
      }

    case 'DISMISS_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload)
      }

    case 'CLEAR_ALL_TOASTS':
      return {
        ...state,
        toasts: []
      }

    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload,
          events: {
            ...state.preferences.events,
            ...(action.payload.events || {})
          },
          dnd: {
            ...state.preferences.dnd,
            ...(action.payload.dnd || {})
          }
        }
      }

    case 'SET_PREFERENCES':
      return {
        ...state,
        preferences: action.payload
      }

    case 'ADD_TO_HISTORY': {
      const newHistory = [action.payload, ...state.history]
        .slice(0, NOTIFICATION_HISTORY_LIMIT)
      return {
        ...state,
        history: newHistory
      }
    }

    case 'CLEAR_HISTORY':
      return {
        ...state,
        history: []
      }

    case 'SET_HISTORY':
      return {
        ...state,
        history: action.payload
      }

    case 'SET_DND':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          dnd: {
            ...state.preferences.dnd,
            ...action.payload
          }
        }
      }

    default:
      return state
  }
}

/**
 * Check if DND is currently active based on settings
 */
function isDNDActive(dnd: DNDSettings): boolean {
  // Manual DND override
  if (dnd.enabled) return true
  
  // No schedule defined
  if (!dnd.schedule) return false
  
  const now = new Date()
  const currentDay = now.getDay()
  const currentTime = now.getHours() * 60 + now.getMinutes()
  
  // Check if today is in scheduled days
  if (!dnd.schedule.days.includes(currentDay)) return false
  
  // Parse schedule times
  const [startH, startM] = dnd.schedule.start.split(':').map(Number)
  const [endH, endM] = dnd.schedule.end.split(':').map(Number)
  const startTime = startH * 60 + startM
  const endTime = endH * 60 + endM
  
  // Handle overnight schedules (e.g., 22:00 - 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime
  }
  
  return currentTime >= startTime && currentTime < endTime
}

// Context type
interface NotificationContextType {
  // Toast state
  toasts: Toast[]

  // Toast management
  showToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string
  dismissToast: (id: string) => void
  clearAllToasts: () => void

  // Convenience methods
  success: (title: string, message?: string) => string
  error: (title: string, message?: string) => string
  warning: (title: string, message?: string) => string
  info: (title: string, message?: string) => string
  agentNotify: (title: string, message?: string, agentId?: string) => string

  // Preferences
  preferences: NotificationPreferences
  updatePreferences: (updates: Partial<NotificationPreferences>) => void

  // Desktop notifications
  sendDesktopNotification: (payload: DesktopNotificationPayload) => void

  // History (Phase 6)
  history: ArchivedNotification[]
  clearHistory: () => void

  // DND (Phase 6)
  isDNDActive: boolean
  setDND: (updates: Partial<DNDSettings>) => void
  toggleDND: (enabled?: boolean) => void

  // Attention state
  pendingAttentionCount: number
  setPendingAttentionCount: (count: number) => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

// Provider component
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, initialState)
  const [pendingAttentionCount, setPendingAttentionCount] = React.useState(0)

  // Compute DND active state
  const dndActive = useMemo(() => isDNDActive(state.preferences.dnd), [state.preferences.dnd])

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as NotificationPreferences
        // Merge with defaults to handle new fields
        const merged = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...parsed,
          dnd: { ...DEFAULT_NOTIFICATION_PREFERENCES.dnd, ...(parsed.dnd || {}) }
        }
        dispatch({ type: 'SET_PREFERENCES', payload: merged })
      }
    } catch (err) {
      console.warn('[NotificationContext] Failed to load preferences:', err)
    }
  }, [])

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ArchivedNotification[]
        dispatch({ type: 'SET_HISTORY', payload: parsed })
      }
    } catch (err) {
      console.warn('[NotificationContext] Failed to load history:', err)
    }
  }, [])

  // Save preferences to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(state.preferences))
    } catch (err) {
      console.warn('[NotificationContext] Failed to save preferences:', err)
    }
  }, [state.preferences])

  // Save history to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history))
    } catch (err) {
      console.warn('[NotificationContext] Failed to save history:', err)
    }
  }, [state.history])

  // Update badge count when attention count changes
  useEffect(() => {
    if (window.api?.notifications?.setBadge) {
      window.api.notifications.setBadge(pendingAttentionCount)
    }
  }, [pendingAttentionCount])

  // Show a toast notification
  const showToast = useCallback(
    (toast: Omit<Toast, 'id' | 'createdAt'>): string => {
      if (!state.preferences.toastsEnabled) return ''
      
      // Check DND - allow high priority if configured
      if (dndActive && !(state.preferences.dnd.allowUrgent && toast.priority === 'high')) {
        return ''
      }

      const id = generateToastId()
      const fullToast: Toast = {
        ...toast,
        id,
        createdAt: Date.now(),
        dismissible: toast.dismissible ?? true
      }
      dispatch({ type: 'ADD_TOAST', payload: fullToast })
      return id
    },
    [state.preferences.toastsEnabled, state.preferences.dnd.allowUrgent, dndActive]
  )

  // Dismiss a toast and add to history
  const dismissToast = useCallback((id: string) => {
    const toast = state.toasts.find(t => t.id === id)
    if (toast) {
      // Archive to history
      const archived: ArchivedNotification = {
        id: toast.id,
        type: toast.type,
        title: toast.title,
        message: toast.message,
        priority: toast.priority,
        agentId: toast.agentId,
        createdAt: toast.createdAt,
        dismissedAt: Date.now()
      }
      dispatch({ type: 'ADD_TO_HISTORY', payload: archived })
    }
    dispatch({ type: 'DISMISS_TOAST', payload: id })
  }, [state.toasts])

  // Clear all toasts
  const clearAllToasts = useCallback(() => {
    // Archive all current toasts
    state.toasts.forEach(toast => {
      const archived: ArchivedNotification = {
        id: toast.id,
        type: toast.type,
        title: toast.title,
        message: toast.message,
        priority: toast.priority,
        agentId: toast.agentId,
        createdAt: toast.createdAt,
        dismissedAt: Date.now()
      }
      dispatch({ type: 'ADD_TO_HISTORY', payload: archived })
    })
    dispatch({ type: 'CLEAR_ALL_TOASTS' })
  }, [state.toasts])

  // Clear notification history
  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' })
  }, [])

  // Convenience methods
  const success = useCallback(
    (title: string, message?: string): string => {
      return showToast({
        type: 'success',
        title,
        message,
        priority: 'normal',
        duration: TOAST_DURATIONS.NORMAL
      })
    },
    [showToast]
  )

  const error = useCallback(
    (title: string, message?: string): string => {
      return showToast({
        type: 'error',
        title,
        message,
        priority: 'high',
        duration: TOAST_DURATIONS.LONG
      })
    },
    [showToast]
  )

  const warning = useCallback(
    (title: string, message?: string): string => {
      return showToast({
        type: 'warning',
        title,
        message,
        priority: 'normal',
        duration: TOAST_DURATIONS.NORMAL
      })
    },
    [showToast]
  )

  const info = useCallback(
    (title: string, message?: string): string => {
      return showToast({
        type: 'info',
        title,
        message,
        priority: 'low',
        duration: TOAST_DURATIONS.NORMAL
      })
    },
    [showToast]
  )

  const agentNotify = useCallback(
    (title: string, message?: string, agentId?: string): string => {
      return showToast({
        type: 'agent',
        title,
        message,
        priority: 'normal',
        duration: TOAST_DURATIONS.NORMAL,
        agentId
      })
    },
    [showToast]
  )

  // Update preferences
  const updatePreferences = useCallback((updates: Partial<NotificationPreferences>) => {
    dispatch({ type: 'UPDATE_PREFERENCES', payload: updates })
  }, [])

  // DND controls
  const setDND = useCallback((updates: Partial<DNDSettings>) => {
    dispatch({ type: 'SET_DND', payload: updates })
  }, [])

  const toggleDND = useCallback((enabled?: boolean) => {
    dispatch({ type: 'SET_DND', payload: { 
      enabled: enabled !== undefined ? enabled : !state.preferences.dnd.enabled 
    }})
  }, [state.preferences.dnd.enabled])

  // Send desktop notification (via IPC to main process)
  const sendDesktopNotification = useCallback(
    (payload: DesktopNotificationPayload) => {
      if (!state.preferences.desktopEnabled) return
      
      // Check DND - allow urgent if configured
      if (dndActive && !(state.preferences.dnd.allowUrgent && payload.urgency === 'critical')) {
        return
      }

      // Call IPC to show desktop notification
      if (window.api?.notifications?.show) {
        window.api.notifications.show(payload)
      }
    },
    [state.preferences.desktopEnabled, state.preferences.dnd.allowUrgent, dndActive]
  )

  // Memoized context value
  const contextValue = useMemo<NotificationContextType>(
    () => ({
      toasts: state.toasts,
      showToast,
      dismissToast,
      clearAllToasts,
      success,
      error,
      warning,
      info,
      agentNotify,
      preferences: state.preferences,
      updatePreferences,
      sendDesktopNotification,
      history: state.history,
      clearHistory,
      isDNDActive: dndActive,
      setDND,
      toggleDND,
      pendingAttentionCount,
      setPendingAttentionCount
    }),
    [
      state.toasts,
      state.preferences,
      state.history,
      showToast,
      dismissToast,
      clearAllToasts,
      success,
      error,
      warning,
      info,
      agentNotify,
      updatePreferences,
      sendDesktopNotification,
      clearHistory,
      dndActive,
      setDND,
      toggleDND,
      pendingAttentionCount
    ]
  )

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  )
}

// Hook to use notification context
export function useNotificationContext(): NotificationContextType {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider')
  }
  return context
}

export default NotificationContext
