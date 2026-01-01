# ArborChat Coding Capability Improvement Design

**Author:** Alex Chen (Distinguished Software Architect)  
**Date:** December 29, 2025  
**Status:** Proposed  
**Priority:** High  

---

## Executive Summary

ArborChat has solid foundations—an Agent system with work journaling, multi-provider AI support, MCP integration, and risk-based approval workflows. However, several architectural patterns are limiting its effectiveness for coding tasks. The core issue: **ArborChat is using a text-based tool calling convention when native APIs exist and perform significantly better.**

This document captures the architectural analysis and provides a phased implementation roadmap to significantly improve ArborChat's coding capabilities.

---

## Current Architecture Analysis

### 1. Tool Calling Mechanism (Critical Issue)

**Current Implementation:**
```typescript
// prompts.ts - Text-based tool format
`\`\`\`tool_use
{
  "tool": "tool_name",
  "args": { "param1": "value1" },
  "explanation": "Why I'm using this tool"
}
\`\`\``
```

**Problems:**

1. **Parsing fragility** — Regex-based extraction (`/```tool_use\n([\s\S]*?)\n```/g`) breaks if:
   - AI uses different fence markers (` ``` ` vs `~~~`)
   - AI adds extra whitespace or formatting
   - AI partially streams an incomplete block
   - JSON is malformed (missing quotes, trailing commas)

2. **No provider optimization** — Gemini has `functionCalling`, Claude has native `tool_use` blocks, OpenAI has `functions`/`tools`. These native APIs:
   - Are more reliable (structured output guarantees)
   - Support parallel tool execution
   - Return structured responses that are easier to parse
   - Have built-in retry/validation mechanisms

3. **Single tool per response** — Current instructions say "One tool at a time," but modern models can execute multiple tools in parallel when using native APIs.

### 2. System Prompt Structure

**Current:**
```typescript
// prompts.ts
return `${basePrompt}

${systemPrompt}` // Tool instructions appended
```

**Problems:**
- Tool documentation bloats the system prompt (~117 lines of instructions)
- No separation between tool definitions and behavioral instructions
- Same prompt format used regardless of provider (Gemini, Claude, etc.)

### 3. Context Management

**Current agent loop:**
```typescript
// useAgentRunner.ts - buildContextMessages()
messages.push({ role: 'system', content: agent.systemPrompt })
for (const seedMsg of agent.config.context.seedMessages) { ... }
messages.push({ role: 'user', content: agent.config.instructions })
for (const msg of agent.messages) { ... }
```

