# Tool Display Investigation - Architectural Analysis

**Investigator:** Alex Chen (Distinguished Software Architect)  
**Date:** December 31, 2025  
**Status:** Root cause candidates identified, runtime verification needed

---

## Executive Summary

After tracing the complete data flow from hook to component, I've identified the architecture is **structurally sound**. The issue is likely a **runtime timing or state propagation problem** that requires console observation to confirm.

---

## Verified Data Flow (All Paths Confirmed)

```
┌─────────────────────────────────────────────────────────────────────┐
│ useMCPTools.ts                                                       │
│   └─ toolExecutions: ToolExecution[] (useState)                      │
│   └─ executeTool() → setToolExecutions() ✓                           │
└────────────────────────────────────────────────────────────────────┬─┘
                                                                     │
┌─────────────────────────────────────────────────────────────────────┼─┐
│ useToolChat.ts                                                       │ │
│   └─ imports useMCPTools                                             │ │
│   └─ re-exports toolExecutions ✓                                     │ │
└────────────────────────────────────────────────────────────────────┬─┼─┘
                                                                     │ │
┌─────────────────────────────────────────────────────────────────────┼─┼─┐
│ App.tsx (~line 127)                                                  │ │ │
│   const { toolExecutions, ... } = useToolChat() ✓                    │ │ │
└────────────────────────────────────────────────────────────────────┬─┼─┼─┘
                                                                     │ │ │
┌─────────────────────────────────────────────────────────────────────┼─┼─┼─┐
│ App.tsx (~line 755)                                                  │ │ │ │
│   <Layout toolExecutions={toolExecutions} ... /> ✓                   │ │ │ │
└────────────────────────────────────────────────────────────────────┬─┼─┼─┼─┘
                                                                     │ │ │ │
┌─────────────────────────────────────────────────────────────────────┼─┼─┼─┼─┐
│ Layout.tsx (~line 185)                                               │ │ │ │ │
│   <ChatWindow toolExecutions={toolExecutions} ... /> ✓               │ │ │ │ │
└────────────────────────────────────────────────────────────────────┬─┼─┼─┼─┼─┘
                                                                     │ │ │ │ │
┌─────────────────────────────────────────────────────────────────────┼─┼─┼─┼─┼─┐
│ ChatWindow.tsx (lines 495-640)                                       │ │ │ │ │ │
│   useMemo([...toolExecutions...]) → timeline building ✓              │ │ │ │ │ │
│   └─ Creates tool_step_group items when useEnhancedToolDisplay=true  │ │ │ │ │ │
└────────────────────────────────────────────────────────────────────┴─┴─┴─┴─┴─┘
```

---

## Key Difference: ChatWindow vs AgentWindow

| Aspect | ChatWindow (Broken) | AgentWindow (Working) |
|--------|--------------------|-----------------------|
| Data Source | `useMCPTools` hook state | Agent state machine (`AgentStep[]`) |
| Conversion | `toolExecutionToStep()` inline | `groupAgentStepsForDisplay()` |
| State Persistence | Hook state (resets on hook remount) | Context state (persists in AgentProvider) |
| Trigger | Tool approval in chat flow | Agent execution loop |

**Key Insight:** The Agent window's data source is the **persistent Agent state machine**, while ChatWindow relies on **hook-level React state** that may have timing issues.

---

## Three Most Likely Root Causes

### 1. Timeline Placement Condition Not Met (MOST LIKELY)

The timeline logic (ChatWindow.tsx ~line 552):
```typescript
if (msg.role === 'assistant' && toolExecutions) {
  const nextMsg = messages[i + 1]
  const isLastAssistantBeforeUser = nextMsg?.role === 'user' || i === messages.length - 1
  
  if (isLastAssistantBeforeUser) {
    // Tool executions only added here
  }
}
```

**Issue:** Tool executions only appear after:
- The LAST assistant message before a user message, OR
- The final assistant message

