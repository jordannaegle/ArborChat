# Coding Capability Improvement - Phase 2: Multi-Provider Excellence

**Reference Design:** `/docs/designs/CODING_CAPABILITY_IMPROVEMENT_DESIGN.md`  
**Prerequisite:** Phase 1 completed  
**Estimated Effort:** 2-3 weeks  
**Priority:** High  

---

## Objective

Extend native tool calling to all major providers and implement parallel tool execution:

1. Native Tool Calling for Anthropic (Claude's tool_use format)
2. Native Tool Calling for OpenAI (Function calling API)
3. Parallel Tool Execution for faster complex operations
4. Batch Tool Approval UI for multiple pending approvals

---

## Prerequisites

- Phase 1 completed and verified
- `src/main/providers/toolFormatter.ts` exists with all converter functions
- Native function calling working for Gemini

---

## Implementation Steps

### Step 1: Update Anthropic Provider for Native Tool Use

Modify the Anthropic provider to use Claude's native tool_use format.

**File:** `src/main/providers/anthropic.ts`

```typescript
// src/main/providers/anthropic.ts

import Anthropic from '@anthropic-ai/sdk'
import { AIProvider } from './base'
import { AIModel, StreamParams } from './types'
import { toAnthropicTools } from './toolFormatter'
import { mcpManager } from '../mcp/manager'

const ANTHROPIC_MODELS: AIModel[] = [
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: 'Most intelligent - Complex reasoning & analysis',
    provider: 'anthropic',
    isLocal: false
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Balanced - Fast & capable',
    provider: 'anthropic',
    isLocal: false
  }
]

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic'

  canHandleModel(modelId: string): boolean {
    return ANTHROPIC_MODELS.some((m) => m.id === modelId) || modelId.startsWith('claude-')
  }

  async validateConnection(apiKey?: string): Promise<boolean> {
    if (!apiKey) {
      console.error('[Anthropic] No API key provided')
      return false
    }

    try {
      const client = new Anthropic({ apiKey })
      await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })
      return true
    } catch (error) {
      console.error('[Anthropic] validateConnection ERROR:', error)
      return false
    }
  }

  async getAvailableModels(_apiKey?: string): Promise<AIModel[]> {
    return ANTHROPIC_MODELS
  }

  async streamResponse(params: StreamParams, apiKey?: string): Promise<void> {
    if (!apiKey) {
      throw new Error('API key is required for Anthropic provider')
    }

    const { window, messages, modelId, enableTools = true } = params

    console.log('[Anthropic] streamResponse called')
    console.log('[Anthropic] Using model:', modelId)

    try {
      const client = new Anthropic({ apiKey })
      const systemMessage = messages.find((m) => m.role === 'system')

      // Get available tools if enabled
      let tools: Anthropic.Tool[] | undefined
      if (enableTools) {
        const mcpTools = mcpManager.getAvailableTools()
        if (mcpTools.length > 0) {
          tools = toAnthropicTools(mcpTools) as Anthropic.Tool[]
          console.log(`[Anthropic] Configured ${tools.length} native tools`)
        }
      }

      // Convert messages to Anthropic format
      const anthropicMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))

      // Stream the response with tools
      const stream = client.messages.stream({
        model: modelId,
        max_tokens: 8192,
        system: systemMessage?.content,
        messages: anthropicMessages,
        tools: tools
      })

      console.log('[Anthropic] Stream started')
      let fullResponse = ''
      let pendingToolUse: { id: string; name: string; input: Record<string, unknown> } | null = null

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          // Check if this is a tool_use block
          if (event.content_block.type === 'tool_use') {
            pendingToolUse = {
              id: event.content_block.id,
              name: event.content_block.name,
              input: {}
            }
            console.log('[Anthropic] ✅ Tool use block started:', event.content_block.name)
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta as { type: string; text?: string; partial_json?: string }
          
          if (delta.type === 'text_delta' && delta.text) {
            fullResponse += delta.text
            window.webContents.send('ai:token', delta.text)
          } else if (delta.type === 'input_json_delta' && delta.partial_json && pendingToolUse) {
            // Accumulate tool input JSON
            // Note: This comes in chunks, we'll parse it at the end
          }
        } else if (event.type === 'content_block_stop') {
          // If we have a pending tool use, emit it
          if (pendingToolUse) {
            // Get the full tool input from the message
            const message = await stream.finalMessage()
            const toolBlock = message.content.find(
              (block): block is Anthropic.ToolUseBlock => 
                block.type === 'tool_use' && block.id === pendingToolUse!.id
            )
            
            if (toolBlock) {
              window.webContents.send('ai:function_call', {
                name: toolBlock.name,
                args: toolBlock.input as Record<string, unknown>,
                toolUseId: toolBlock.id  // Anthropic needs this for tool_result
              })
            }
            pendingToolUse = null
          }
        }
      }

      console.log('[Anthropic] Stream complete')
      window.webContents.send('ai:done')
    } catch (error: unknown) {
      console.error('[Anthropic] streamResponse ERROR:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      window.webContents.send('ai:error', errorMessage)
      throw error
    }
  }
}
```

### Step 2: Update OpenAI Provider for Function Calling

**File:** `src/main/providers/openai.ts`

```typescript
// src/main/providers/openai.ts

import OpenAI from 'openai'
import { AIProvider } from './base'
import { AIModel, StreamParams } from './types'
import { toOpenAIFunctions } from './toolFormatter'
import { mcpManager } from '../mcp/manager'

const OPENAI_MODELS: AIModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Most capable GPT-4 model',
    provider: 'openai',
    isLocal: false
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and affordable',
    provider: 'openai',
    isLocal: false
  },
  {
    id: 'o1',
    name: 'o1',
    description: 'Advanced reasoning',
    provider: 'openai',
    isLocal: false
  }
]

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai'

  canHandleModel(modelId: string): boolean {
    return (
      OPENAI_MODELS.some((m) => m.id === modelId) ||
      modelId.startsWith('gpt-') ||
      modelId.startsWith('o1') ||
      modelId.startsWith('o3') ||
      modelId.startsWith('o4')
    )
  }

  async validateConnection(apiKey?: string): Promise<boolean> {
    if (!apiKey) return false

    try {
      const client = new OpenAI({ apiKey })
      await client.models.list()
      return true
    } catch (error) {
      console.error('[OpenAI] validateConnection ERROR:', error)
      return false
    }
  }

  async getAvailableModels(_apiKey?: string): Promise<AIModel[]> {
    return OPENAI_MODELS
  }

  async streamResponse(params: StreamParams, apiKey?: string): Promise<void> {
    if (!apiKey) {
      throw new Error('API key is required for OpenAI provider')
    }

    const { window, messages, modelId, enableTools = true } = params

    console.log('[OpenAI] streamResponse called')
    console.log('[OpenAI] Using model:', modelId)

    try {
      const client = new OpenAI({ apiKey })

      // Get available tools if enabled
      let tools: OpenAI.ChatCompletionTool[] | undefined
      if (enableTools) {
        const mcpTools = mcpManager.getAvailableTools()
        if (mcpTools.length > 0) {
          tools = toOpenAIFunctions(mcpTools) as OpenAI.ChatCompletionTool[]
          console.log(`[OpenAI] Configured ${tools.length} functions`)
        }
      }

      // Convert messages to OpenAI format
      const openaiMessages: OpenAI.ChatCompletionMessageParam[] = messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      }))

      // Stream the response
      const stream = await client.chat.completions.create({
        model: modelId,
        messages: openaiMessages,
        tools: tools,
        stream: true
      })

      console.log('[OpenAI] Stream started')
      let fullResponse = ''
      let currentToolCall: {
        id: string
        name: string
        arguments: string
      } | null = null

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta

        // Handle text content
        if (delta?.content) {
          fullResponse += delta.content
          window.webContents.send('ai:token', delta.content)
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            if (toolCall.id) {
              // New tool call starting
              if (currentToolCall) {
                // Emit the previous one
                emitToolCall(window, currentToolCall)
              }
              currentToolCall = {
                id: toolCall.id,
                name: toolCall.function?.name || '',
                arguments: toolCall.function?.arguments || ''
              }
            } else if (currentToolCall && toolCall.function?.arguments) {
              // Continuing to build arguments
              currentToolCall.arguments += toolCall.function.arguments
            }
          }
        }

        // Check for finish reason
        if (chunk.choices[0]?.finish_reason === 'tool_calls' && currentToolCall) {
          emitToolCall(window, currentToolCall)
          currentToolCall = null
        }
      }

      // Emit any remaining tool call
      if (currentToolCall) {
        emitToolCall(window, currentToolCall)
      }

      console.log('[OpenAI] Stream complete')
      window.webContents.send('ai:done')
    } catch (error: unknown) {
      console.error('[OpenAI] streamResponse ERROR:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      window.webContents.send('ai:error', errorMessage)
      throw error
    }
  }
}

function emitToolCall(
  window: Electron.BrowserWindow,
  toolCall: { id: string; name: string; arguments: string }
): void {
  try {
    const args = JSON.parse(toolCall.arguments)
    console.log('[OpenAI] ✅ Function call detected:', toolCall.name)
    window.webContents.send('ai:function_call', {
      name: toolCall.name,
      args: args,
      toolCallId: toolCall.id  // OpenAI needs this for tool response
    })
  } catch (e) {
    console.error('[OpenAI] Failed to parse function arguments:', e)
  }
}
```

### Step 3: Implement Parallel Tool Execution

Update the agent runner to execute multiple tools in parallel.

**File:** `src/renderer/src/hooks/useAgentRunner.ts`

Add a new handler for batch tool execution:

```typescript
// Add new ref for batch function calls
const pendingFunctionCallsRef = useRef<Array<{
  tool: string
  args: Record<string, unknown>
  explanation: string
  toolCallId?: string  // For OpenAI/Anthropic response matching
}>>([])

/**
 * Handle multiple tool calls in parallel
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
  if (autoApprovable.length > 0) {
    const executionStart = Date.now()
    
    const results = await Promise.allSettled(
      autoApprovable.map(async (tc) => {
        // Add step for each tool
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
          
          // Record for completion verification
          recordToolExecution(tc.tool, tc.args, result.success)
          
          // Update step
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
          throw error
        }
      })
    )
    
    const executionDuration = Date.now() - executionStart
    console.log(`[AgentRunner] Parallel execution completed in ${executionDuration}ms`)
    
    // Build combined result context
    const resultsContext = results
      .map((r, i) => {
        const tc = autoApprovable[i]
        if (r.status === 'fulfilled') {
          return formatToolResult(tc.tool, r.value.result.result, r.value.result.error)
        } else {
          return formatToolResult(tc.tool, null, String(r.reason))
        }
      })
      .join('\n\n')
    
    pendingToolResultRef.current = resultsContext
  }
  
  // Handle tools that need approval
  if (needsApproval.length > 0) {
    if (needsApproval.length === 1) {
      // Single tool - use existing flow
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
    } else {
      // Multiple tools - use batch approval
      setPendingToolBatch(agentId, needsApproval.map((tc, i) => ({
        id: `agent-tool-${Date.now()}-${i}`,
        tool: tc.tool,
        args: tc.args,
        explanation: tc.explanation
      })))
    }
    
    updateAgentStatus(agentId, 'waiting')
    setRunnerState(prev => ({ ...prev, isRunning: false }))
    isExecutingRef.current = false
    return
  }
  
  // All tools were auto-approved, continue execution
  if (autoApprovable.length > 0) {
    setRunnerState(prev => ({ ...prev, isRunning: true }))
    isExecutingRef.current = false
    setTimeout(() => executeLoop(), 100)
  }
}, [agentId, addAgentStep, updateAgentStep, executeToolInternal, updateAgentStatus, 
    setPendingTool, executeLoop, recordToolExecution])
```

### Step 4: Add Batch Tool Approval Support to Agent Context

**File:** `src/renderer/src/contexts/AgentContext.tsx`

Add batch pending tools support:

```typescript
// In Agent interface, add:
pendingToolBatch?: Array<{
  id: string
  tool: string
  args: Record<string, unknown>
  explanation?: string
}> | null

// Add action in reducer:
case 'SET_PENDING_TOOL_BATCH': {
  const agent = state.agents[action.agentId]
  if (!agent) return state
  return {
    ...state,
    agents: {
      ...state.agents,
      [action.agentId]: {
        ...agent,
        pendingToolBatch: action.batch
      }
    }
  }
}

// Add dispatch function:
const setPendingToolBatch = useCallback((
  agentId: string, 
  batch: Array<{ id: string; tool: string; args: Record<string, unknown>; explanation?: string }> | null
) => {
  dispatch({ type: 'SET_PENDING_TOOL_BATCH', agentId, batch })
}, [])
```

### Step 5: Create Batch Approval UI Component

**File:** `src/renderer/src/components/agent/BatchToolApproval.tsx`

```typescript
// src/renderer/src/components/agent/BatchToolApproval.tsx

import { useState } from 'react'
import { Check, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'

interface PendingTool {
  id: string
  tool: string
  args: Record<string, unknown>
  explanation?: string
}

interface BatchToolApprovalProps {
  tools: PendingTool[]
  onApproveAll: () => void
  onRejectAll: () => void
  onApproveSelected: (ids: string[]) => void
}

export function BatchToolApproval({
  tools,
  onApproveAll,
  onRejectAll,
  onApproveSelected
}: BatchToolApprovalProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set(tools.map(t => t.id)))

  const toggleExpanded = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setExpanded(next)
  }

  const toggleSelected = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelected(next)
  }

  const handleApproveSelected = () => {
    onApproveSelected(Array.from(selected))
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <span className="font-medium text-amber-500">
            {tools.length} tools require approval
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRejectAll}
            className="px-3 py-1.5 text-sm rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30"
          >
            Reject All
          </button>
          <button
            onClick={onApproveAll}
            className="px-3 py-1.5 text-sm rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30"
          >
            Approve All
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className={cn(
              'border rounded-md overflow-hidden',
              selected.has(tool.id) ? 'border-amber-500/50' : 'border-secondary'
            )}
          >
            <div
              className="flex items-center gap-2 p-2 bg-secondary/50 cursor-pointer"
              onClick={() => toggleExpanded(tool.id)}
            >
              <input
                type="checkbox"
                checked={selected.has(tool.id)}
                onChange={() => toggleSelected(tool.id)}
                onClick={(e) => e.stopPropagation()}
                className="rounded"
              />
              <code className="text-sm text-primary">{tool.tool}</code>
              {tool.explanation && (
                <span className="text-xs text-text-muted truncate flex-1">
                  — {tool.explanation}
                </span>
              )}
              {expanded.has(tool.id) ? (
                <ChevronUp className="w-4 h-4 text-text-muted" />
              ) : (
                <ChevronDown className="w-4 h-4 text-text-muted" />
              )}
            </div>
            
            {expanded.has(tool.id) && (
              <div className="p-2 bg-background">
                <pre className="text-xs overflow-auto max-h-32">
                  {JSON.stringify(tool.args, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {selected.size > 0 && selected.size < tools.length && (
        <button
          onClick={handleApproveSelected}
          className="w-full px-3 py-2 text-sm rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
        >
          Approve {selected.size} Selected
        </button>
      )}
    </div>
  )
}
```

---

## Verification Checklist

After implementing all steps, verify:

- [ ] Run `npm run typecheck` - No TypeScript errors
- [ ] Test Anthropic with a simple tool call
- [ ] Test OpenAI with a simple tool call  
- [ ] Verify native function calls work for all three providers
- [ ] Test parallel execution with multiple read_file calls
- [ ] Verify batch approval UI appears for multiple moderate/dangerous tools
- [ ] Test "Approve All" and "Reject All" functionality
- [ ] Test selective approval in batch UI

---

## Testing Commands

```bash
# Test each provider with an agent
# 1. Select Claude Sonnet 4.5 as model
# 2. Launch "Codebase Explorer" agent
# 3. Verify native tool_use blocks in logs

# Test parallel execution
# 1. Create agent with instruction: "Read all TypeScript files in src/main/providers"
# 2. Verify multiple read_file calls execute in parallel
# 3. Check execution time vs sequential
```

---

## Next Phase

After completing Phase 2, proceed to:
- **Phase 3:** Verification & Reliability (Git integration, TypeScript checks, ESLint)

Reference: `/docs/prompts/coding-improvement-phase-3.md`
