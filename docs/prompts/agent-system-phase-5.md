# Continue: ArborChat Agent System Phase 5 Implementation

**Project:** `/Users/cory.naegle/ArborChat`
**Mode:** Alex Chen (Distinguished Software Architect)

## Context

I'm implementing the Agent System following `/docs/arbor-chat-agent-specs.md`. Phases 1-4 are complete and verified. Phase 5 focuses on Notifications & Attention.

## Completed Phases

### Phase 1 ✅ - Core Infrastructure
### Phase 2 ✅ - Agent Execution Engine  
### Phase 3 ✅ - Step Timeline & Polish
### Phase 4 ✅ - Multi-Agent Management

**Current Build Status:** TypeScript compiles cleanly (`npm run typecheck` passes)

---

## Phase 5: Notifications & Attention System

### Goals

1. **Toast Notification System** - In-app notifications for agent events:
   - Agent started/completed/failed
   - Tool approval needed
   - Agent errors
   - Stackable, dismissible, auto-expire

2. **Desktop Notifications** - Native OS notifications via Electron:
   - When app is backgrounded/minimized
   - Agent needs approval (high priority)
   - Agent completed/failed
   - Click to focus app and agent

3. **Attention Management**:
   - Visual indicators when agents need attention
   - Window badge/dock badge for pending count
   - Title bar notification count

4. **Notification Preferences**:
   - Enable/disable toast notifications
   - Enable/disable desktop notifications
   - Sound alerts toggle
   - Per-event-type configuration

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Main Process                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  NotificationManager                          │   │
│  │  - Desktop notifications (Electron Notification API)         │   │
│  │  - Dock/taskbar badge updates (app.setBadgeCount)            │   │
│  │  - Window attention request (BrowserWindow.flashFrame)       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │ IPC
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Renderer Process                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  NotificationContext                          │   │
│  │  - Toast queue management                                     │   │
│  │  - Notification preferences state                             │   │
│  │  - Event → notification mapping                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    ToastContainer                             │   │
│  │  - Renders toast stack (fixed position)                       │   │
│  │  - Animations (enter/exit)                                    │   │
│  │  - Auto-dismiss with progress                                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Key Files to Create

#### Renderer Components

```
src/renderer/src/
├── components/
│   └── notifications/
│       ├── index.ts                    # Barrel exports
│       ├── Toast.tsx                   # Individual toast component
│       ├── ToastContainer.tsx          # Fixed-position stack container
│       └── NotificationCenter.tsx      # Optional: History/settings panel
├── contexts/
│   └── NotificationContext.tsx         # Toast queue, preferences, IPC
└── types/
    └── notification.ts                 # Type definitions
```

#### Main Process

```
src/main/
└── notifications/
    ├── index.ts                        # IPC handlers registration
    └── manager.ts                      # Desktop notifications, badges
```

#### Preload

```
src/preload/index.ts                    # Add notification IPC API
```

---

### Type Definitions

```typescript
// src/renderer/src/types/notification.ts

export type NotificationType = 
  | 'info'
  | 'success' 
  | 'warning'
  | 'error'
  | 'agent'      // Agent-specific (blue/purple theme)

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
}

export interface DesktopNotificationPayload {
  title: string
  body: string
  urgency?: 'low' | 'normal' | 'critical'
  agentId?: string            // For click-to-focus
}
```

---

### NotificationContext Implementation

```typescript
// src/renderer/src/contexts/NotificationContext.tsx

interface NotificationContextType {
  // Toast management
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string
  dismissToast: (id: string) => void
  clearAllToasts: () => void
  
  // Convenience methods
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
  agentNotify: (title: string, message?: string, agentId?: string) => void
  
  // Preferences
  preferences: NotificationPreferences
  updatePreferences: (updates: Partial<NotificationPreferences>) => void
  
  // Desktop notifications
  sendDesktopNotification: (payload: DesktopNotificationPayload) => void
  
  // Attention state
  pendingAttentionCount: number
}
```

**Key behaviors:**
- Toast queue with max 5 visible at once
- Auto-dismiss based on duration (default 5s, errors 10s)
- High priority toasts stack at top
- Desktop notifications only when window not focused

---

### Toast Component Design

