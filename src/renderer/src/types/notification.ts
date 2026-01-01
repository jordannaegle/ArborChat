// src/renderer/src/types/notification.ts
// Type definitions for the Notification & Attention System (Phase 5-6)
// Phase 6 additions: DND settings, notification history

export type NotificationType = 
  | 'info'
  | 'success' 
  | 'warning'
  | 'error'
  | 'agent'      // Agent-specific (purple theme)

export type NotificationPriority = 'low' | 'normal' | 'high'

export interface Toast {
  id: string
  type: NotificationType
  title: string
  message?: string
  priority: NotificationPriority
  duration?: number           // ms, undefined = persistent
  dismissible?: boolean       // default true
  action?: {
    label: string
    onClick: () => void
  }
  agentId?: string            // For agent-related toasts
  createdAt: number
}

/**
 * Archived notification - stored in history after dismissal
 */
export interface ArchivedNotification {
  id: string
  type: NotificationType
  title: string
  message?: string
  priority: NotificationPriority
  agentId?: string
  createdAt: number
  dismissedAt: number
}

/**
 * Do-Not-Disturb Schedule - defines quiet hours
 */
export interface DNDSchedule {
  start: string              // HH:mm format (e.g., "22:00")
  end: string                // HH:mm format (e.g., "08:00")
  days: number[]             // 0-6 for Sun-Sat (0 = Sunday)
}

/**
 * Do-Not-Disturb Settings
 */
export interface DNDSettings {
  enabled: boolean           // Manual DND toggle
  schedule?: DNDSchedule     // Optional quiet hours schedule
  allowUrgent: boolean       // Allow high-priority notifications during DND
}

export interface NotificationPreferences {
  toastsEnabled: boolean
  desktopEnabled: boolean
  soundEnabled: boolean
  // Per-event toggles
  events: {
    agentStarted: boolean
    agentCompleted: boolean
    agentFailed: boolean
    toolApprovalNeeded: boolean
    agentError: boolean
  }
  // Do-Not-Disturb settings (Phase 6)
  dnd: DNDSettings
}

export interface DesktopNotificationPayload {
  title: string
  body: string
  urgency?: 'low' | 'normal' | 'critical'
  agentId?: string            // For click-to-focus
}

// Default DND settings
export const DEFAULT_DND_SETTINGS: DNDSettings = {
  enabled: false,
  allowUrgent: true,
  schedule: undefined
}

// Default preferences
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  toastsEnabled: true,
  desktopEnabled: true,
  soundEnabled: false,
  events: {
    agentStarted: true,
    agentCompleted: true,
    agentFailed: true,
    toolApprovalNeeded: true,
    agentError: true
  },
  dnd: DEFAULT_DND_SETTINGS
}

// Duration constants
export const TOAST_DURATIONS = {
  SHORT: 3000,
  NORMAL: 5000,
  LONG: 10000,
  PERSISTENT: undefined
} as const

// History limits
export const NOTIFICATION_HISTORY_LIMIT = 100
