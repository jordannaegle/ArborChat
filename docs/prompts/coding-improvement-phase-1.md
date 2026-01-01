# Coding Capability Improvement - Phase 1: Foundation

**Reference Design:** `/docs/designs/CODING_CAPABILITY_IMPROVEMENT_DESIGN.md`  
**Estimated Effort:** 1-2 weeks  
**Priority:** Critical  

---

## Objective

Implement the foundational improvements to ArborChat's coding capabilities:
1. Native Tool Calling for Gemini (highest impact)
2. Token-Aware Context Management
3. Enhanced Error Recovery Messages
4. Quick Wins (improved parsing, truncation)

---

## Prerequisites

- Read the full design document at `/docs/designs/CODING_CAPABILITY_IMPROVEMENT_DESIGN.md`
- Understand the current tool calling flow in:
  - `/src/main/providers/gemini.ts`
  - `/src/main/mcp/prompts.ts`
  - `/src/renderer/src/lib/toolParser.ts`
  - `/src/renderer/src/hooks/useAgentRunner.ts`

---

## Implementation Steps

### Step 1: Create Tool Formatter Utility

Create a new file to convert MCP tools to provider-specific formats.

**File:** `src/main/providers/toolFormatter.ts`

```typescript
// src/main/providers/toolFormatter.ts
// Converts MCP tool definitions to provider-specific formats

import type { ToolDefinition } from '../mcp/types'

/**
 * Convert MCP tools to Gemini function declarations
 * @see https://ai.google.dev/gemini-api/docs/function-calling
 */
export function toGeminiFunctions(tools: ToolDefinition[]): object[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description || `Execute the ${tool.name} tool`,
    parameters: sanitizeSchema(tool.inputSchema)
  }))
}

/**
 * Convert MCP tools to Anthropic tool format
 * @see https://docs.anthropic.com/en/docs/build-with-claude/tool-use
 */
export function toAnthropicTools(tools: ToolDefinition[]): object[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description || `Execute the ${tool.name} tool`,
    input_schema: sanitizeSchema(tool.inputSchema)
  }))
}

/**
 * Convert MCP tools to OpenAI functions format
 * @see https://platform.openai.com/docs/guides/function-calling
 */
export function toOpenAIFunctions(tools: ToolDefinition[]): object[] {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description || `Execute the ${tool.name} tool`,
      parameters: sanitizeSchema(tool.inputSchema)
    }
  }))
}

/**
 * Sanitize JSON schema for provider compatibility
 * Some providers are strict about schema format
 */
function sanitizeSchema(schema: ToolDefinition['inputSchema']): object {
  if (!schema) {
    return {
      type: 'object',
      properties: {},
      required: []
    }
  }

  // Ensure we have a valid object schema
  const result: Record<string, unknown> = {
    type: schema.type || 'object',
    properties: schema.properties || {},
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
 * Filter tools to a specific subset (e.g., safe tools only)
 */
export function filterToolsByRisk(
  tools: ToolDefinition[],
  allowedRiskLevels: Array<'safe' | 'moderate' | 'dangerous'>
): ToolDefinition[] {
  const TOOL_RISK: Record<string, 'safe' | 'moderate' | 'dangerous'> = {
    read_file: 'safe',
    read_multiple_files: 'safe',
    list_directory: 'safe',
    get_file_info: 'safe',
    write_file: 'moderate',
    edit_block: 'moderate',
    create_directory: 'moderate',
    move_file: 'dangerous',
    force_terminate: 'dangerous',
    kill_process: 'dangerous',
  }

  return tools.filter(tool => {
    const risk = TOOL_RISK[tool.name] || 'moderate'
    return allowedRiskLevels.includes(risk)
  })
}
```

### Step 2: Update Gemini Provider for Native Function Calling

Modify the Gemini provider to use native function calling instead of text-based tool_use blocks.

**File:** `src/main/providers/gemini.ts`

Key changes:
1. Import `toGeminiFunctions` from toolFormatter
2. Import `mcpManager` to get available tools
3. Add tools to model configuration
4. Handle `functionCall` parts in stream response
5. Add new IPC event for function calls

