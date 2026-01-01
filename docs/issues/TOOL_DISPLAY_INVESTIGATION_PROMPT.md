# Continue: Tool Results Not Displaying in Accordion Style

## Issue Summary
Tool executions in the normal ChatWindow are not displaying in the enhanced accordion-style format (ToolStepGroup with Request/Response sections). The feature works correctly in the Agent window but not in regular chat.

## Project Context
ArborChat is an Electron-based AI chat application at `/Users/cory.naegle/ArborChat`. Use Alex Chen architect persona from `/Users/cory.naegle/ArborChat/ARCHITECT_PERSONA.md`.

## What's Been Verified ✓

### 1. Data Flow is Correct
```
useToolChat() → App.tsx → Layout.tsx → ChatWindow.tsx
     ↓
toolExecutions prop passes through correctly
```

### 2. Timeline Building Logic (ChatWindow.tsx lines 495-640)
- `useEnhancedToolDisplay` setting is read from SettingsContext
- Logic correctly branches: `true` → `tool_step_group`, `false` → `tool_execution`
- Debug console.log statements are already in place

### 3. Conversion Function Works (stepExtractor.ts)
- `toolExecutionToStep()` properly maps ToolExecution → ToolStep
- `inferServerFromTool()` correctly identifies server names
- `pendingToolToStep()` handles pending approvals

### 4. Render Logic Handles Both Cases (ChatWindow.tsx lines 680-760)
- `tool_step_group` → `<ToolStepGroup>` component
- `tool_execution` → `<InlineToolCall>` (legacy)

### 5. Tool Execution Tracking (useMCPTools.ts)
- `executeTool()` adds items to `toolExecutions` array
- Status updates flow: executing → completed/error

## Suspected Root Causes (Not Yet Verified)

1. **Timing Issue**: `toolExecutions` array may be empty or stale when timeline `useMemo` runs
2. **State Not Propagating**: React state update may not trigger re-render
3. **Conversation Switch Clearing**: `toolExecutions` may be cleared on conversation change but not repopulated

## Key Files to Examine

| File | Purpose | Key Lines |
|------|---------|-----------|
| `src/renderer/src/components/ChatWindow.tsx` | Timeline building & rendering | 495-640, 680-760 |
| `src/renderer/src/hooks/useToolChat.ts` | Tool state orchestration | Full file |
| `src/renderer/src/hooks/useMCPTools.ts` | Tool execution tracking | `executeTool()`, `toolExecutions` state |
| `src/renderer/src/App.tsx` | Tool approval handlers | `onToolApprove` (~line 633) |
| `src/renderer/src/components/mcp/ToolStepGroup.tsx` | Accordion display component | Full file |

## Debug Logging Already Present

```typescript
// ChatWindow.tsx timeline useMemo
console.log('[ChatWindow] Timeline building:', {
  useEnhancedToolDisplay,
  toolExecutionsCount: toolExecutions?.length || 0,
  toolExecutions: toolExecutions?.map(e => ({ id: e.id, toolName: e.toolName, status: e.status })),
  ...
})

console.log('[ChatWindow] Final timeline:', {
  itemCount: items.length,
  types: items.map(i => i.type),
  toolStepGroups: items.filter(i => i.type === 'tool_step_group').length,
  ...
})
```

## Next Steps to Diagnose

### Step 1: Run and Observe Console
1. Start ArborChat: `npm run dev`
2. Open DevTools console (Cmd+Option+I)
3. Start a normal chat conversation
4. Trigger a tool call (e.g., "Read the file package.json")
5. Approve the tool when prompted
6. Check console for `[ChatWindow]` logs

### Step 2: Verify What Console Shows
Look for these log patterns:
- `[ChatWindow] Timeline building:` - Check `toolExecutionsCount`
- `[useMCPTools] Tool execution completed:` - Verify tool actually executed
- `[ChatWindow] Final timeline:` - Check if `tool_step_group` appears in types

### Step 3: Compare with Agent Window
The Agent window works correctly. Compare:
- `src/renderer/src/components/agent/AgentWindow.tsx` - How does it handle tool display?
- Does it use the same `toolExecutions` source or different state?

### Step 4: Possible Fixes Based on Findings

**If toolExecutions is empty:**
- Check if `useMCPTools` hook is being used correctly
- Verify `executeTool()` is being called (not just `requestTool`)

**If toolExecutions has data but timeline doesn't show groups:**
- Check `useEnhancedToolDisplay` value in console
- Verify SettingsContext is providing correct default

**If tool_step_group is in timeline but not rendering:**
- Check ToolStepGroup component for render issues
- Verify steps array is populated correctly

## Testing Checklist

- [ ] Console shows `[useMCPTools] executeTool called` when tool approved
- [ ] Console shows `toolExecutionsCount > 0` after tool completes
- [ ] Console shows `tool_step_group` in timeline types array
- [ ] DOM shows `ToolStepGroup` component (not just InlineToolCall)
- [ ] Accordion expands/collapses correctly

## Related Design Document
`/Users/cory.naegle/ArborChat/docs/designs/TOOL_WINDOW_ENHANCEMENT_DESIGN.md`
