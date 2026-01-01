# Continue: Tool Display Investigation - Runtime Verification

## Context
You are Alex Chen, Distinguished Software Architect. Activate with: *[Architecting as Alex Chen — evaluating through security boundaries, type safety, and scalable patterns...]*

## Project Location
`/Users/cory.naegle/ArborChat` - Electron-based AI chat application

## Problem Statement
Tool executions in normal ChatWindow are NOT displaying in the enhanced accordion-style format (ToolStepGroup). The feature works correctly in the Agent window but not in regular chat.

## Investigation Status: ARCHITECTURE VERIFIED ✓

The complete data flow has been traced and verified:
```
useMCPTools.ts → useToolChat.ts → App.tsx → Layout.tsx → ChatWindow.tsx
```

All prop passing is correct. The issue is a **runtime timing/state problem**.

## Key Files Already Analyzed
- `/Users/cory.naegle/ArborChat/src/renderer/src/hooks/useMCPTools.ts` - Tool execution tracking ✓
- `/Users/cory.naegle/ArborChat/src/renderer/src/hooks/useToolChat.ts` - Tool state orchestration ✓
- `/Users/cory.naegle/ArborChat/src/renderer/src/App.tsx` - Prop passing ✓
- `/Users/cory.naegle/ArborChat/src/renderer/src/components/Layout.tsx` - Prop passing ✓
- `/Users/cory.naegle/ArborChat/src/renderer/src/components/ChatWindow.tsx` - Timeline building (lines 495-640) ✓
- `/Users/cory.naegle/ArborChat/src/renderer/src/components/mcp/ToolStepGroup.tsx` - Display component ✓
- `/Users/cory.naegle/ArborChat/src/renderer/src/lib/stepExtractor.ts` - Conversion functions ✓

## Analysis Document
Full architectural analysis saved to: `/Users/cory.naegle/ArborChat/docs/issues/TOOL_DISPLAY_ANALYSIS.md`

## Three Suspected Root Causes

### 1. Timeline Placement Condition (MOST LIKELY)
Tool executions only added after "last assistant message before user message" - timing may not match.

### 2. useMemo Not Detecting toolExecutions Change
If array is mutated instead of replaced, React won't re-render.

### 3. Race Condition
Message updates and tool execution completion may have timing conflict.

## NEXT STEPS (Runtime Verification Required)

### Step 1: Run the App
```bash
cd /Users/cory.naegle/ArborChat
npm run dev
```

### Step 2: Open DevTools Console
Press `Cmd+Option+I` in the app window

### Step 3: Trigger a Tool Call
1. Start a normal chat conversation
2. Send: "Read the file package.json"
3. Approve the tool when prompted

### Step 4: Capture Console Output
Look for these log patterns and record the values:

```
[useMCPTools] executeTool called: { executionId, toolName }
[useMCPTools] Added executing tool, new count: N
[useMCPTools] Tool execution completed: { executionId, success, totalExecutions }

[ChatWindow] Timeline building: {
  useEnhancedToolDisplay: ???,     # Should be true
  toolExecutionsCount: ???,         # Should be > 0
  ...
}

[ChatWindow] Final timeline: {
  types: [...],                     # Should include 'tool_step_group'
  toolStepGroups: ???               # Should be > 0
}
```

### Step 5: Diagnose Based on Output

**If `toolExecutionsCount: 0` but tool ran:**
→ Issue in useMCPTools state update

**If `toolExecutionsCount > 0` but no `tool_step_group` in types:**
→ Issue in timeline placement condition (ChatWindow.tsx ~line 552)

**If `tool_step_group` in types but not rendering:**
→ Issue in ToolStepGroup component

## Quick Fix Options (Apply After Diagnosis)

### Fix A: Force Tool Executions Display
In ChatWindow.tsx, after the message loop (~line 595), ensure remaining executions always display:
```typescript
// Current code already has this fallback - verify it's being reached
if (toolExecutions) {
  const remainingExecs = toolExecutions.filter(exec => !usedToolExecIds.has(exec.id))
  // ...
}
```

### Fix B: Add Debug Log in useMCPTools
Add logging in `setToolExecutions` calls to verify state updates.

### Fix C: Match Agent Pattern
If state timing is the issue, consider moving tool execution state to a React Context (like AgentProvider does).

## Related Documents
- Original investigation: `/Users/cory.naegle/ArborChat/docs/issues/TOOL_DISPLAY_INVESTIGATION_PROMPT.md`
- Analysis: `/Users/cory.naegle/ArborChat/docs/issues/TOOL_DISPLAY_ANALYSIS.md`
- Design spec: `/Users/cory.naegle/ArborChat/docs/designs/TOOL_WINDOW_ENHANCEMENT_DESIGN.md`

## Success Criteria
- [ ] Console shows `toolExecutionsCount > 0` after tool completes
- [ ] Console shows `tool_step_group` in timeline types
- [ ] DOM renders `ToolStepGroup` component (accordion with Request/Response sections)
- [ ] Accordion expands/collapses correctly

---

**To continue:** Run the app, capture console output, then report findings. Based on which diagnostic case matches, implement the appropriate fix.
