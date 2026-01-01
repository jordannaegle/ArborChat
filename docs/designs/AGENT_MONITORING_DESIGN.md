# Agent Execution Monitoring & Diagnostics Design

**Author:** Alex Chen (Distinguished Software Architect)  
**Date:** December 31, 2025  
**Status:** Implementation Complete - All Phases Done

---

## Problem Statement

Agents can appear to "stall" during execution with no indication of what's happening. Users see a "Working" status with animated dots but have no visibility into:
1. What operation is currently executing
2. Whether progress is being made
3. If the agent is stuck or just processing a long-running operation
4. Resource utilization (context window, token usage)

### Root Causes

1. **No timeouts on tool execution** - MCP tool calls can hang indefinitely
2. **Silent context window overflow** - No visibility into token usage
3. **Missing execution state details** - Only high-level status visible
4. **No heartbeat mechanism** - Can't detect true stalls vs. long operations

---

## Solution Architecture

### 1. Agent Execution State Machine

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   IDLE      │────▶│  STREAMING  │────▶│  TOOL_EXEC   │
│             │     │   AI_GEN    │     │              │
└─────────────┘     └─────────────┘     └──────────────┘
                           │                    │
                           │                    ▼
                           │            ┌──────────────┐
                           │            │  WAITING_    │
                           └───────────▶│  APPROVAL    │
                                        └──────────────┘
```

Introduce granular execution phases:
- `idle` - Not actively processing
- `streaming_ai` - Receiving AI response chunks
- `executing_tool` - Running MCP tool call
- `waiting_approval` - Tool pending user approval
- `verifying_completion` - Running completion checks

### 2. Execution Activity Tracker

Track detailed activity with timestamps:

```typescript
interface ExecutionActivity {
  phase: 'idle' | 'streaming_ai' | 'executing_tool' | 'waiting_approval' | 'verifying_completion'
  startedAt: number
  toolName?: string           // If executing a tool
  tokensSent?: number         // Estimated tokens in context
  tokensReceived?: number     // Tokens received so far
  lastProgressAt: number      // Last time progress was made
  progressIndicator: string   // Human-readable activity description
}
```

### 3. Watchdog Timer System

Implement a watchdog that detects stalls:

```typescript
const WATCHDOG_CONFIG = {
  // Warn if no progress for this duration
  warnThreshold: 30_000,    // 30 seconds
  
  // Consider stalled if no progress for this duration  
  stallThreshold: 120_000,  // 2 minutes
  
  // Maximum tool execution time before timeout
  toolTimeout: 300_000,     // 5 minutes
  
  // Check interval
  checkInterval: 5_000      // Check every 5 seconds
}
```

### 4. Token Tracking

Integrate token counting for context window monitoring:

```typescript
interface TokenMetrics {
  contextUsed: number      // Estimated tokens in context
  contextMax: number       // Model's max context
  usagePercent: number     // contextUsed / contextMax
  lastMessageTokens: number
  estimatedRemaining: number
}
```

---

## Component Design

### A. Enhanced `useAgentRunner` Hook

Add new state and monitoring:

```typescript
// Enhanced runner state
interface AgentRunnerState {
  // Existing
  isRunning: boolean
  isStreaming: boolean
  isRetrying: boolean
  streamingContent: string
  error: string | null
  
  // NEW: Detailed execution info
  execution: {
    phase: ExecutionPhase
    currentActivity: string       // "Calling list_directory..."
    activityStartedAt: number
    lastProgressAt: number
    currentToolName?: string
    currentToolDuration?: number
  } | null
  
  // NEW: Token metrics
  tokens: {
    contextUsed: number
    contextMax: number
    usagePercent: number
    warningLevel: 'normal' | 'warning' | 'critical'
  } | null
  
  // NEW: Diagnostics
  diagnostics: {
    loopIterations: number
    toolCallsTotal: number
    toolCallsSuccessful: number
    averageToolDuration: number
    totalRuntime: number
  }
}
```

### B. Tool Execution with Timeout

Wrap tool execution with timeout:

```typescript
async function executeToolWithTimeout(
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number = 300_000
): Promise<ToolResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const result = await Promise.race([
      executeToolInternal(toolName, args),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error(`Tool '${toolName}' timed out after ${timeoutMs/1000}s`))
        })
      })
    ])
    clearTimeout(timeoutId)
    return result
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}
```

### C. Watchdog Hook

New hook for stall detection:

```typescript
// useAgentWatchdog.ts

export function useAgentWatchdog(
  agentId: string,
  activity: ExecutionActivity | null,
  onStallWarning: () => void,
  onStallDetected: () => void
) {
  const lastProgressRef = useRef<number>(Date.now())
  
  useEffect(() => {
    if (!activity || activity.phase === 'idle') return
    
    const intervalId = setInterval(() => {
      const now = Date.now()
      const elapsed = now - activity.lastProgressAt
      
      if (elapsed > WATCHDOG_CONFIG.stallThreshold) {
        onStallDetected()
      } else if (elapsed > WATCHDOG_CONFIG.warnThreshold) {
        onStallWarning()
      }
    }, WATCHDOG_CONFIG.checkInterval)
    
    return () => clearInterval(intervalId)
  }, [activity, onStallWarning, onStallDetected])
}
```

### D. UI Components

#### 1. ExecutionProgressBar Component

```tsx
interface ExecutionProgressBarProps {
  phase: ExecutionPhase
  activity: string
  duration: number
  tokenUsage?: { used: number; max: number }
}

