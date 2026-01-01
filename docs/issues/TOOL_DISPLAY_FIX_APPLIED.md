# Tool Display Fix Applied

**Date:** December 31, 2025  
**Fixed by:** Alex Chen (Distinguished Software Architect)  
**Status:** ✅ IMPLEMENTED - Needs Runtime Verification

---

## Root Cause Identified

The issue was in `ChatWindow.tsx` timeline building logic. The condition:

```typescript
const isLastAssistantBeforeUser = nextMsg?.role === 'user' || i === messages.length - 1
```

This failed when the message sequence became:
1. User message
2. Assistant message (tool request)
3. Assistant message (continuation)

Since the tool request message was followed by another assistant message (not a user message or end of array), the condition evaluated to `false`, and tool executions were not added to the timeline at the correct position.

## The Fix

Changed from restrictive condition to inclusive approach:

**Before (Lines 553-593):**
```typescript
if (msg.role === 'assistant' && toolExecutions) {
  const nextMsg = messages[i + 1]
  const isLastAssistantBeforeUser = nextMsg?.role === 'user' || i === messages.length - 1
  
  if (isLastAssistantBeforeUser) {
    // Only add tool executions when condition met
    // ...
  }
}
```

**After:**
```typescript
if (msg.role === 'assistant' && toolExecutions) {
  // FIX: Add tool executions after EVERY assistant message
  // The usedToolExecIds set prevents duplicates, so tools appear after the FIRST
  // assistant message they encounter (which is the one that requested them)
  const unusedExecs = toolExecutions.filter(exec => !usedToolExecIds.has(exec.id))
  
  if (unusedExecs.length > 0) {
    // Add tool executions and mark as used
    // ...
  }
}
```

## Why This Works

1. **First assistant message** (tool request): Unused tool executions exist → Added to timeline → Marked as used
2. **Second assistant message** (continuation): Filter finds no unused executions → Nothing added
3. **Fallback at end**: All executions already used → Nothing added (cleanup still works)

The `usedToolExecIds` Set ensures each tool execution only appears once in the timeline, and always in the correct position (after the first assistant message that encounters it).

## Files Modified

- `/Users/cory.naegle/ArborChat/src/renderer/src/components/ChatWindow.tsx`
  - Lines 553-592 (approx) - Removed `isLastAssistantBeforeUser` condition

## Verification Steps

1. **Build Check:** ✅ TypeScript compiles without errors
2. **Runtime Test Needed:**
   - Start a chat conversation
   - Send: "Read the file package.json"
   - Approve the tool
   - Verify accordion-style ToolStepGroup appears between tool request and continuation
   - Check console for: `[ChatWindow] Adding tool executions to timeline: { ... afterMessageIndex: N }`

## Related Files

- Analysis: `/Users/cory.naegle/ArborChat/docs/issues/TOOL_DISPLAY_ANALYSIS.md`
- Investigation prompt: `/Users/cory.naegle/ArborChat/docs/issues/TOOL_DISPLAY_INVESTIGATION_PROMPT.md`
- Continuation prompt: `/Users/cory.naegle/ArborChat/docs/issues/TOOL_DISPLAY_CONTINUATION_PROMPT.md`
- Design spec: `/Users/cory.naegle/ArborChat/docs/designs/TOOL_WINDOW_ENHANCEMENT_DESIGN.md`

---

*[Fix applied by Alex Chen - Security boundaries maintained, type safety verified]*