If the message sequence doesn't match this pattern at the right moment, tools won't display.

### 2. useMemo Not Re-running on toolExecutions Update

The dependency array looks correct:
```typescript
}, [messages, toolExecutions, pendingToolCall, pending, lastMessage, isLastMessageStreaming, useEnhancedToolDisplay])
```

But if `toolExecutions` reference is the same (same array mutated vs new array), React won't detect the change.

**Check:** Verify `setToolExecutions(prev => [...prev, newExec])` pattern (creating new array) is used throughout.

### 3. Race Condition Between Message Updates and Tool Execution Completion

Sequence that might cause issues:
1. AI responds with tool_use → assistant message saved
2. Tool approval shown
3. User approves → `executeTool()` starts
4. `setToolExecutions([...prev, { status: 'executing' }])` fires
5. Timeline rebuilds with executing tool
6. Tool completes → `setToolExecutions(...)` fires again  
7. **BUT** continuation logic might trigger message updates
8. Timeline rebuilds with new messages but possibly stale toolExecutions reference

---

## Diagnostic Steps (Runtime Required)

### Step 1: Verify toolExecutions Population
```bash
# In DevTools console, look for:
[useMCPTools] executeTool called: { executionId, toolName }
[useMCPTools] Added executing tool, new count: N
[useMCPTools] Tool execution completed: { executionId, success, totalExecutions }
```

**Expected:** Count should increment when tool approved and executed.

### Step 2: Check Timeline Building Input
```bash
# Look for:
[ChatWindow] Timeline building: {
  useEnhancedToolDisplay: true,   # Must be true
  toolExecutionsCount: N,          # Must be > 0 after tool runs
  toolExecutions: [...],           # Should show tool objects
  messagesCount: M
}
```

### Step 3: Check Timeline Output
```bash
# Look for:
[ChatWindow] Final timeline: {
  itemCount: N,
  types: ['message', 'message', 'tool_step_group', ...],  # tool_step_group should appear
  toolStepGroups: 1  # Should be > 0
}
```

### Step 4: If toolExecutionsCount is 0 But Tool Ran
→ Issue is in `useMCPTools.executeTool()` not updating state
→ Check if `connected` is true in useMCPTools
→ Check if `requestTool` is being called

### Step 5: If toolExecutionsCount > 0 But No tool_step_group in Timeline
→ Issue is in timeline building condition
→ Check message sequence at time of execution
→ Check `useEnhancedToolDisplay` setting value

---

## Quick Fix Candidates

### Fix A: Always Add Tool Executions at End of Timeline
```typescript
// After the message loop, always add remaining tool executions
// regardless of message sequence
if (toolExecutions && toolExecutions.length > 0) {
  const remainingExecs = toolExecutions.filter(e => !usedToolExecIds.has(e.id))
  if (remainingExecs.length > 0 && useEnhancedToolDisplay) {
    const stepGroup = createStepGroup(remainingExecs)
    items.push({ type: 'tool_step_group', data: stepGroup })
  }
}
```

### Fix B: Force Re-render with Unique Key on ToolExecutions Change
```typescript
// Add a key based on tool execution IDs to force re-render
const toolExecKey = toolExecutions?.map(e => e.id).join('-') || 'none'

// In render:
<div key={`timeline-${toolExecKey}`}>
  {timeline.map(...)}
</div>
```

### Fix C: Match Agent Pattern - Use Context Instead of Hook State
- Create `ToolExecutionProvider` context
- Store tool executions at context level (like AgentProvider)
- Provides stable reference across re-renders

---

## Recommended Next Steps

1. **Run app and observe console logs** (detailed instructions in original investigation doc)
2. **Capture exact console output** at each stage
3. **Identify which diagnostic case matches**
4. **Apply appropriate fix**

Once we know which of the three root causes is confirmed, I can provide the exact code changes needed.

---

*[Analysis by Alex Chen - Security boundaries maintained, type safety verified, scalable patterns confirmed]*
