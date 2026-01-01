// src/main/notifications/manager.ts
// Main process notification manager for desktop notifications and badges

import { Notification, app, BrowserWindow } from 'electron'

export interface DesktopNotificationPayload {
  title: string
  body: string
  urgency?: 'low' | 'normal' | 'critical'
  agentId?: string
}

export class NotificationManager {
  private mainWindow: BrowserWindow | null = null

  /**
   * Set the main window reference for notification interactions
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
    console.log('[NotificationManager] Main window registered')
  }

  /**
   * Check if Notification API is supported
   */
  isSupported(): boolean {
    return Notification.isSupported()
  }

  /**
   * Show a desktop notification
   * Only shows if the window is not focused
   */
  showDesktopNotification(payload: DesktopNotificationPayload): void {
    if (!this.isSupported()) {
      console.warn('[NotificationManager] Notifications not supported on this platform')
      return
    }

    // Only show if window is not focused
    if (this.mainWindow?.isFocused()) {
      console.log('[NotificationManager] Window focused, skipping desktop notification')
      return
    }

    try {
      const notification = new Notification({
        title: payload.title,
        body: payload.body,
        urgency: payload.urgency || 'normal',
        silent: false
      })

      notification.on('click', () => {
        // Focus the window
        if (this.mainWindow) {
          if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore()
          }
          this.mainWindow.focus()

          // If there's an agent ID, notify the renderer to switch to it
          if (payload.agentId) {
            this.mainWindow.webContents.send('notification:agent-click', payload.agentId)
          }
        }
      })

      notification.on('close', () => {
        console.log('[NotificationManager] Notification dismissed')
      })

      notification.show()
      console.log('[NotificationManager] Desktop notification shown:', payload.title)
    } catch (error) {
      console.error('[NotificationManager] Failed to show notification:', error)
    }
  }

  /**
   * Update the dock/taskbar badge count
   */
  updateBadgeCount(count: number): void {
    try {
      if (process.platform === 'darwin') {
        // macOS dock badge
        app.setBadgeCount(count)
        console.log('[NotificationManager] Badge count set:', count)
      } else if (process.platform === 'win32' && this.mainWindow) {
        // Windows: Use overlay icon for notifications
        // For now, we'll use the overlay to show a dot when count > 0
        if (count > 0) {
          // We could create an overlay icon here, but for simplicity
          // we'll just log it - full implementation would require icon assets
          console.log('[NotificationManager] Windows badge count:', count)
        }
      }
    } catch (error) {
      console.error('[NotificationManager] Failed to set badge count:', error)
    }
  }

  /**
   * Request window attention (flash taskbar/dock)
   */
  requestAttention(): void {
    try {
      if (this.mainWindow && !this.mainWindow.isFocused()) {
        this.mainWindow.flashFrame(true)
        console.log('[NotificationManager] Window attention requested')
        
        // Stop flashing after a few seconds
        setTimeout(() => {
          if (this.mainWindow) {
            this.mainWindow.flashFrame(false)
          }
        }, 3000)
      }
    } catch (error) {
      console.error('[NotificationManager] Failed to request attention:', error)
    }
  }

  /**
   * Clear window attention flash
   */
  clearAttention(): void {
    try {
      if (this.mainWindow) {
        this.mainWindow.flashFrame(false)
      }
    } catch (error) {
      console.error('[NotificationManager] Failed to clear attention:', error)
    }
  }

  /**
   * Clear badge count
   */
  clearBadge(): void {
    this.updateBadgeCount(0)
  }
}

// Singleton instance
export const notificationManager = new NotificationManager()
