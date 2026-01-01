# ArborChat Phase 6.5 - Memory Cleanup & Resource Management

## Overview
Phase 6.5 implements comprehensive cleanup infrastructure to prevent memory leaks in long-running agent sessions.

## Implementation Status: ✅ COMPLETE

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Agent Removal Flow                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Sidebar.removeAgent() → AgentContext.removeAgent()             │
│          │                        │                              │
│          │                        ├── Call registered cleanup()  │
│          │                        │   └── useAgentRunner cleanup │
│          │                        │       ├── Clear timers       │
│          │                        │       ├── Abort streaming    │
│          │                        │       ├── window.api.offAI() │
│          │                        │       └── clearAgentApprovals│
│          │                        │                              │
│          │                        └── Remove from state          │
│          │                                                       │
│          └── UI updates                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Modified/Created

### 1. `src/renderer/src/hooks/useAgentRunner.ts`
**Changes:**
- Added `HISTORY_LIMITS` constants for auto-trimming thresholds
- Added `trimAgentHistory` to context destructuring  
- Created `checkAndTrimHistory()` helper
- Integrated auto-trim after tool executions (both auto-approved and user-approved)
- Updated dependency arrays

**Key Code:**
```typescript
const HISTORY_LIMITS = {
  MAX_STEPS: 100,
  KEEP_STEPS: 75,
  MAX_MESSAGES: 50,
  KEEP_MESSAGES: 40,
} as const

const checkAndTrimHistory = useCallback(() => {
  const agent = getAgentSafe()
  if (!agent) return
  if (agent.steps.length > HISTORY_LIMITS.MAX_STEPS || 
      agent.messages.length > HISTORY_LIMITS.MAX_MESSAGES) {
    trimAgentHistory(agentId, HISTORY_LIMITS.KEEP_STEPS, HISTORY_LIMITS.KEEP_MESSAGES)
  }
}, [agentId, getAgentSafe, trimAgentHistory])
```

### 2. `src/renderer/src/hooks/useAgentCleanup.ts` (NEW)
**Features:**
- Centralized cleanup coordination hook
- Memory profiling utilities (`takeMemorySnapshot`, `getMemoryGrowth`)
- Automatic periodic trimming (30s interval, configurable)
- Manual trim APIs (`trimAgent`, `trimAllAgents`)
- Development GC hints

**Usage:**
```typescript
const { 
  trimAllAgents, 
  takeMemorySnapshot,
  getMemoryGrowth 
} = useAgentCleanup({
  autoTrim: true,
  onTrim: (agentId, steps, msgs) => {
    console.log(`Trimmed agent ${agentId}: ${steps} steps, ${msgs} messages`)
  }
})
```

### 3. `src/renderer/src/hooks/index.ts`
**Changes:**
- Export `useAgentCleanup` and `CLEANUP_THRESHOLDS`
- Export `MemorySnapshot` type

---

## Pre-existing Infrastructure (Already Implemented)

### AgentContext.tsx
- `registerCleanup(agentId, fn)` - Register cleanup function
- `unregisterCleanup(agentId)` - Unregister on unmount  
- `removeAgent(agentId)` - Calls registered cleanup before state removal
- `trimAgentHistory(agentId, maxSteps, maxMessages)` - Trim history

### MCPProvider.tsx
- `registerApprovalForAgent(approvalId, agentId)` - Track approval ownership
- `clearAgentApprovals(agentId)` - Clear & reject pending approvals

### useAgentRunner.ts (performCleanup)
- Clear retry/continuation timeouts
- Abort streaming requests
- Remove AI event listeners
- Clear pending tool result refs
- Reset stream buffer
- Call `clearAgentApprovals`

### workJournal/index.ts
- `webContents.once('destroyed')` cleanup for subscriptions
- `cleanupWorkJournalSubscriptions()` on app quit

---

## Testing Approach

### Manual Memory Profiling
1. Open DevTools → Memory tab
2. Take heap snapshot (baseline)
3. Create agent, run it, remove it (repeat 10x)
4. Take second heap snapshot
5. Compare - look for Agent-related objects

### Console Log Verification
Look for cleanup logs:
```
[AgentRunner agent-1] Performing cleanup...
[AgentRunner agent-1] Cleared retry timeout
[AgentRunner agent-1] Cleared MCP pending approvals
[AgentContext] Cleanup completed for agent agent-1
```

### Auto-trim Verification
When steps exceed 100:
```
[AgentRunner agent-1] Auto-trimming history: 105 steps, 52 messages
```

---

## Success Criteria

- [x] TypeScript compiles clean (`npm run typecheck`)
- [x] Retry timers cancelled on agent removal
- [x] AI streaming aborted on agent removal
- [x] MCP pending approvals cleared on agent removal
- [x] Auto-trimming triggers when thresholds exceeded
- [x] Memory profiling utilities available for debugging
- [ ] No memory growth after 10+ agent create/remove cycles (needs manual test)
- [ ] No console errors about missing agents or stale references (needs manual test)

---

## Configuration

### History Limits (useAgentRunner)
```typescript
MAX_STEPS: 100      // Trigger trim
KEEP_STEPS: 75      // Keep after trim
MAX_MESSAGES: 50    // Trigger trim
KEEP_MESSAGES: 40   // Keep after trim
```

### Cleanup Thresholds (useAgentCleanup)
```typescript
CHECK_INTERVAL_MS: 30000  // Periodic check frequency
```

---

## Future Considerations

1. **Work Journal Session Linking** - Consider linking work journal sessions to agents for automatic cleanup
2. **Lazy Loading** - Implement lazy loading for step details in AgentStepTimeline
3. **Memory Metrics Dashboard** - Add dev-mode memory metrics overlay
4. **Configurable Thresholds** - Allow user configuration of history limits

---

## Optional: App-Level Integration

For global periodic trimming across all agents, add `useAgentCleanup` to AppContent:

```typescript
// In App.tsx AppContent component
import { useAgentCleanup } from './hooks'

function AppContent({ apiKey }: { apiKey: string }) {
  // Enable global auto-trim with logging
  useAgentCleanup({
    autoTrim: true,
    onTrim: (agentId, stepsRemoved, messagesRemoved) => {
      console.log(`[App] Trimmed agent ${agentId}: ${stepsRemoved} steps, ${messagesRemoved} messages`)
    }
  })
  
  // ... rest of component
}
```

---

## Testing

Run the testing script:
```bash
./scripts/test-memory-cleanup.sh
```

Or manually follow the checklist in `/scripts/test-memory-cleanup.sh`.
