# Phase 2 Completion: Implement Parallel Tool Execution & Fix Type Errors

**Reference Design:** `/docs/designs/CODING_CAPABILITY_IMPROVEMENT_DESIGN.md`  
**Parent Prompt:** `/docs/prompts/coding-improvement-phase-2-continuation.md`  
**Status:** ~85% Complete - Missing handleParallelToolCalls implementation  
**Priority:** High  
**Author:** Alex Chen (Distinguished Software Architect)  
**Date:** December 30, 2025  

---

## Context

Phase 2 implementation is nearly complete. Native tool calling is working for Anthropic, OpenAI, and Gemini providers. The `useAgentRunner.ts` hook has been updated to accumulate multiple native function calls, but the **`handleParallelToolCalls` function is referenced but never implemented**, causing TypeScript compilation to fail.

### What's Complete ✅

1. **toolFormatter.ts** - Fully typed with SchemaType enum, all functions working
2. **Gemini Provider** - Native function calling with proper Tool[] configuration
3. **Anthropic Provider** - Native tool_use streaming with toolUseId
4. **OpenAI Provider** - Native function calling with toolCallId  
5. **Function Call Accumulation** - `pendingNativeFunctionCallsRef` collects parallel calls

### What's Broken ❌

**TypeScript Compilation Errors (Phase 2 related):**

```
src/renderer/src/hooks/useAgentRunner.ts(440,30): error TS2339: Property 'toolCallId' does not exist on type '{ name: string; args: Record<string, unknown>; }'.
src/renderer/src/hooks/useAgentRunner.ts(440,49): error TS2339: Property 'toolUseId' does not exist on type '{ name: string; args: Record<string, unknown>; }'.
src/renderer/src/hooks/useAgentRunner.ts(492,19): error TS2304: Cannot find name 'handleParallelToolCalls'.
```

---

## Step 1: Fix IPC Type Definition for Function Calls

The `onFunctionCall` callback type doesn't include the optional `toolCallId` and `toolUseId` fields that providers emit.

**File:** `src/preload/index.d.ts`

Find line ~549 and update the type:

```typescript
// BEFORE:
onFunctionCall: (callback: (data: { name: string; args: Record<string, unknown> }) => void) => () => void

// AFTER:
onFunctionCall: (callback: (data: { 
  name: string
  args: Record<string, unknown>
  toolCallId?: string  // OpenAI function call ID
  toolUseId?: string   // Anthropic tool_use block ID
}) => void) => () => void
```

---

## Step 2: Implement handleParallelToolCalls Function

Add this function to `src/renderer/src/hooks/useAgentRunner.ts`.

**Location:** Insert after the `handleToolCall` function definition (around line 620, after the closing of handleToolCall).

```typescript
/**
 * Handle multiple tool calls in parallel
 * Auto-approved tools execute simultaneously, others queue for sequential approval
 * 
 * PARALLEL EXECUTION STRATEGY:
 * 1. Classify all tool calls by auto-approval status
 * 2. Execute all auto-approved tools concurrently via Promise.allSettled
 * 3. Collect results and format for AI context
 * 4. Queue first tool needing approval (batch approval UI is deferred)
 * 5. Continue agent loop with combined results
 */
const handleParallelToolCalls = useCallback(async (
  agent: Agent,
  toolCalls: Array<{ 
    tool: string
    args: Record<string, unknown>
    explanation: string
    toolCallId?: string 
  }>,
  originalContent: string
) => {
  if (!isMountedRef.current) return
  
  console.log(`[AgentRunner] Processing ${toolCalls.length} parallel tool calls`)
  
  // Get config for always-approve list
  let alwaysApproveTools: string[] = []
  try {
    const config = await window.api.mcp.getConfig()
    alwaysApproveTools = config.alwaysApproveTools || []
  } catch (e) {
    console.warn('[AgentRunner] Failed to get MCP config:', e)
  }
  
  // Separate into auto-approvable and needs-approval
  const autoApprovable = toolCalls.filter(tc => 
    shouldAutoApprove(tc.tool, agent.config.toolPermission, alwaysApproveTools)
  )
  const needsApproval = toolCalls.filter(tc =>
    !shouldAutoApprove(tc.tool, agent.config.toolPermission, alwaysApproveTools)
  )
  
  console.log(`[AgentRunner] Parallel execution: ${autoApprovable.length} auto-approve, ${needsApproval.length} need approval`)
  
  // Results accumulator
  const results: string[] = []
  
  // Execute auto-approved tools in parallel
  if (autoApprovable.length > 0) {
    const executionStart = Date.now()
    
    // Create steps for all parallel tools
    const stepsAndCalls = autoApprovable.map(tc => ({
      tc,
      step: addAgentStep(agentId, {
        type: 'tool_call',
        content: `Calling ${tc.tool}`,
        timestamp: Date.now(),
        toolCall: {
          name: tc.tool,
          args: tc.args,
          status: 'approved',
          explanation: tc.explanation
        }
      })
    }))
    
    // Execute all in parallel
    const parallelResults = await Promise.allSettled(
      stepsAndCalls.map(async ({ tc, step }) => {
        try {
          // Log to work journal
          if (workSessionIdRef.current) {
            const riskLevel = getToolRiskLevel(tc.tool)
            await logToolRequest(workSessionIdRef.current, tc.tool, tc.args, riskLevel)
            entryCountRef.current++
          }
          
          // Execute via MCP
          const result = await executeToolInternal(tc.tool, tc.args, tc.explanation)
          
          // Log result to work journal
          if (workSessionIdRef.current) {
            const resultStr = typeof result.result === 'string' ? result.result : String(result.result ?? '')
            await logToolResult(
              workSessionIdRef.current,
              tc.tool,
              result.success,
              resultStr,
              { truncated: resultStr.length > 5000, errorMessage: result.error }
            )
            entryCountRef.current++
            
            // Check for file operations
            await detectAndLogFileOperations(tc.tool, tc.args, {
              success: result.success,
              result: resultStr
            })
          }
          
          // Record for completion verification
          recordToolExecution(tc.tool, tc.args, result.success)
          
          // Update step with result
          updateAgentStep(agentId, step.id, {
            toolCall: {
              name: tc.tool,
              args: tc.args,
              status: result.success ? 'completed' : 'failed',
              result: result.result,
              error: result.error,
              explanation: tc.explanation
            }
          })
          
          return { tool: tc.tool, result, step }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          recordToolExecution(tc.tool, tc.args, false)
          
          updateAgentStep(agentId, step.id, {
            toolCall: {
              name: tc.tool,
              args: tc.args,
              status: 'failed',
              error: errorMsg,
              explanation: tc.explanation
            }
          })
          
          throw { tool: tc.tool, error: errorMsg }
        }
      })
    )
    
    const executionDuration = Date.now() - executionStart
    console.log(`[AgentRunner] Parallel execution completed in ${executionDuration}ms`)
    
    // Build combined result context
    for (let i = 0; i < parallelResults.length; i++) {
      const r = parallelResults[i]
      const tc = autoApprovable[i]
      
      if (r.status === 'fulfilled') {
        const { result } = r.value
        results.push(formatToolResult(tc.tool, result.result, result.error))
      } else {
        // Extract error from rejection
        const rejection = r.reason as { tool: string; error: string }
        results.push(formatToolResult(tc.tool, null, rejection.error))
      }
    }
    
    // Add combined tool result step
    if (results.length > 0) {
      addAgentStep(agentId, {
        type: 'tool_result',
        content: `Parallel execution of ${autoApprovable.length} tools:\n\n${results.join('\n\n---\n\n')}`,
        timestamp: Date.now()
      })
    }
    
    await maybeCreateCheckpoint()
  }
  
  // Store combined results for next iteration
  if (results.length > 0) {
    pendingToolResultRef.current = results.join('\n\n')
  }
  
  // Handle tools that need approval (process first one, queue rest)
  if (needsApproval.length > 0) {
    // For now, process first one that needs approval
    // TODO: Implement batch approval UI for multiple pending tools
    const tc = needsApproval[0]
    
    // Log warning if multiple tools need approval
    if (needsApproval.length > 1) {
      console.warn(`[AgentRunner] ${needsApproval.length} tools need approval, processing first: ${tc.tool}`)
      addAgentStep(agentId, {
        type: 'thinking',
        content: `⚠️ Multiple tools requested: ${needsApproval.map(t => t.tool).join(', ')}. Processing "${tc.tool}" first.`,
        timestamp: Date.now()
      })
    }
    
    // Add step for pending tool
    addAgentStep(agentId, {
      type: 'tool_call',
      content: `Awaiting approval: ${tc.tool}`,
      timestamp: Date.now(),
      toolCall: {
        name: tc.tool,
        args: tc.args,
        status: 'pending',
        explanation: tc.explanation
      }
    })
    
    // Set pending tool for UI
    const toolId = `agent-tool-${Date.now()}`
    setPendingTool(agentId, {
      id: toolId,
      tool: tc.tool,
      args: tc.args,
      explanation: tc.explanation,
      originalContent,
      cleanContent: originalContent
    })
    
    updateAgentStatus(agentId, 'waiting')
    setRunnerState(prev => ({ ...prev, isRunning: false }))
    isExecutingRef.current = false
    return
  }
  
  // All tools were auto-approved and executed, continue the loop
  if (autoApprovable.length > 0) {
    setRunnerState(prev => ({ ...prev, isRunning: true }))
    isExecutingRef.current = false
    setTimeout(() => executeLoop(), 100)
  } else {
    // No tools to execute (shouldn't happen but handle gracefully)
    isExecutingRef.current = false
    setRunnerState(prev => ({ ...prev, isRunning: false }))
  }
}, [
  agentId, 
  addAgentStep, 
  updateAgentStep, 
  executeToolInternal, 
  updateAgentStatus, 
  setPendingTool, 
  executeLoop, 
  recordToolExecution, 
  logToolRequest,
  logToolResult,
  detectAndLogFileOperations,
  maybeCreateCheckpoint
])
```

---

## Step 3: Fix the Call Site

The reference at line ~492 is incomplete. Update it to properly call the function.

**File:** `src/renderer/src/hooks/useAgentRunner.ts`

Find the section around line 485-495 that looks like:

```typescript
if (pendingCalls.length === 1) {
  // Single tool call - use existing flow
  await handleToolCall(agent, pendingCalls[0], finalContent, finalContent)
} else {
  // Multiple tool calls - process in parallel
  handleParallelToolCalls  // ❌ BROKEN - not called!
}
return
```

Replace with:

```typescript
if (pendingCalls.length === 1) {
  // Single tool call - use existing flow
  await handleToolCall(agent, pendingCalls[0], finalContent, finalContent)
} else {
  // Multiple tool calls - process in parallel
  await handleParallelToolCalls(agent, pendingCalls, finalContent)
}
return
```

---

## Step 4: Verify TypeScript Compilation

After making all changes:

```bash
cd /Users/cory.naegle/ArborChat
npm run typecheck
```

**Expected:** The three Phase 2 errors should be resolved:
- ✅ `toolCallId` type error - Fixed by Step 1
- ✅ `toolUseId` type error - Fixed by Step 1  
- ✅ `handleParallelToolCalls` not found - Fixed by Steps 2 & 3

**Note:** There are other TypeScript errors in the notebooks feature that are unrelated to Phase 2.

---

## Step 5: Manual Testing

### Test 1: Single Native Function Call
```
1. Start ArborChat (npm run dev)
2. Configure Anthropic API key
3. Create agent: "Read the package.json file"
4. Verify console shows: "[AgentRunner] ✅ Native function call received: read_file"
5. Verify tool executes and agent continues
```

### Test 2: Parallel Function Calls (OpenAI GPT-4)
```
1. Configure OpenAI API key
2. Select GPT-4.1 model
3. Create agent: "Read package.json and tsconfig.json simultaneously"
4. Verify console shows:
   - "[AgentRunner] Processing 2 parallel tool calls"
   - "[AgentRunner] Parallel execution: 2 auto-approve, 0 need approval"
   - "[AgentRunner] Parallel execution completed in Xms"
5. Verify both results appear in agent steps
```

### Test 3: Mixed Approval Parallel Calls
```
1. Set agent permission to "standard" (safe tools only auto-approve)
2. Create agent: "Read package.json and then create a new file called test.txt"
3. Verify:
   - read_file auto-executes (safe tool)
   - write_file prompts for approval (moderate tool)
   - Console shows: "[AgentRunner] Parallel execution: 1 auto-approve, 1 need approval"
```

---

## Verification Checklist

After completing all steps:

- [ ] `npm run typecheck` passes for useAgentRunner.ts (Phase 2 errors)
- [ ] Single native function calls work (Anthropic, OpenAI, Gemini)
- [ ] Multiple parallel function calls execute concurrently  
- [ ] Auto-approval respects agent permission levels
- [ ] Combined results are properly formatted for AI context
- [ ] Work journal logs all parallel tool executions
- [ ] Completion verification still works with parallel tools

---

## Architecture Notes

### Why Promise.allSettled?

We use `Promise.allSettled` instead of `Promise.all` because:
1. One tool failure shouldn't cancel other parallel executions
2. We need results from all tools (success or failure) for AI context
3. The AI can reason about partial failures and continue appropriately

### Batch Approval UI (Deferred)

The current implementation processes tools needing approval one at a time. A batch approval UI that shows all pending tools simultaneously is deferred to a follow-up task. The component design is in `/docs/prompts/coding-improvement-phase-2.md`.

### Performance Gains

Parallel execution provides significant speedups for read-heavy operations:
- Sequential: 3 file reads × 100ms = 300ms
- Parallel: 3 file reads = ~100ms (3x faster)

This is particularly valuable for code analysis tasks where agents need to read multiple files.

---

## Next Steps

After completing Phase 2:

1. **Phase 3: Verification & Reliability** (`/docs/prompts/coding-improvement-phase-3.md`)
   - Git integration for auto-commits
   - TypeScript verification before claiming completion
   - ESLint checks

2. **Batch Approval UI** (separate task)
   - `BatchToolApproval.tsx` component
   - Multi-select approval/rejection
   - Argument editing for multiple tools
