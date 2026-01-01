// src/renderer/src/components/settings/sections/NotificationsSection.tsx
// Settings section for notification preferences (Phase 5-6)

import { useState } from 'react'
import { 
  Bell, 
  BellOff, 
  Monitor, 
  Volume2, 
  VolumeX, 
  Moon, 
  History, 
  Clock 
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ToggleSwitch } from '../shared/ToggleSwitch'
import { useNotificationContext } from '../../../contexts/NotificationContext'
import { NotificationHistoryModal } from '../../notifications/NotificationHistoryModal'

export function NotificationsSection() {
  const { 
    preferences, 
    updatePreferences, 
    success,
    isDNDActive,
    toggleDND,
    setDND,
    history 
  } = useNotificationContext()
  
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showScheduleEditor, setShowScheduleEditor] = useState(false)

  // Test notification
  const handleTestNotification = () => {
    success('Test Notification', 'This is a test toast notification!')
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Notifications</h2>
        <p className="text-sm text-text-muted mt-1">
          Configure how ArborChat notifies you about agent activities.
        </p>
      </div>

      {/* Do Not Disturb Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
          Do Not Disturb
        </h3>

        <div className={cn(
          "flex items-center justify-between p-4 rounded-xl border transition-all",
          isDNDActive
            ? "bg-purple-500/10 border-purple-500/30"
            : "bg-secondary/30 border-secondary/50"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              isDNDActive
                ? "bg-purple-500/20 text-purple-400"
                : "bg-secondary text-text-muted"
            )}>
              <Moon size={20} />
            </div>
            <div>
              <h4 className="font-medium text-white">
                Do Not Disturb {isDNDActive && <span className="text-xs text-purple-400">(Active)</span>}
              </h4>
              <p className="text-sm text-text-muted">
                Silence all non-urgent notifications
              </p>
            </div>
          </div>
          <ToggleSwitch
            checked={preferences.dnd.enabled}
            onChange={(checked) => toggleDND(checked)}
          />
        </div>

        {/* Allow Urgent Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-secondary/50">
          <div>
            <h4 className="font-medium text-white text-sm">Allow Urgent Notifications</h4>
            <p className="text-xs text-text-muted">
              High-priority alerts bypass DND
            </p>
          </div>
          <ToggleSwitch
            checked={preferences.dnd.allowUrgent}
            onChange={(checked) => setDND({ allowUrgent: checked })}
            size="sm"
          />
        </div>

        {/* Schedule Quick Settings */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-secondary/50">
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-text-muted" />
            <div>
              <h4 className="font-medium text-white text-sm">Quiet Hours</h4>
              <p className="text-xs text-text-muted">
                {preferences.dnd.schedule 
                  ? `${preferences.dnd.schedule.start} - ${preferences.dnd.schedule.end}`
                  : 'Not scheduled'
                }
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowScheduleEditor(!showScheduleEditor)}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            {preferences.dnd.schedule ? 'Edit' : 'Set Schedule'}
          </button>
        </div>

        {/* Schedule Editor */}
        {showScheduleEditor && (
          <div className="p-4 rounded-xl bg-secondary/20 border border-secondary/50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Start Time</label>
                <input
                  type="time"
                  value={preferences.dnd.schedule?.start || '22:00'}
                  onChange={(e) => setDND({
                    schedule: {
                      start: e.target.value,
                      end: preferences.dnd.schedule?.end || '08:00',
                      days: preferences.dnd.schedule?.days || [0, 1, 2, 3, 4, 5, 6]
                    }
                  })}
                  className="w-full px-3 py-2 bg-secondary/50 border border-secondary rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">End Time</label>
                <input
                  type="time"
                  value={preferences.dnd.schedule?.end || '08:00'}
                  onChange={(e) => setDND({
                    schedule: {
                      start: preferences.dnd.schedule?.start || '22:00',
                      end: e.target.value,
                      days: preferences.dnd.schedule?.days || [0, 1, 2, 3, 4, 5, 6]
                    }
                  })}
                  className="w-full px-3 py-2 bg-secondary/50 border border-secondary rounded-lg text-white text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setDND({ schedule: undefined })}
                className="flex-1 px-3 py-1.5 text-xs text-text-muted hover:text-white bg-secondary/50 rounded-lg transition-colors"
              >
                Clear Schedule
              </button>
              <button
                onClick={() => setShowScheduleEditor(false)}
                className="flex-1 px-3 py-1.5 text-xs text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Global Toggles */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
          Notification Channels
        </h3>

        {/* Toast Notifications Toggle */}
        <div className={cn(
          "flex items-center justify-between p-4 rounded-xl border transition-all",
          preferences.toastsEnabled
            ? "bg-green-500/5 border-green-500/20"
            : "bg-secondary/30 border-secondary/50"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              preferences.toastsEnabled
                ? "bg-primary/20 text-primary"
                : "bg-secondary text-text-muted"
            )}>
              {preferences.toastsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
            </div>
            <div>
              <h4 className="font-medium text-white">In-App Toasts</h4>
              <p className="text-sm text-text-muted">
                Show popup notifications within the app
              </p>
            </div>
          </div>
          <ToggleSwitch
            checked={preferences.toastsEnabled}
            onChange={(checked) => updatePreferences({ toastsEnabled: checked })}
          />
        </div>

        {/* Desktop Notifications Toggle */}
        <div className={cn(
          "flex items-center justify-between p-4 rounded-xl border transition-all",
          preferences.desktopEnabled
            ? "bg-green-500/5 border-green-500/20"
            : "bg-secondary/30 border-secondary/50"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              preferences.desktopEnabled
                ? "bg-primary/20 text-primary"
                : "bg-secondary text-text-muted"
            )}>
              <Monitor size={20} />
            </div>
            <div>
              <h4 className="font-medium text-white">Desktop Notifications</h4>
              <p className="text-sm text-text-muted">
                Show OS notifications when app is in background
              </p>
            </div>
          </div>
          <ToggleSwitch
            checked={preferences.desktopEnabled}
            onChange={(checked) => updatePreferences({ desktopEnabled: checked })}
          />
        </div>

        {/* Sound Alerts Toggle */}
        <div className={cn(
          "flex items-center justify-between p-4 rounded-xl border transition-all",
          preferences.soundEnabled
            ? "bg-green-500/5 border-green-500/20"
            : "bg-secondary/30 border-secondary/50"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              preferences.soundEnabled
                ? "bg-primary/20 text-primary"
                : "bg-secondary text-text-muted"
            )}>
              {preferences.soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </div>
            <div>
              <h4 className="font-medium text-white">Sound Alerts</h4>
              <p className="text-sm text-text-muted">
                Play sounds for important notifications
              </p>
            </div>
          </div>
          <ToggleSwitch
            checked={preferences.soundEnabled}
            onChange={(checked) => updatePreferences({ soundEnabled: checked })}
          />
        </div>
      </div>

      {/* Event-specific Toggles */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
          Agent Events
        </h3>

        <div className="bg-secondary/30 rounded-xl border border-secondary/50 divide-y divide-secondary/50">
          <EventToggle
            label="Agent Started"
            description="When a new agent begins work"
            checked={preferences.events.agentStarted}
            onChange={(checked) => updatePreferences({
              events: { ...preferences.events, agentStarted: checked }
            })}
            disabled={!preferences.toastsEnabled}
          />
          <EventToggle
            label="Tool Approval Needed"
            description="When an agent needs permission to use a tool"
            checked={preferences.events.toolApprovalNeeded}
            onChange={(checked) => updatePreferences({
              events: { ...preferences.events, toolApprovalNeeded: checked }
            })}
            disabled={!preferences.toastsEnabled}
          />
          <EventToggle
            label="Agent Completed"
            description="When an agent finishes its task"
            checked={preferences.events.agentCompleted}
            onChange={(checked) => updatePreferences({
              events: { ...preferences.events, agentCompleted: checked }
            })}
            disabled={!preferences.toastsEnabled}
          />
          <EventToggle
            label="Agent Failed"
            description="When an agent encounters an error"
            checked={preferences.events.agentFailed}
            onChange={(checked) => updatePreferences({
              events: { ...preferences.events, agentFailed: checked }
            })}
            disabled={!preferences.toastsEnabled}
          />
          <EventToggle
            label="Agent Error"
            description="When an agent has a non-fatal error"
            checked={preferences.events.agentError}
            onChange={(checked) => updatePreferences({
              events: { ...preferences.events, agentError: checked }
            })}
            disabled={!preferences.toastsEnabled}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-secondary/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestNotification}
            disabled={!preferences.toastsEnabled}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              preferences.toastsEnabled
                ? "bg-primary hover:bg-primary/90 text-white"
                : "bg-secondary text-text-muted cursor-not-allowed"
            )}
          >
            Test Notification
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary/50 hover:bg-secondary text-text-muted hover:text-white transition-colors flex items-center gap-2"
          >
            <History size={16} />
            History
            {history.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                {history.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* History Modal */}
      <NotificationHistoryModal 
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
    </div>
  )
}

// Helper component for event toggles
interface EventToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

function EventToggle({ label, description, checked, onChange, disabled }: EventToggleProps) {
  return (
    <div className={cn(
      "flex items-center justify-between p-4",
      disabled && "opacity-50"
    )}>
      <div>
        <h4 className="font-medium text-white text-sm">{label}</h4>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <ToggleSwitch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        size="sm"
      />
    </div>
  )
}

export default NotificationsSection
