// src/main/notifications/index.ts
// IPC handlers for notification system

import { ipcMain, BrowserWindow } from 'electron'
import { notificationManager, DesktopNotificationPayload } from './manager'

/**
 * Setup notification IPC handlers
 * Should be called from main process index.ts
 */
export function setupNotificationHandlers(): void {
  console.log('[Notifications] Setting up IPC handlers')

  // Show a desktop notification
  ipcMain.handle(
    'notifications:show',
    async (_, payload: DesktopNotificationPayload) => {
      notificationManager.showDesktopNotification(payload)
      return { success: true }
    }
  )

  // Update badge count
  ipcMain.handle('notifications:setBadge', async (_, count: number) => {
    notificationManager.updateBadgeCount(count)
    return { success: true }
  })

  // Request window attention
  ipcMain.handle('notifications:requestAttention', async () => {
    notificationManager.requestAttention()
    return { success: true }
  })

  // Clear badge
  ipcMain.handle('notifications:clearBadge', async () => {
    notificationManager.clearBadge()
    return { success: true }
  })

  console.log('[Notifications] IPC handlers registered')
}

/**
 * Register the main window with the notification manager
 * Should be called after window creation in main process
 */
export function registerMainWindow(window: BrowserWindow): void {
  notificationManager.setMainWindow(window)
}

// Re-export manager for direct access if needed
export { notificationManager } from './manager'
export type { DesktopNotificationPayload } from './manager'