function ExecutionProgressBar({ phase, activity, duration, tokenUsage }: ExecutionProgressBarProps) {
  const isStalled = duration > 30_000
  
  return (
    <div className={cn(
      'px-3 py-2 border-t border-violet-500/10',
      isStalled && 'bg-amber-500/10'
    )}>
      {/* Phase indicator with animation */}
      <div className="flex items-center gap-2 text-xs">
        <PhaseIcon phase={phase} />
        <span className="text-text-muted">{activity}</span>
        <span className="text-text-muted/50">
          {formatDuration(duration)}
        </span>
        
        {isStalled && (
          <span className="text-amber-400 animate-pulse">
            (Taking longer than expected)
          </span>
        )}
      </div>
      
      {/* Token usage bar */}
      {tokenUsage && (
        <div className="mt-1.5">
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div 
              className={cn(
                'h-full transition-all',
                tokenUsage.used / tokenUsage.max > 0.9 ? 'bg-red-500' :
                tokenUsage.used / tokenUsage.max > 0.7 ? 'bg-amber-500' :
                'bg-violet-500'
              )}
              style={{ width: `${(tokenUsage.used / tokenUsage.max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-text-muted">
            Context: {Math.round(tokenUsage.used / 1000)}k / {Math.round(tokenUsage.max / 1000)}k tokens
          </span>
        </div>
      )}
    </div>
  )
}
```

#### 2. Agent Diagnostics Panel

```tsx
interface AgentDiagnosticsPanelProps {
  diagnostics: AgentDiagnostics
  onForceRetry: () => void
  onKillTool: () => void
}

function AgentDiagnosticsPanel({ diagnostics, onForceRetry, onKillTool }: AgentDiagnosticsPanelProps) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-text-muted">
        <Activity size={12} />
        <span>Diagnostics</span>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2 space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Loop Iterations" value={diagnostics.loopIterations} />
          <Stat label="Total Runtime" value={formatDuration(diagnostics.totalRuntime)} />
          <Stat label="Tool Calls" value={`${diagnostics.toolCallsSuccessful}/${diagnostics.toolCallsTotal}`} />
          <Stat label="Avg Tool Duration" value={formatDuration(diagnostics.averageToolDuration)} />
        </div>
        
        {/* Recovery actions */}
        <div className="flex gap-2 pt-2 border-t border-tertiary/50">
          <button onClick={onForceRetry} className="btn-ghost text-xs">
            <RotateCcw size={12} /> Force Retry
          </button>
          <button onClick={onKillTool} className="btn-ghost text-xs text-amber-400">
            <XCircle size={12} /> Kill Current Tool
          </button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (2-3 hours)
1. Add `ExecutionActivity` type and state to `useAgentRunner`
2. Track phase transitions in execute loop
3. Add basic token estimation
4. Implement tool timeout wrapper

### Phase 2: Watchdog System (1-2 hours)
1. Create `useAgentWatchdog` hook
2. Integrate with agent runner
3. Add stall recovery actions (force retry, kill tool)

### Phase 3: UI Components (2-3 hours)
1. Create `ExecutionProgressBar` component
2. Add diagnostics panel to AgentPanel
3. Enhance status badge with phase info
4. Add token usage indicator

### Phase 4: Token Tracking (1-2 hours) ✅ COMPLETE
1. Integrate TokenizerService for accurate counting ✅
2. Add model context limits ✅
3. Implement context overflow warnings ✅
4. Auto-truncation with notification ✅

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/renderer/src/hooks/useAgentRunner.ts` | Add execution tracking, tool timeout, token metrics |
| `src/renderer/src/hooks/useAgentWatchdog.ts` | NEW - Watchdog hook |
| `src/renderer/src/hooks/index.ts` | Export new hook |
| `src/renderer/src/types/agent.ts` | Add new types |
| `src/renderer/src/components/agent/AgentPanel.tsx` | Add progress bar, diagnostics |
| `src/renderer/src/components/agent/ExecutionProgressBar.tsx` | NEW - Progress component |
| `src/renderer/src/components/agent/AgentDiagnosticsPanel.tsx` | NEW - Diagnostics component |
| `src/renderer/src/components/agent/index.ts` | Export new components |

---

## Security Considerations

1. **Tool Timeout**: Prevents resource exhaustion from hung tools
2. **Context Limit**: Prevents sending oversized requests that might fail
3. **Stall Detection**: Allows users to recover from stuck states
4. **Diagnostic Data**: No sensitive data exposed, only operational metrics

---

## Testing Checklist

- [ ] Tool execution respects timeout
- [ ] Watchdog detects stalls after threshold
- [ ] Token counting reasonably accurate
- [ ] Progress bar updates in real-time
- [ ] Force retry recovers from stall
- [ ] Kill tool terminates hung operation
- [ ] Context overflow warning triggers before failure

---

## Open Questions

1. Should we auto-retry on stall, or always require user action?
2. What's the appropriate default timeout for different tool categories?
3. Should diagnostics persist across sessions for debugging?

---

## Related Documents

- [TOOL_WINDOW_ENHANCEMENT_DESIGN.md](./TOOL_WINDOW_ENHANCEMENT_DESIGN.md) - Tool display improvements
- [Phase 2: Native Tool Calling](../IMPLEMENTATION_PROMPTS.md) - Tool calling architecture