```tsx
// src/renderer/src/components/notifications/Toast.tsx

interface ToastProps {
  toast: Toast
  onDismiss: () => void
  onAction?: () => void
}

// Visual design:
// ┌─────────────────────────────────────────────────┐
// │ [Icon] Title                              [X]   │
// │        Message text here...                     │
// │        [Action Button]           ▓▓▓▓▓░░░░░░   │ <- progress bar
// └─────────────────────────────────────────────────┘

// Color schemes by type:
// info:    blue-500 border, blue-500/10 bg
// success: green-500 border, green-500/10 bg  
// warning: amber-500 border, amber-500/10 bg
// error:   red-500 border, red-500/10 bg
// agent:   violet-500 border, violet-500/10 bg
```

---

### ToastContainer Positioning

```tsx
// src/renderer/src/components/notifications/ToastContainer.tsx

// Fixed position bottom-right, above any panels
// Stacks upward with gap-2
// Animates in from right, out to right

export function ToastContainer() {
  const { toasts, dismissToast } = useNotificationContext()
  
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 max-w-sm">
      {toasts.slice(0, 5).map(toast => (
        <Toast 
          key={toast.id}
          toast={toast}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  )
}
```

---

### Main Process: Desktop Notifications

```typescript
// src/main/notifications/manager.ts

import { Notification, app, BrowserWindow } from 'electron'

export class NotificationManager {
  private mainWindow: BrowserWindow | null = null
  
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }
  
  showDesktopNotification(payload: DesktopNotificationPayload): void {
    // Only show if window not focused
    if (this.mainWindow?.isFocused()) return
    
    const notification = new Notification({
      title: payload.title,
      body: payload.body,
      urgency: payload.urgency || 'normal',
      silent: false
    })
    
    notification.on('click', () => {
      // Focus window and optionally switch to agent
      this.mainWindow?.focus()
      if (payload.agentId) {
        this.mainWindow?.webContents.send('notification:agent-click', payload.agentId)
      }
    })
    
    notification.show()
  }
  
  updateBadgeCount(count: number): void {
    // macOS dock badge / Windows taskbar overlay
    if (process.platform === 'darwin') {
      app.setBadgeCount(count)
    }
    // Windows would use setOverlayIcon
  }
  
  requestAttention(): void {
    // Flash taskbar/dock icon
    this.mainWindow?.flashFrame(true)
  }
}
```

---

### IPC Channels

```typescript
// Preload additions

notifications: {
  // Send desktop notification
  show: (payload: DesktopNotificationPayload) => 
    ipcRenderer.invoke('notifications:show', payload),
  
  // Update badge count
  setBadge: (count: number) => 
    ipcRenderer.invoke('notifications:setBadge', count),
  
  // Request window attention
  requestAttention: () => 
    ipcRenderer.invoke('notifications:requestAttention'),
  
  // Listen for notification clicks
  onAgentClick: (callback: (agentId: string) => void) => {
    const handler = (_: IpcRendererEvent, agentId: string) => callback(agentId)
    ipcRenderer.on('notification:agent-click', handler)
    return () => ipcRenderer.removeListener('notification:agent-click', handler)
  }
}
```

---

### Agent Event → Notification Mapping

| Agent Event | Toast | Desktop | Priority | Auto-dismiss |
|-------------|-------|---------|----------|--------------|
| Agent started | ✅ | ❌ | low | 3s |
| Agent running | ❌ | ❌ | - | - |
| Tool approval needed | ✅ | ✅ | high | persistent |
| Tool approved | ❌ | ❌ | - | - |
| Tool rejected | ❌ | ❌ | - | - |
| Tool completed | ❌ | ❌ | - | - |
| Agent completed | ✅ | ✅ | normal | 5s |
| Agent failed | ✅ | ✅ | high | 10s |
| Agent error | ✅ | ❌ | high | 10s |

---

### Integration with AgentContext

Hook into agent state changes to trigger notifications:

```typescript
// In AgentContext or a separate useAgentNotifications hook

useEffect(() => {
  const handleAgentChange = (agent: Agent, prevAgent?: Agent) => {
    if (!preferences.toastsEnabled) return
    
    // Status transitions
    if (agent.status === 'waiting' && agent.pendingApprovals.length > 0) {
      showToast({
        type: 'agent',
        title: `${agent.config.name} needs approval`,
        message: 'A tool is waiting for your decision',
        priority: 'high',
        agentId: agent.id,
        action: {
          label: 'Review',
          onClick: () => switchToAgent(agent.id)
        }
      })
      
      if (preferences.desktopEnabled) {
        sendDesktopNotification({
          title: 'Agent Needs Approval',
          body: `${agent.config.name} is waiting for tool approval`,
          urgency: 'critical',
          agentId: agent.id
        })
      }
    }
    
    if (agent.status === 'completed' && prevAgent?.status !== 'completed') {
      showToast({
        type: 'success',
        title: `${agent.config.name} completed`,
        message: `Finished after ${agent.stepsCompleted} steps`,
        priority: 'normal',
        agentId: agent.id
      })
    }
    
    // ... etc
  }
}, [agents])
```

---

### Implementation Order

1. **Create type definitions** (`notification.ts`)
2. **Create Toast component** (visual only first)
3. **Create ToastContainer** (positioning, stack)
4. **Create NotificationContext** (queue management)
5. **Integrate into App.tsx** (provider, container)
6. **Test in-app toasts** (manual trigger)
7. **Add main process NotificationManager** (desktop notifications)
8. **Add IPC channels** (preload + handlers)
9. **Wire desktop notifications** (context → IPC)
10. **Hook into AgentContext** (automatic triggers)
11. **Add notification preferences** (settings UI)
12. **Add badge count updates** (dock/taskbar)

---

### Test Scenarios

1. **Toast Display**
   - Trigger toast, verify appears bottom-right
   - Stack multiple toasts, verify order
   - Auto-dismiss after duration
   - Click X to dismiss immediately
   - Action button works

2. **Desktop Notifications**
   - Minimize/unfocus app
   - Trigger approval-needed event
   - Verify OS notification appears
   - Click notification, verify app focuses

3. **Badge Count**
   - Multiple agents need approval
   - Badge shows correct count
   - Approving reduces count

4. **Preferences**
   - Disable toasts, verify none appear
   - Disable desktop notifications, verify none appear
   - Per-event toggles work

5. **Agent Integration**
   - Start agent → "started" toast
   - Agent needs approval → toast + desktop notification
   - Complete agent → "completed" toast
   - Agent error → error toast

---

### Commands

```bash
cd /Users/cory.naegle/ArborChat
npm run typecheck     # Verify types after each phase
npm run dev           # Start dev server for testing
```

---

### Settings UI Addition

Add notification preferences to existing Settings panel:

```tsx
// In settings, add section:

<SettingsSection title="Notifications">
  <SettingsToggle 
    label="In-app toast notifications"
    checked={preferences.toastsEnabled}
    onChange={(v) => updatePreferences({ toastsEnabled: v })}
  />
  <SettingsToggle 
    label="Desktop notifications"
    description="Show OS notifications when app is in background"
    checked={preferences.desktopEnabled}
    onChange={(v) => updatePreferences({ desktopEnabled: v })}
  />
  <SettingsToggle 
    label="Sound alerts"
    checked={preferences.soundEnabled}
    onChange={(v) => updatePreferences({ soundEnabled: v })}
  />
</SettingsSection>
```

---

### Accessibility Considerations

- Toasts announce via aria-live="polite"
- High priority uses aria-live="assertive"
- Focus management when action clicked
- Keyboard dismissible (Escape key)
- Sufficient color contrast
- Motion-reduced animations option

---

### Future Enhancements (Not Phase 5)

- Notification history panel
- Sound customization
- Do-not-disturb mode
- Notification grouping
- Slack/webhook integrations

---

## Summary

Phase 5 implements a complete notification system:

| Component | Purpose |
|-----------|---------|
| `Toast.tsx` | Individual toast with icon, message, action, progress |
| `ToastContainer.tsx` | Fixed stack container with animations |
| `NotificationContext.tsx` | Queue management, preferences, IPC |
| `NotificationManager` (main) | Desktop notifications, badges |
| IPC channels | Renderer ↔ main communication |
| Settings integration | User preference controls |

**Estimated time:** 2-3 hours

**Dependencies:** None (uses existing Electron APIs)

**Security notes:**
- Desktop notifications only contain safe summary text
- No sensitive data in notification payloads
- Click handlers validate agent IDs before switching
