// src/renderer/src/components/notifications/NotificationHistoryModal.tsx
// Modal for viewing notification history (Phase 6)

import { X, Bell, CheckCircle, AlertTriangle, AlertCircle, Info, Bot, Trash2 } from 'lucide-react'
import { useNotificationContext } from '../../contexts/NotificationContext'
import type { NotificationType, ArchivedNotification } from '../../types/notification'

interface NotificationHistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'success':
      return <CheckCircle size={16} className="text-green-400" />
    case 'error':
      return <AlertCircle size={16} className="text-red-400" />
    case 'warning':
      return <AlertTriangle size={16} className="text-yellow-400" />
    case 'agent':
      return <Bot size={16} className="text-primary" />
    default:
      return <Info size={16} className="text-blue-400" />
  }
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return new Date(timestamp).toLocaleDateString()
}

function NotificationItem({ notification }: { notification: ArchivedNotification }) {
  return (
    <div className="flex items-start gap-3 p-3 hover:bg-secondary/50 rounded-lg transition-colors">
      <div className="flex-shrink-0 mt-0.5">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {notification.title}
        </p>
        {notification.message && (
          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
            {notification.message}
          </p>
        )}
        <p className="text-xs text-text-muted/60 mt-1">
          {formatTimeAgo(notification.createdAt)}
        </p>
      </div>
    </div>
  )
}

export function NotificationHistoryModal({ isOpen, onClose }: NotificationHistoryModalProps) {
  const { history, clearHistory } = useNotificationContext()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-background border border-secondary/50 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary/50">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-white">Notification History</h2>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="p-2 hover:bg-secondary/50 rounded-lg transition-colors text-text-muted hover:text-red-400"
                title="Clear history"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary/50 rounded-lg transition-colors text-text-muted hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <Bell size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No notification history</p>
              <p className="text-xs mt-1">Dismissed notifications will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-secondary/30">
              {history.map((notification) => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification} 
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        {history.length > 0 && (
          <div className="p-3 border-t border-secondary/50 text-center">
            <p className="text-xs text-text-muted">
              {history.length} notification{history.length !== 1 ? 's' : ''} in history
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationHistoryModal
