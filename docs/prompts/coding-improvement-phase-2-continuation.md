# Phase 2 Continuation: Fix TypeScript Errors & Complete Implementation

**Reference Design:** `/docs/designs/CODING_CAPABILITY_IMPROVEMENT_DESIGN.md`  
**Parent Prompt:** `/docs/prompts/coding-improvement-phase-2.md`  
**Status:** In Progress - TypeScript errors need resolution  
**Priority:** High  

---

## Context

Phase 2 implementation is ~60% complete. The Anthropic and OpenAI providers have been updated with native tool calling support, but there are TypeScript compilation errors in `toolFormatter.ts` related to Gemini's type system.

### What's Been Completed

1. **Anthropic Provider** (`src/main/providers/anthropic.ts`) - DONE
   - Native `tool_use` streaming with JSON accumulation
   - Emits `ai:function_call` IPC events with `toolUseId`
   - 221 lines, fully implemented

2. **OpenAI Provider** (`src/main/providers/openai.ts`) - DONE
   - Native function calling with streaming argument accumulation
   - Tracks multiple parallel tool calls via Map
   - Emits `ai:function_call` IPC events with `toolCallId`
   - 270 lines, fully implemented

3. **Tool Formatter** (`src/main/providers/toolFormatter.ts`) - PARTIAL
   - Added `toGeminiFunctions()` with proper return type
   - Added `sanitizeSchemaForGemini()` function
   - **HAS TYPE ERRORS** - needs SchemaType enum fix

---

## Current TypeScript Errors

Run `npm run typecheck` to see these errors:

```
src/main/providers/toolFormatter.ts(95,7): error TS2820: Type '"OBJECT"' is not assignable to type 'SchemaType'. Did you mean 'SchemaType.OBJECT'?
src/main/providers/toolFormatter.ts(103,5): error TS2820: Type '"OBJECT"' is not assignable to type 'SchemaType'. Did you mean 'SchemaType.OBJECT'?
src/main/providers/toolFormatter.ts(104,5): error TS2322: Type 'Record<string, unknown>' is not assignable to type '{ [k: string]: Schema; }'.
src/main/providers/gemini.ts(145,11): error TS2322: Type '{ functionDeclarations: object[]; }[] | undefined' is not assignable to type 'Tool[] | undefined'.
```

---

## Step 1: Fix toolFormatter.ts Type Errors

The issue is that Gemini's SDK uses an enum `SchemaType` not string literals. Fix the imports and schema function:

**File:** `src/main/providers/toolFormatter.ts`

Replace the current import and `sanitizeSchemaForGemini` function:

```typescript
// At the top of the file, update imports:
import type { ToolDefinition } from '../mcp/types'
import { SchemaType, type FunctionDeclaration, type Schema } from '@google/generative-ai'

// Update the sanitizeSchemaForGemini function:
/**
 * Sanitize JSON schema specifically for Gemini's FunctionDeclarationSchema type
 * Gemini requires SchemaType enum values, not string literals
 */
function sanitizeSchemaForGemini(schema: ToolDefinition['inputSchema']): Schema {
  if (!schema) {
    return {
      type: SchemaType.OBJECT,
      properties: {}
    }
  }

  // Convert properties to Gemini Schema format
  const properties: Record<string, Schema> = {}
  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      properties[key] = convertPropertyToSchema(value as Record<string, unknown>)
    }
  }

  const result: Schema = {
    type: SchemaType.OBJECT,
    properties
  }

  // Only include required if it's a non-empty array
  if (schema.required && Array.isArray(schema.required) && schema.required.length > 0) {
    result.required = schema.required
  }

  // Include description if present
  if (schema.description) {
    result.description = schema.description
  }

  return result
}

/**
 * Convert a JSON Schema property to Gemini Schema format
 */
function convertPropertyToSchema(prop: Record<string, unknown>): Schema {
  const type = prop.type as string
  
  // Map JSON Schema types to Gemini SchemaType
  const typeMap: Record<string, SchemaType> = {
    'string': SchemaType.STRING,
    'number': SchemaType.NUMBER,
    'integer': SchemaType.INTEGER,
    'boolean': SchemaType.BOOLEAN,
    'array': SchemaType.ARRAY,
    'object': SchemaType.OBJECT
  }
  
  const schema: Schema = {
    type: typeMap[type] || SchemaType.STRING
  }
  
  if (prop.description) {
    schema.description = prop.description as string
  }
  
  if (prop.enum) {
    schema.enum = prop.enum as string[]
  }
  
  // Handle array items
  if (type === 'array' && prop.items) {
    schema.items = convertPropertyToSchema(prop.items as Record<string, unknown>)
  }
  
  // Handle nested object properties
  if (type === 'object' && prop.properties) {
    const nestedProps: Record<string, Schema> = {}
    for (const [key, value] of Object.entries(prop.properties as Record<string, unknown>)) {
      nestedProps[key] = convertPropertyToSchema(value as Record<string, unknown>)
    }
    schema.properties = nestedProps
  }
  
  return schema
}
```

---

## Step 2: Update Gemini Provider Tool Config

**File:** `src/main/providers/gemini.ts`

The `toGeminiFunctions` now returns `FunctionDeclaration[]`. Update the tool config section:

```typescript
// Around line 125-140, update the tool configuration:
import { toGeminiFunctions } from './toolFormatter'
import type { Tool } from '@google/generative-ai'

// In streamResponse, update the tool config building:
let tools: Tool[] | undefined
if (enableTools) {
  const mcpTools = mcpManager.getAvailableTools()
  if (mcpTools.length > 0) {
    const functionDeclarations = toGeminiFunctions(mcpTools)
    tools = [{
      functionDeclarations
    }]
    console.log(`[Gemini] ✅ Configured ${functionDeclarations.length} native functions`)
  }
}

// Then use `tools` directly in getGenerativeModel:
const model = genAI.getGenerativeModel(
  {
    model: modelId,
    systemInstruction: systemMessage?.content,
    tools: tools
  },
  { apiVersion: 'v1beta' }
)
```

---

## Step 3: Verify TypeScript Compilation

After making the fixes:

```bash
cd /Users/cory.naegle/ArborChat
npm run typecheck
```

All errors should be resolved.

---

## Step 4: Add Parallel Tool Execution Support

**File:** `src/renderer/src/hooks/useAgentRunner.ts`

Add support for handling multiple function calls. The current implementation handles single function calls. Add this new handler:

```typescript
// Add new ref for tracking multiple pending function calls
const pendingFunctionCallsRef = useRef<Array<{
  tool: string
  args: Record<string, unknown>
  explanation: string
  toolCallId?: string
}>>([])

// In the onFunctionCall handler (around line 430), accumulate calls:
if (window.api.onFunctionCall) {
  const cleanupFn = window.api.onFunctionCall((data) => {
    console.log('[AgentRunner] ✅ Native function call received:', data.name)
    
    // Accumulate function calls (providers may emit multiple)
    pendingFunctionCallsRef.current.push({
      tool: data.name,
      args: data.args,
      explanation: 'Native function call',
      toolCallId: data.toolCallId || data.toolUseId
    })
  })
  cleanupFunctionCallRef.current = cleanupFn
}

// In the onDone handler, process accumulated calls:
// After stream completes, check for accumulated function calls
const pendingCalls = pendingFunctionCallsRef.current
pendingFunctionCallsRef.current = [] // Reset

if (pendingCalls.length > 0) {
  if (pendingCalls.length === 1) {
    // Single tool call - use existing flow
    const toolCall = pendingCalls[0]
    await handleToolCall(agent, toolCall, finalContent, finalContent)
  } else {
    // Multiple tool calls - process in parallel
    await handleParallelToolCalls(agent, pendingCalls, finalContent)
  }
  return
}
```

---

## Step 5: Implement handleParallelToolCalls

Add this function to `useAgentRunner.ts`:

```typescript
/**
 * Handle multiple tool calls in parallel
 * Auto-approved tools execute simultaneously, others queue for batch approval
 */
const handleParallelToolCalls = useCallback(async (
  agent: Agent,
  toolCalls: Array<{ tool: string; args: Record<string, unknown>; explanation: string }>,
  originalContent: string
) => {
  if (!isMountedRef.current) return
  
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
  
  // Execute auto-approved tools in parallel
  const results: string[] = []
  if (autoApprovable.length > 0) {
    const executionStart = Date.now()
    
    const parallelResults = await Promise.allSettled(
      autoApprovable.map(async (tc) => {
        const step = addAgentStep(agentId, {
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
        
        try {
          const result = await executeToolInternal(tc.tool, tc.args, tc.explanation)
          recordToolExecution(tc.tool, tc.args, result.success)
          
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
          
          return { tool: tc.tool, result }
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
          throw error
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
        results.push(formatToolResult(tc.tool, r.value.result.result, r.value.result.error))
      } else {
        results.push(formatToolResult(tc.tool, null, String(r.reason)))
      }
    }
  }
  
  // Store results for next iteration
  if (results.length > 0) {
    pendingToolResultRef.current = results.join('\n\n')
  }
  
  // Handle tools that need approval
  if (needsApproval.length > 0) {
    // For now, process first one that needs approval
    // TODO: Implement batch approval UI
    const tc = needsApproval[0]
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
  
  // All tools were auto-approved and executed, continue
  if (autoApprovable.length > 0) {
    setRunnerState(prev => ({ ...prev, isRunning: true }))
    isExecutingRef.current = false
    setTimeout(() => executeLoop(), 100)
  }
}, [agentId, addAgentStep, updateAgentStep, executeToolInternal, 
    updateAgentStatus, setPendingTool, executeLoop, recordToolExecution, formatToolResult])
```

---

## Step 6: Add executeToolInternal Helper

If not already present, add this helper function:

```typescript
/**
 * Internal tool execution without approval flow
 */
const executeToolInternal = useCallback(async (
  toolName: string,
  args: Record<string, unknown>,
  explanation: string
): Promise<{ success: boolean; result?: string; error?: string }> => {
  try {
    // Log to work journal
    if (workSessionIdRef.current) {
      await logToolRequest(workSessionIdRef.current, toolName, args, explanation)
      entryCountRef.current++
    }
    
    // Execute via MCP
    const result = await window.api.mcp.executeTool(toolName, args)
    
    // Log result
    if (workSessionIdRef.current) {
      await logToolResult(workSessionIdRef.current, toolName, result.success, result.result)
      entryCountRef.current++
      await maybeCreateCheckpoint()
    }
    
    // Detect and log file operations
    await detectAndLogFileOperations(toolName, args, result)
    
    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    
    if (workSessionIdRef.current) {
      await logError(workSessionIdRef.current, 'tool_error', errorMsg, true)
    }
    
    return { success: false, error: errorMsg }
  }
}, [logToolRequest, logToolResult, logError, maybeCreateCheckpoint, detectAndLogFileOperations])
```

---

## Verification Checklist

After completing all steps:

- [ ] Run `npm run typecheck` - No TypeScript errors
- [ ] Test Gemini native function calling still works
- [ ] Test Anthropic with Claude Sonnet - verify native tool_use
- [ ] Test OpenAI with GPT-4.1 - verify native function calling
- [ ] Test parallel execution with agent requesting multiple reads
- [ ] Verify tool results are properly formatted and sent back to AI

---

## Testing Commands

```bash
# Verify compilation
npm run typecheck

# Start development server
npm run dev

# Test sequence:
# 1. Configure Anthropic API key in settings
# 2. Select Claude Sonnet 4.5 model
# 3. Create agent with: "Read the package.json and tsconfig.json files"
# 4. Verify logs show "Native function call received" (not text parsing)
# 5. Verify parallel execution timing in console
```

---

## Future Enhancement: Batch Approval UI

The batch approval UI (`BatchToolApproval.tsx`) is deferred to a follow-up task. Current implementation processes tools needing approval one at a time. The component design is in the main Phase 2 prompt.

---

## Next Phase

After completing this continuation, proceed to:
- **Phase 3:** Verification & Reliability (Git integration, TypeScript checks, ESLint)

Reference: `/docs/prompts/coding-improvement-phase-3.md`