```typescript
// Add to imports
import { toGeminiFunctions } from './toolFormatter'
import { mcpManager } from '../mcp/manager'

// In streamResponse method, modify model creation:
async streamResponse(params: StreamParams, apiKey?: string): Promise<void> {
  // ... existing validation code ...

  const { window, messages, modelId, enableTools = true } = params

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const systemMessage = messages.find((m) => m.role === 'system')

    // Get available tools if enabled
    let toolConfig: object | undefined
    if (enableTools) {
      const mcpTools = mcpManager.getAvailableTools()
      if (mcpTools.length > 0) {
        const geminiFunctions = toGeminiFunctions(mcpTools)
        toolConfig = {
          functionDeclarations: geminiFunctions
        }
        console.log(`[Gemini] Configured ${geminiFunctions.length} native functions`)
      }
    }

    // Create model with system instruction AND tools
    const model = genAI.getGenerativeModel(
      {
        model: modelId,
        systemInstruction: systemMessage?.content,
        tools: toolConfig ? [toolConfig] : undefined
      },
      { apiVersion: 'v1beta' }
    )

    // ... existing history building code ...

    const chat = model.startChat({ history })
    const result = await retryWithBackoff(async () => {
      return await chat.sendMessageStream(lastMessage.parts[0].text)
    })

    console.log('[Gemini] Stream started, awaiting chunks...')
    let chunkCount = 0
    let fullResponse = ''

    for await (const chunk of result.stream) {
      const candidate = chunk.candidates?.[0]
      if (!candidate?.content?.parts) continue

      for (const part of candidate.content.parts) {
        // Handle text content
        if ('text' in part && part.text) {
          chunkCount++
          fullResponse += part.text
          window.webContents.send('ai:token', part.text)
        }
        
        // Handle native function calls
        if ('functionCall' in part && part.functionCall) {
          console.log('[Gemini] ✅ Native function call detected:', part.functionCall.name)
          window.webContents.send('ai:function_call', {
            name: part.functionCall.name,
            args: part.functionCall.args || {}
          })
        }
      }
    }

    console.log('[Gemini] Stream complete. Total chunks:', chunkCount)
    window.webContents.send('ai:done')
  } catch (e: unknown) {
    console.error('[Gemini] streamResponse ERROR:', e)
    window.webContents.send('ai:error', e instanceof Error ? e.message : 'Unknown error')
    throw e
  }
}
```

### Step 3: Update StreamParams Type

Add optional `enableTools` parameter.

**File:** `src/main/providers/types.ts`

```typescript
export interface StreamParams {
  window: BrowserWindow
  messages: ChatMessage[]
  modelId: string
  enableTools?: boolean  // NEW: Enable native tool calling
}
```

### Step 4: Add Function Call IPC Handler

Update the preload and renderer to handle native function calls.

**File:** `src/preload/index.ts`

Add new event listener:

```typescript
// In the api object, add:
onFunctionCall: (callback: (data: { name: string; args: Record<string, unknown> }) => void) => {
  const listener = (_event: IpcRendererEvent, data: { name: string; args: Record<string, unknown> }) => {
    callback(data)
  }
  ipcRenderer.on('ai:function_call', listener)
  return () => ipcRenderer.removeListener('ai:function_call', listener)
}
```

**File:** `src/preload/index.d.ts`

Add type declaration:

```typescript
onFunctionCall: (callback: (data: { name: string; args: Record<string, unknown> }) => void) => () => void
```

### Step 5: Handle Function Calls in Agent Runner

Update `useAgentRunner.ts` to handle both legacy text-based and native function calls.

**File:** `src/renderer/src/hooks/useAgentRunner.ts`

Add function call handler in the `executeLoop` callback:

```typescript
// After setting up token handler, add function call handler:

// Native function call handler (from providers that support it)
const cleanupFunctionCall = window.api.onFunctionCall?.((data) => {
  console.log('[AgentRunner] Native function call received:', data.name)
  
  // Convert to our tool call format and process
  const toolCall = {
    tool: data.name,
    args: data.args,
    explanation: 'Native function call'
  }
  
  // Store for processing after stream completes
  pendingNativeFunctionCallRef.current = toolCall
})

// In the onDone handler, check for native function calls first:
window.api.onDone(async () => {
  cleanup()
  
  // Check for native function call first
  if (pendingNativeFunctionCallRef.current) {
    const toolCall = pendingNativeFunctionCallRef.current
    pendingNativeFunctionCallRef.current = null
    
    const cleanContent = streamBufferRef.current
    if (currentMessageIdRef.current) {
      updateAgentMessage(agentId, currentMessageIdRef.current, cleanContent)
    }
    
    await handleToolCall(agent, toolCall, cleanContent, cleanContent)
    return
  }
  
  // Fall back to text-based parsing for legacy support
  const toolCalls = parseToolCalls(finalContent)
  // ... rest of existing logic
})

// Add ref at the top of the hook:
const pendingNativeFunctionCallRef = useRef<{
  tool: string
  args: Record<string, unknown>
  explanation: string
} | null>(null)

// Update cleanup to remove the function call listener:
const cleanup = () => {
  window.api.offAI()
  cleanupFunctionCall?.()
}
```

### Step 6: Implement Context Manager

Create the token-aware context management utility.

**File:** `src/renderer/src/lib/contextManager.ts`

```typescript
// src/renderer/src/lib/contextManager.ts
// Token-aware context management for AI conversations

/**
 * Simple token estimation (roughly 4 chars per token)
 * For production, consider using tiktoken or gpt-tokenizer
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

interface ContextBudget {
  maxTokens: number
  reservedForOutput: number
  reservedForTools: number
}

const MODEL_LIMITS: Record<string, ContextBudget> = {
  // Gemini models
  'gemini-2.0-flash': { maxTokens: 1000000, reservedForOutput: 8192, reservedForTools: 50000 },
  'gemini-2.5-flash': { maxTokens: 1000000, reservedForOutput: 8192, reservedForTools: 50000 },
  'gemini-2.5-flash-lite': { maxTokens: 1000000, reservedForOutput: 8192, reservedForTools: 50000 },
  'gemini-2.5-pro': { maxTokens: 2000000, reservedForOutput: 8192, reservedForTools: 100000 },
  // Anthropic models
  'claude-opus-4-5-20251101': { maxTokens: 200000, reservedForOutput: 8192, reservedForTools: 50000 },
  'claude-sonnet-4-5-20250929': { maxTokens: 200000, reservedForOutput: 8192, reservedForTools: 50000 },
  // Default fallback
  'default': { maxTokens: 100000, reservedForOutput: 4096, reservedForTools: 20000 },
}

export interface Message {
  role: string
  content: string
}

/**
 * Build an optimized context that fits within the model's token limits
 */
export function buildOptimizedContext(
  messages: Message[],
  modelId: string
): Message[] {
  const budget = MODEL_LIMITS[modelId] || MODEL_LIMITS['default']
  const availableTokens = budget.maxTokens - budget.reservedForOutput - budget.reservedForTools

  // Always keep the system prompt
  const systemPrompt = messages.find(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role !== 'system')

  let currentTokens = systemPrompt ? estimateTokens(systemPrompt.content) : 0
  const result: Message[] = systemPrompt ? [systemPrompt] : []

  // Add messages from newest to oldest until we hit the budget
  const messagesToAdd: Message[] = []
  
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i]
    const msgTokens = estimateTokens(msg.content)

    if (currentTokens + msgTokens < availableTokens) {
      messagesToAdd.unshift(msg)
      currentTokens += msgTokens
    } else {
      // Try to truncate if it's a tool result
      if (msg.content.includes('<tool_result') || msg.content.includes('Tool execution result')) {
        const truncated = truncateToolResult(msg.content, availableTokens - currentTokens)
        if (truncated) {
          messagesToAdd.unshift({ ...msg, content: truncated })
        }
      }
      // Stop adding more messages
      console.log(`[ContextManager] Truncating context at message ${i}, used ${currentTokens} tokens`)
      break
    }
  }

  result.push(...messagesToAdd)
  
  console.log(`[ContextManager] Built context with ${result.length} messages, ~${currentTokens} tokens`)
  return result
}

/**
 * Truncate a tool result to fit within a token budget
 */
function truncateToolResult(content: string, maxTokens: number): string | null {
  const maxChars = maxTokens * 4 // Rough estimate
  
  if (content.length <= maxChars) {
    return content
  }

  // Keep the first part and add truncation notice
  const truncated = content.substring(0, maxChars - 100)
  return `${truncated}\n\n[... content truncated to fit context window ...]`
}

/**
 * Get the context budget for a specific model
 */
export function getContextBudget(modelId: string): ContextBudget {
  return MODEL_LIMITS[modelId] || MODEL_LIMITS['default']
}

/**
 * Check if context is approaching the limit
 */
export function isContextNearLimit(
  messages: Message[],
  modelId: string,
  threshold: number = 0.9
): boolean {
  const budget = MODEL_LIMITS[modelId] || MODEL_LIMITS['default']
  const availableTokens = budget.maxTokens - budget.reservedForOutput - budget.reservedForTools
  
  const currentTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  )
  
  return currentTokens > availableTokens * threshold
}
```

### Step 7: Improve Tool Parser with Fallbacks

Enhance the tool parser to handle more variations.

**File:** `src/renderer/src/lib/toolParser.ts`

```typescript
// src/renderer/src/lib/toolParser.ts
// Enhanced tool call parsing with fallbacks

export interface ToolCall {
  tool: string
  args: Record<string, unknown>
  explanation: string
}

const MAX_RESULT_LENGTH = 10000 // ~2500 tokens

/**
 * Parse tool calls from AI response content
 * Handles multiple format variations for robustness
 */
export function parseToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = []

  // Try multiple regex patterns in order of preference
  const patterns = [
    // Standard format with newlines
    /```tool_use\n([\s\S]*?)\n```/g,
    // Relaxed format (flexible whitespace)
    /```tool_use\s*([\s\S]*?)\s*```/g,
    // Alternative with json tag
    /```(?:tool_use|json)\s*\n?\s*(\{[\s\S]*?"tool"[\s\S]*?\})\s*\n?```/g,
  ]

  for (const regex of patterns) {
    let match
    while ((match = regex.exec(content)) !== null) {
      try {
        const jsonStr = match[1].trim()
        // Try to fix common JSON issues
        const fixedJson = fixCommonJsonIssues(jsonStr)
        const parsed = JSON.parse(fixedJson)
        
        if (parsed.tool) {
          calls.push({
            tool: parsed.tool,
            args: parsed.args || {},
            explanation: parsed.explanation || ''
          })
        }
      } catch (e) {
        console.warn('[ToolParser] Failed to parse tool call:', e, match[1])
      }
    }
    
    // If we found calls with this pattern, don't try others
    if (calls.length > 0) break
  }

  return calls
}

/**
 * Attempt to fix common JSON formatting issues
 */
function fixCommonJsonIssues(json: string): string {
  let fixed = json
  
  // Remove trailing commas before closing braces/brackets
  fixed = fixed.replace(/,\s*([}\]])/g, '$1')
  
  // Fix unquoted property names (simple cases)
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')
  
  return fixed
}

/**
 * Strip tool call blocks from content for display
 */
export function stripToolCalls(content: string): string {
  return content
    .replace(/```tool_use\s*[\s\S]*?\s*```/g, '')
    .replace(/```json\s*\{[\s\S]*?"tool"[\s\S]*?\}\s*```/g, '')
    .trim()
}

/**
 * Check if content contains tool calls
 */
export function hasToolCalls(content: string): boolean {
  return /```(?:tool_use|json)\s*[\s\S]*?"tool"/.test(content)
}

/**
 * Extract the first tool call from content
 */
export function extractFirstToolCall(content: string): ToolCall | null {
  const calls = parseToolCalls(content)
  return calls[0] || null
}

/**
 * Format tool result for AI context
 * Includes truncation to prevent context overflow
 */
export function formatToolResult(
  toolName: string,
  result: unknown,
  error?: string
): string {
  if (error) {
    return `<tool_result name="${toolName}" status="error">
${error}
</tool_result>`
  }

  let resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2)

  // Truncate if too long
  if (resultStr.length > MAX_RESULT_LENGTH) {
    const truncated = resultStr.substring(0, MAX_RESULT_LENGTH)
    const lastNewline = truncated.lastIndexOf('\n')
    resultStr = truncated.substring(0, lastNewline > MAX_RESULT_LENGTH - 500 ? lastNewline : MAX_RESULT_LENGTH)
    resultStr += '\n\n[... output truncated, showing first ~10000 characters ...]'
  }

  return `<tool_result name="${toolName}" status="success">
${resultStr}
</tool_result>`
}

/**
 * Format multiple tool results
 */
export function formatToolResults(
  results: Array<{ toolName: string; result?: unknown; error?: string }>
): string {
  return results
    .map(r => formatToolResult(r.toolName, r.result, r.error))
    .join('\n\n')
}
```

### Step 8: Create Error Analyzer Utility

**File:** `src/renderer/src/lib/errorAnalyzer.ts`

```typescript
// src/renderer/src/lib/errorAnalyzer.ts
// Intelligent error analysis and recovery guidance

export type ErrorType = 
  | 'not_found' 
  | 'permission' 
  | 'parse' 
  | 'timeout' 
  | 'network'
  | 'rate_limit'
  | 'validation'
  | 'unknown'

/**
 * Analyze an error message to determine its type
 */
export function analyzeError(error: string): ErrorType {
  const errorLower = error.toLowerCase()
  
  if (errorLower.includes('enoent') || errorLower.includes('not found') || errorLower.includes('no such file')) {
    return 'not_found'
  }
  if (errorLower.includes('eacces') || errorLower.includes('permission denied') || errorLower.includes('access denied')) {
    return 'permission'
  }
  if (errorLower.includes('json') || errorLower.includes('parse') || errorLower.includes('syntax error')) {
    return 'parse'
  }
  if (errorLower.includes('timeout') || errorLower.includes('etimedout') || errorLower.includes('timed out')) {
    return 'timeout'
  }
  if (errorLower.includes('network') || errorLower.includes('econnrefused') || errorLower.includes('enotfound')) {
    return 'network'
  }
  if (errorLower.includes('rate limit') || errorLower.includes('429') || errorLower.includes('too many requests')) {
    return 'rate_limit'
  }
  if (errorLower.includes('invalid') || errorLower.includes('required') || errorLower.includes('must be')) {
    return 'validation'
  }
  
  return 'unknown'
}

/**
 * Generate recovery guidance based on error type and context
 */
export function generateErrorGuidance(
  toolName: string,
  args: Record<string, unknown>,
  errorType: ErrorType
): string {
  const path = args.path || args.file_path || args.source
  
  switch (errorType) {
    case 'not_found':
      return `The path "${path}" does not exist. Recovery steps:
1. Use \`list_directory\` to verify the correct path exists
2. Check for typos in the file or directory name
3. Verify you're using the correct working directory
4. The file may have been moved or deleted`

    case 'permission':
      return `Permission denied for "${path}". This may be because:
1. The file is read-only or owned by another user
2. It's in a protected system directory
3. Another process has the file locked
4. Try a different location or check file permissions`

    case 'parse':
      return `Content parsing failed. Common fixes:
1. Ensure JSON content is properly formatted
2. Check that quotes are properly escaped (use \\" for quotes inside strings)
3. Remove trailing commas from arrays and objects
4. Verify the content encoding is UTF-8`

    case 'timeout':
      return `The operation timed out. Try:
1. Breaking the operation into smaller steps
2. Running the command with a longer timeout
3. Checking if the target system is responsive
4. The process may still be running - use \`list_sessions\` to check`

    case 'network':
      return `Network error occurred. Check:
1. Internet connectivity is available
2. The target host/service is accessible
3. Firewall settings allow the connection
4. DNS resolution is working properly`

    case 'rate_limit':
      return `Rate limit exceeded. Wait a moment and:
1. Reduce the frequency of API calls
2. Batch multiple small operations together
3. Wait 30-60 seconds before retrying
4. Consider caching results to reduce API calls`

    case 'validation':
      return `Validation error for ${toolName}. Check:
1. All required parameters are provided
2. Parameter values match the expected types
3. File paths are absolute, not relative
4. String values don't contain invalid characters`

    default:
      return `An error occurred with ${toolName}. General recovery:
1. Review the error message for specific details
2. Verify all input parameters are correct
3. Try the operation again - it may be transient
4. Consider an alternative approach if this continues`
  }
}

/**
 * Format an error with guidance for the AI
 */
export function formatErrorWithGuidance(
  toolName: string,
  args: Record<string, unknown>,
  error: string
): string {
  const errorType = analyzeError(error)
  const guidance = generateErrorGuidance(toolName, args, errorType)
  
  return `<tool_result name="${toolName}" status="error">
${error}
</tool_result>

<error_analysis type="${errorType}">
${guidance}
</error_analysis>`
}
```

---

## Verification Checklist

After implementing all steps, verify:

- [ ] Run `npm run typecheck` - No TypeScript errors
- [ ] Test Gemini with a simple tool call (e.g., "List the files in /Users/cory.naegle/ArborChat/src")
- [ ] Verify native function calls appear in logs: `[Gemini] ✅ Native function call detected`
- [ ] Test error recovery with an invalid path
- [ ] Verify context truncation works (create a very long conversation)
- [ ] Test fallback parsing with malformed tool_use blocks
- [ ] Agent can complete a simple coding task end-to-end

---

## Testing Commands

```bash
# Run TypeScript check
npm run typecheck

# Start development server
npm run dev

# Test with a simple agent task
# 1. Open ArborChat
# 2. Launch an agent with "Codebase Explorer" template
# 3. Set working directory to /Users/cory.naegle/ArborChat
# 4. Verify it uses native function calls (check console logs)
```

---

## Rollback Plan

If issues occur:

1. Revert `gemini.ts` to not pass tools to model
2. Keep the `toolFormatter.ts` and `contextManager.ts` for future use
3. The system will fall back to text-based tool_use parsing

---

## Next Phase

After completing Phase 1, proceed to:
- **Phase 2:** Multi-Provider Excellence (Anthropic & OpenAI native tool calling)

Reference: `/docs/prompts/coding-improvement-phase-2.md`