**Issues:**
- No dynamic context window management (messages aren't truncated based on model limits)
- Tool results can be very large (file contents) but aren't summarized
- No token counting before submission

### 4. Completion Verification (Good Foundation)

```typescript
// useAgentRunner.ts
const isCompletionMessage = useCallback((content: string): boolean => {
  const hasExplicitCompletion = /TASK COMPLETED/i.test(content)
  const hasFileEvidence = /(?:\/[\w.-]+)+\.(ts|tsx|js|jsx|json|md|css|html)/i.test(content)
  const workVerification = verifyWorkCompleted()
  return hasExplicitCompletion && hasFileEvidence && workVerification.hasMeaningfulWork
}, [])
```

This is solid anti-hallucination logic. However, it could be enhanced with:
- Git diff verification for actual file changes
- AST parsing to verify syntactically valid code was written
- Compilation/lint check integration

---

## Detailed Recommendations

### Priority 1: Implement Native Tool Calling (High Impact)

Create provider-specific tool formatters:

```typescript
// src/main/providers/toolFormatter.ts

import type { ToolDefinition } from '../mcp/types'

export interface NativeToolSpec {
  provider: 'gemini' | 'anthropic' | 'openai'
  tools: unknown[] // Provider-specific format
}

/**
 * Convert MCP tools to Gemini function declarations
 */
export function toGeminiFunctions(tools: ToolDefinition[]): object[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema
  }))
}

/**
 * Convert MCP tools to Anthropic tool format
 */
export function toAnthropicTools(tools: ToolDefinition[]): object[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema
  }))
}

/**
 * Convert MCP tools to OpenAI functions
 */
export function toOpenAIFunctions(tools: ToolDefinition[]): object[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }))
}
```

Update the Gemini provider to use native function calling:

```typescript
// src/main/providers/gemini.ts (enhanced)

import { toGeminiFunctions } from './toolFormatter'
import { mcpManager } from '../mcp/manager'

async streamResponse(params: StreamParams, apiKey?: string): Promise<void> {
  const { window, messages, modelId } = params
  
  // Get available tools
  const mcpTools = mcpManager.getAvailableTools()
  const geminiFunctions = toGeminiFunctions(mcpTools)
  
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: systemMessage?.content,
    tools: geminiFunctions.length > 0 ? [{
      functionDeclarations: geminiFunctions
    }] : undefined
  }, { apiVersion: 'v1beta' })

  const result = await chat.sendMessageStream(lastMessage.parts[0].text)
  
  for await (const chunk of result.stream) {
    // Handle text content
    if (chunk.candidates?.[0]?.content?.parts) {
      for (const part of chunk.candidates[0].content.parts) {
        if (part.text) {
          window.webContents.send('ai:token', part.text)
        }
        // Handle function calls natively!
        if (part.functionCall) {
          window.webContents.send('ai:function_call', {
            name: part.functionCall.name,
            args: part.functionCall.args
          })
        }
      }
    }
  }
}
```

### Priority 2: Parallel Tool Execution

Allow agents to request multiple tools simultaneously:

```typescript
// src/renderer/src/hooks/useAgentRunner.ts (enhanced)

const handleToolCalls = useCallback(async (
  agent: Agent,
  toolCalls: Array<{ tool: string; args: Record<string, unknown>; explanation: string }>,
  originalContent: string
) => {
  // Group by auto-approvable vs needs-approval
  const autoApprovable = toolCalls.filter(tc => 
    shouldAutoApprove(tc.tool, agent.config.toolPermission, alwaysApproveTools)
  )
  const needsApproval = toolCalls.filter(tc =>
    !shouldAutoApprove(tc.tool, agent.config.toolPermission, alwaysApproveTools)
  )
  
  // Execute auto-approved in parallel
  const parallelResults = await Promise.allSettled(
    autoApprovable.map(tc => executeToolInternal(tc.tool, tc.args, tc.explanation))
  )
  
  // Queue approval-needed tools (could batch into single approval card)
  if (needsApproval.length > 0) {
    setPendingToolBatch(agentId, needsApproval) // New: batch approvals
  }
  
  // Format all results for context
  const resultsContext = parallelResults
    .map((r, i) => formatToolResult(
      autoApprovable[i].tool,
      r.status === 'fulfilled' ? r.value.result : null,
      r.status === 'rejected' ? String(r.reason) : undefined
    ))
    .join('\n\n')
  
  pendingToolResultRef.current = resultsContext
}, [])
```

### Priority 3: Smart Context Management

Implement token-aware context truncation:

```typescript
// src/renderer/src/lib/contextManager.ts (new file)

import { encode } from 'gpt-tokenizer' // Or use tiktoken

interface ContextBudget {
  maxTokens: number
  reservedForOutput: number
  reservedForTools: number
}

const MODEL_LIMITS: Record<string, ContextBudget> = {
  'gemini-2.5-flash': { maxTokens: 1000000, reservedForOutput: 8192, reservedForTools: 50000 },
  'gemini-2.5-pro': { maxTokens: 2000000, reservedForOutput: 8192, reservedForTools: 100000 },
  'claude-sonnet-4-5-20250929': { maxTokens: 200000, reservedForOutput: 8192, reservedForTools: 50000 },
}

export function buildOptimizedContext(
  messages: Array<{ role: string; content: string }>,
  toolResults: string[],
  modelId: string
): Array<{ role: string; content: string }> {
  const budget = MODEL_LIMITS[modelId] || MODEL_LIMITS['gemini-2.5-flash']
  const availableTokens = budget.maxTokens - budget.reservedForOutput - budget.reservedForTools
  
  // Strategy: Keep system prompt, recent messages, truncate tool results
  const systemPrompt = messages.find(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role !== 'system')
  
  let currentTokens = encode(systemPrompt?.content || '').length
  const result: typeof messages = systemPrompt ? [systemPrompt] : []
  
  // Add messages from newest to oldest, stopping when budget exceeded
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i]
    const msgTokens = encode(msg.content).length
    
    if (currentTokens + msgTokens < availableTokens) {
      result.push(msg)
      currentTokens += msgTokens
    } else {
      // Truncate this message if it's a tool result
      if (msg.content.includes('<tool_result')) {
        const truncated = truncateToolResult(msg.content, availableTokens - currentTokens)
        result.push({ ...msg, content: truncated })
      }
      break
    }
  }
  
  return result.reverse()
}

function truncateToolResult(content: string, maxTokens: number): string {
  const lines = content.split('\n')
  let truncated = ''
  let tokens = 0
  
  for (const line of lines) {
    const lineTokens = encode(line).length
    if (tokens + lineTokens > maxTokens) {
      truncated += '\n[... truncated for context limit ...]'
      break
    }
    truncated += line + '\n'
    tokens += lineTokens
  }
  
  return truncated
}
```

### Priority 4: Enhanced Error Recovery

Add intelligent retry with context correction:

```typescript
// src/renderer/src/hooks/useAgentRunner.ts (enhanced error handling)

const handleToolError = useCallback(async (
  toolName: string,
  args: Record<string, unknown>,
  error: string
): Promise<string> => {
  // Analyze error type
  const errorAnalysis = analyzeToolError(error)
  
  // Generate corrective guidance
  const guidance = generateErrorGuidance(toolName, args, errorAnalysis)
  
  return `<tool_result name="${toolName}" status="error">
${error}
</tool_result>

<error_guidance>
${guidance}
</error_guidance>`
}, [])

function analyzeToolError(error: string): 'not_found' | 'permission' | 'parse' | 'timeout' | 'unknown' {
  if (error.includes('ENOENT') || error.includes('not found')) return 'not_found'
  if (error.includes('EACCES') || error.includes('permission')) return 'permission'
  if (error.includes('JSON') || error.includes('parse')) return 'parse'
  if (error.includes('timeout') || error.includes('ETIMEDOUT')) return 'timeout'
  return 'unknown'
}

function generateErrorGuidance(
  toolName: string, 
  args: Record<string, unknown>,
  errorType: string
): string {
  switch (errorType) {
    case 'not_found':
      return `The path "${args.path}" does not exist. Try:
1. Use list_directory to verify the correct path
2. Check for typos in the file name
3. Verify the working directory is correct`
    case 'permission':
      return `Permission denied for "${args.path}". This file may be:
1. Read-only or owned by another user
2. In a protected system directory
3. Currently locked by another process`
    case 'parse':
      return `JSON parsing failed. Ensure:
1. The content is valid JSON
2. Quotes are properly escaped
3. No trailing commas in arrays/objects`
    default:
      return `An error occurred. Consider retrying or trying an alternative approach.`
  }
}
```

### Priority 5: Git Integration for Verification

Add git diff verification to completion checks:

```typescript
// src/main/services/GitService.ts (enhanced)

export class GitService {
  // ... existing methods ...
  
  /**
   * Verify actual file changes were made by the agent
   */
  async verifyChanges(
    workingDir: string, 
    expectedFiles: string[]
  ): Promise<{
    verified: boolean
    changedFiles: string[]
    missingChanges: string[]
    unexpectedChanges: string[]
  }> {
    const status = await this.getStatus(workingDir)
    const changedFiles = [
      ...status.staged,
      ...status.modified,
      ...status.untracked
    ]
    
    const missingChanges = expectedFiles.filter(f => !changedFiles.includes(f))
    const unexpectedChanges = changedFiles.filter(f => !expectedFiles.includes(f))
    
    return {
      verified: missingChanges.length === 0,
      changedFiles,
      missingChanges,
      unexpectedChanges
    }
  }
  
  /**
   * Get diff summary for changed files
   */
  async getDiffSummary(workingDir: string): Promise<string> {
    const result = await this.runGit(workingDir, ['diff', '--stat'])
    return result.stdout
  }
}
```

---

## Quick Wins (Can implement immediately)

### 1. Better Tool Parsing

Add fallback parsing for common AI variations:

```typescript
// Enhanced parseToolCalls in toolParser.ts
export function parseToolCalls(content: string): ToolCall[] {
  // Try standard format first
  const standardRegex = /```tool_use\n([\s\S]*?)\n```/g
  // Fallback: Try without newline requirements
  const fallbackRegex = /```tool_use\s*([\s\S]*?)\s*```/g
  // Fallback: Try with json language tag
  const jsonRegex = /```(?:tool_use|json)\n\{\s*"tool":\s*"([^"]+)"[\s\S]*?\n```/g
  
  // ... implementation
}
```

### 2. Tool Result Truncation

Prevent context overflow:

```typescript
// In formatToolResult
export function formatToolResult(toolName: string, result: unknown, error?: string): string {
  const MAX_RESULT_LENGTH = 10000 // ~2500 tokens
  
  let resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  
  if (resultStr.length > MAX_RESULT_LENGTH) {
    const truncated = resultStr.substring(0, MAX_RESULT_LENGTH)
    resultStr = truncated + '\n\n[... truncated, showing first 10000 characters ...]'
  }
  
  return `<tool_result name="${toolName}" status="success">
${resultStr}
</tool_result>`
}
```

### 3. Compile Check After Writes

Add TypeScript validation:

```typescript
// After successful write_file or edit_block in agent loop
if (['write_file', 'edit_block'].includes(toolName) && args.path?.toString().match(/\.(ts|tsx)$/)) {
  // Queue a typecheck
  const typecheckResult = await executeToolInternal('start_process', {
    command: 'npm run typecheck',
    timeout_ms: 30000
  })
  
  if (!typecheckResult.success || typecheckResult.result?.includes('error')) {
    pendingToolResultRef.current += '\n\n⚠️ TypeScript compilation check failed. Please review the error above and fix.'
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (1-2 weeks)
1. **Native Tool Calling for Gemini** - Highest impact, most used provider
2. **Token-Aware Context Management** - Prevents context overflow failures
3. **Enhanced Error Recovery Messages** - Immediate improvement to agent resilience

### Phase 2: Multi-Provider Excellence (2-3 weeks)
1. **Native Tool Calling for Anthropic** - Claude's tool_use format
2. **Native Tool Calling for OpenAI** - Function calling API
3. **Parallel Tool Execution** - Speed up complex operations

### Phase 3: Verification & Reliability (1-2 weeks)
1. **Git Integration for Verification** - Prove changes actually happened
2. **TypeScript Compilation Checks** - Automatic `tsc --noEmit` validation
3. **ESLint Integration** - Code quality gates

### Phase 4: Advanced Capabilities (2-3 weeks)
1. **Multi-File Orchestration** - Handle complex refactoring
2. **Project Context Seeding** - `tsconfig.json`, `package.json` auto-detection
3. **Checkpoint Restoration** - Resume from work journal checkpoints with full context

---

## Files to Create/Modify

### New Files
- `src/main/providers/toolFormatter.ts` - Provider-specific tool conversion
- `src/renderer/src/lib/contextManager.ts` - Token-aware context management
- `src/renderer/src/lib/errorAnalyzer.ts` - Tool error analysis and guidance

### Modified Files
- `src/main/providers/gemini.ts` - Native function calling
- `src/main/providers/anthropic.ts` - Native tool_use format
- `src/main/providers/openai.ts` - Native functions API
- `src/main/ai.ts` - Pass tools to providers
- `src/main/mcp/ipc.ts` - New IPC for tool definitions
- `src/renderer/src/hooks/useAgentRunner.ts` - Parallel execution, enhanced verification
- `src/renderer/src/lib/toolParser.ts` - Improved parsing, truncation
- `src/main/services/GitService.ts` - Change verification
- `src/preload/index.ts` - New IPC channels

---

## Success Metrics

1. **Tool Call Success Rate** - Target: >95% (currently estimated ~70-80%)
2. **Context Overflow Errors** - Target: 0 (currently occasional)
3. **Hallucinated Completions** - Target: 0 (currently occasional)
4. **Average Task Completion Time** - Target: 30% reduction via parallel execution
5. **Agent Retry Rate** - Target: <10% (fewer failures requiring retry)

---

## References

- [Gemini Function Calling Documentation](https://ai.google.dev/gemini-api/docs/function-calling)
- [Anthropic Tool Use Documentation](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [OpenAI Function Calling Documentation](https://platform.openai.com/docs/guides/function-calling)
- ArborChat Architect Persona: `/Users/cory.naegle/ArborChat/ARCHITECT_PERSONA.md`
