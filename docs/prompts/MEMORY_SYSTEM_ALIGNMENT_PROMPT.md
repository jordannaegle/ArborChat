# ArborChat Memory System Alignment Implementation Prompt

**Author:** Implementation Guide based on Alex Chen's Design  
**Date:** December 30, 2025  
**Reference:** `/docs/designs/ARBOR_MEMORY_SERVICE_DESIGN.md`  
**Status:** Ready for Implementation

---

## Executive Summary

The ArborMemoryService was designed by Alex Chen as the **primary** memory system for ArborChat, with automatic injection into AI conversations. However, the current implementation incorrectly uses the MCP Memory Server as the primary system, leaving ArborMemoryService unused.

This prompt guides implementation of fixes to align with the original design.

---

## Current State (Problems)

1. **`useToolChat.ts`** calls MCP Memory Server's `open_nodes` tool instead of ArborMemoryService
2. **`buildSystemPrompt()`** only injects MCP tool instructions, NOT memory context
3. **No `arbor_store_memory` tool** exists for AI to explicitly store memories
4. **No MemoryScheduler** for automatic decay of unused memories
5. **MemoryConfigModal** now correctly shows ArborMemoryService stats, but the service has 0 data
6. **MCP Memory Server** should be fallback/deprecated, not primary

---

## Phase 1: Connect Memory Injection to ArborMemoryService

### Task 1.1: Update `useToolChat.ts`

**File:** `/src/renderer/src/hooks/useToolChat.ts`

Replace the `fetchMemoryContext` function to use ArborMemoryService instead of MCP tools:

```typescript
// REPLACE the existing fetchMemoryContext implementation

// Fetch memory context at session start using ArborMemoryService
const fetchMemoryContext = useCallback(async (
  conversationId?: string,
  projectPath?: string
): Promise<MemoryFetchResult> => {
  // Check if auto-load is enabled
  const autoLoadEnabled = await isMemoryAutoLoadEnabled()
  if (!autoLoadEnabled) {
    console.log('[useToolChat] Memory auto-load disabled in settings')
    return { context: null, itemCount: 0, status: 'idle' }
  }

  setMemoryStatus('loading')

  try {
    console.log('[useToolChat] Fetching memory context from ArborMemoryService...')
    
    // Use ArborMemoryService instead of MCP Memory Server
    const memoryContext = await window.api.arborMemory.getContext({
      conversationId,
      projectPath,
      maxTokens: 2000
    })

    if (memoryContext.status === 'error') {
      console.warn('[useToolChat] Memory context error:', memoryContext.error)
      setMemoryStatus('error')
      setMemoryItemCount(0)
      return { context: null, itemCount: 0, status: 'error' }
    }

    if (memoryContext.status === 'empty' || !memoryContext.formattedPrompt) {
      console.log('[useToolChat] No memory content found')
      setMemoryStatus('empty')
      setMemoryItemCount(0)
      return { context: null, itemCount: 0, status: 'empty' }
    }

    console.log(`[useToolChat] Memory context loaded: ${memoryContext.stats.totalLoaded} items`)
    setMemoryStatus('loaded')
    setMemoryItemCount(memoryContext.stats.totalLoaded)
    
    return {
      context: memoryContext.formattedPrompt,
      itemCount: memoryContext.stats.totalLoaded,
      status: 'loaded'
    }
  } catch (error) {
    console.warn('[useToolChat] Failed to fetch memory context:', error)
    setMemoryStatus('error')
    setMemoryItemCount(0)
    return { context: null, itemCount: 0, status: 'error' }
  }
}, [isMemoryAutoLoadEnabled])
```

**Update the function signature in UseToolChatResult interface:**

```typescript
fetchMemoryContext: (conversationId?: string, projectPath?: string) => Promise<MemoryFetchResult>
```

### Task 1.2: Update `buildSystemPrompt` to Include Memory

**File:** `/src/renderer/src/hooks/useToolChat.ts`

Modify `buildSystemPrompt` to accept and inject memory context:

```typescript
// Update buildSystemPrompt to accept memory context
const buildSystemPrompt = useCallback(
  (basePrompt: string, memoryContext?: string): string => {
    let prompt = basePrompt

    // Inject memory context first (if available)
    if (memoryContext) {
      prompt = `${prompt}

${memoryContext}`
    }

    // Then add MCP tool instructions
    if (connected && systemPrompt) {
      prompt = `${prompt}

${systemPrompt}`
    }

    return prompt
  },
  [connected, systemPrompt]
)
```

**Update interface:**

```typescript
buildSystemPrompt: (basePrompt: string, memoryContext?: string) => string
```

### Task 1.3: Update App.tsx to Pass Memory Context

**File:** `/src/renderer/src/App.tsx`

Find where messages are sent to the AI and ensure memory context is fetched and injected. Look for the `sendMessage` or similar function and update it:

```typescript
// In the message sending flow, fetch memory and build prompt with it
const handleSendMessage = async (content: string) => {
  // Fetch memory context for this conversation
  const memoryResult = await fetchMemoryContext(activeId, projectPath)
  
  // Build system prompt with persona + memory + tools
  const systemPrompt = buildSystemPrompt(
    activePersonaContent || defaultSystemPrompt,
    memoryResult.context || undefined
  )
  
  // ... rest of send logic
}
```

---

## Phase 2: Create AI Memory Storage Tool

### Task 2.1: Create Arbor Memory Tool Definition

**File:** `/src/main/mcp/tools/arborMemoryTool.ts` (NEW FILE)

```typescript
// src/main/mcp/tools/arborMemoryTool.ts
/**
 * Arbor Memory Storage Tool
 * 
 * Provides AI with ability to explicitly store memories
 * to the ArborMemoryService (native SQLite storage).
 */

import { ArborMemoryService } from '../../services/ArborMemoryService'
import type { MemoryType } from '../../../shared/types/memory'

export interface ArborMemoryToolParams {
  content: string
  type: MemoryType
  importance?: 'low' | 'medium' | 'high'
  tags?: string[]
}

export interface ArborMemoryToolContext {
  conversationId?: string
  projectPath?: string
}

/**
 * Tool definition for AI to store memories
 */
export const arborMemoryToolDefinition = {
  name: 'arbor_store_memory',
  description: `Store information about the user for future conversations. This memory persists across all conversations and is automatically included in future context.

Use this to remember:
- User preferences (coding style, communication preferences, favorite tools)
- Facts about the user (name, role, company, projects they work on)
- Standing instructions (how they want things done, formatting preferences)
- Skills and expertise they've mentioned
- Important context for ongoing work

Examples:
- "User prefers TypeScript over JavaScript"
- "User's name is Alex and they work at TechCorp"
- "Always use descriptive variable names in code"
- "User is working on ArborChat, an Electron app"

Be specific and concise. Avoid storing temporary or session-specific information.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      content: {
        type: 'string',
        description: 'The information to remember (be specific and concise)'
      },
      type: {
        type: 'string',
        enum: ['preference', 'fact', 'instruction', 'skill', 'context'],
        description: `Category of memory:
- preference: User preferences (coding style, UI preferences)
- fact: Facts about the user (name, role, projects)
- instruction: Standing instructions (always do X, never do Y)
- skill: User skills and expertise
- context: Current work context (ongoing projects, goals)`
      },
      importance: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'How important is this? High = always include in context. Default: medium'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags for categorization (e.g., ["coding", "preferences"])'
      }
    },
    required: ['content', 'type']
  }
}

/**
 * Execute the arbor_store_memory tool
 */
export async function executeArborMemoryTool(
  params: ArborMemoryToolParams,
  context: ArborMemoryToolContext
): Promise<{ success: boolean; message: string }> {
  const memoryService = ArborMemoryService.getInstance()

  const privacyLevel = {
    low: 'normal' as const,
    medium: 'normal' as const,
    high: 'always_include' as const
  }[params.importance || 'medium']

  const confidence = {
    low: 0.7,
    medium: 0.85,
    high: 1.0
  }[params.importance || 'medium']

  const result = await memoryService.storeMemory({
    content: params.content,
    type: params.type,
    scope: context.projectPath ? 'project' : 'global',
    scopeId: context.projectPath,
    source: 'agent_stored',
    confidence,
    privacyLevel,
    tags: params.tags
  })

  if (result.success) {
    if (result.duplicate) {
      return {
        success: true,
        message: `Memory already exists (refreshed): "${params.content}"`
      }
    }
    return {
      success: true,
      message: `Stored ${params.type} memory: "${params.content}"`
    }
  }

  return {
    success: false,
    message: `Failed to store memory: ${result.error}`
  }
}
```

### Task 2.2: Register Tool with MCP Manager

**File:** `/src/main/mcp/manager.ts`

Add the arbor memory tool to the available tools. Find the `getAvailableTools` method and include the arbor tool:

```typescript
import { arborMemoryToolDefinition, executeArborMemoryTool } from './tools/arborMemoryTool'

// In the MCPManager class, add a method to get internal tools
getInternalTools(): ToolDefinition[] {
  return [
    {
      name: arborMemoryToolDefinition.name,
      description: arborMemoryToolDefinition.description,
      inputSchema: arborMemoryToolDefinition.inputSchema
    }
  ]
}

// Update getAvailableTools to include internal tools
getAvailableTools(): Array<ToolDefinition & { server: string }> {
  const allTools: Array<ToolDefinition & { server: string }> = []
  
  // Add internal Arbor tools
  for (const tool of this.getInternalTools()) {
    allTools.push({ ...tool, server: 'arbor' })
  }
  
  // Add MCP server tools
  for (const [serverName, server] of this.servers) {
    // ... existing code
  }
  
  return allTools
}

// Update callTool to handle internal tools
async callTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  context?: { conversationId?: string; projectPath?: string }
): Promise<unknown> {
  // Handle internal Arbor tools
  if (serverName === 'arbor') {
    if (toolName === 'arbor_store_memory') {
      return executeArborMemoryTool(
        args as ArborMemoryToolParams,
        context || {}
      )
    }
    throw new Error(`Unknown arbor tool: ${toolName}`)
  }
  
  // ... existing MCP server tool handling
}
```

### Task 2.3: Update Tool System Prompt

**File:** `/src/main/mcp/manager.ts`

Update `getToolSystemPrompt()` to include arbor memory tool instructions:

```typescript
getToolSystemPrompt(): string {
  let prompt = `You have access to the following tools:\n\n`
  
  // Add arbor memory tool first
  prompt += `## Memory Tool (arbor_store_memory)
${arborMemoryToolDefinition.description}

To store a memory, use:
<tool_use>
<tool>arbor_store_memory</tool>
<args>
{
  "content": "The information to remember",
  "type": "preference|fact|instruction|skill|context",
  "importance": "low|medium|high"
}
</args>
</tool_use>

`

  // Add MCP tools
  // ... existing code
  
  return prompt
}
```

---

## Phase 3: Implement Memory Scheduler

### Task 3.1: Create MemoryScheduler Service

**File:** `/src/main/services/MemoryScheduler.ts` (NEW FILE)

```typescript
// src/main/services/MemoryScheduler.ts
/**
 * Memory Scheduler Service
 * 
 * Handles periodic maintenance tasks for ArborMemoryService:
 * - Decay: Reduce confidence of unaccessed memories
 * - Cleanup: Remove very low confidence, old memories
 * 
 * @author Alex Chen Design Implementation
 */

import { ArborMemoryService } from './ArborMemoryService'

export class MemoryScheduler {
  private decayInterval: NodeJS.Timeout | null = null
  private memoryService: ArborMemoryService
  private isRunning = false

  constructor() {
    this.memoryService = ArborMemoryService.getInstance()
  }

  /**
   * Start the decay scheduler.
   * Runs immediately on start, then every 24 hours.
   */
  start(): void {
    if (this.isRunning) {
      console.log('[MemoryScheduler] Already running')
      return
    }

    this.isRunning = true
    console.log('[MemoryScheduler] Starting decay scheduler...')

    // Run immediately on start
    this.runDecay()

    // Then run every 24 hours
    const twentyFourHours = 24 * 60 * 60 * 1000
    this.decayInterval = setInterval(() => {
      this.runDecay()
    }, twentyFourHours)

    console.log('[MemoryScheduler] Decay scheduler started (runs every 24h)')
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.decayInterval) {
      clearInterval(this.decayInterval)
      this.decayInterval = null
    }
    this.isRunning = false
    console.log('[MemoryScheduler] Stopped')
  }

  /**
   * Run decay process manually
   */
  runDecay(): void {
    try {
      const result = this.memoryService.runDecay()
      console.log(
        `[MemoryScheduler] Decay complete: ${result.updated} confidence reduced, ${result.deleted} deleted`
      )
    } catch (error) {
      console.error('[MemoryScheduler] Decay failed:', error)
    }
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning
  }
}

// Singleton instance
let schedulerInstance: MemoryScheduler | null = null

export function getMemoryScheduler(): MemoryScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new MemoryScheduler()
  }
  return schedulerInstance
}
```

### Task 3.2: Initialize Scheduler in Main Process

**File:** `/src/main/index.ts`

Add scheduler initialization at app startup and cleanup on quit:

```typescript
import { getMemoryScheduler } from './services/MemoryScheduler'

// In app ready handler, after other initialization:
app.whenReady().then(async () => {
  // ... existing initialization
  
  // Start memory decay scheduler
  const memoryScheduler = getMemoryScheduler()
  memoryScheduler.start()
})

// In app quit handler:
app.on('before-quit', () => {
  // Stop memory scheduler
  const memoryScheduler = getMemoryScheduler()
  memoryScheduler.stop()
  
  // ... existing cleanup
})
```

---

## Phase 4: Deprecate MCP Memory Server (Optional)

### Task 4.1: Disable MCP Memory Server by Default

**File:** `/src/main/mcp/servers/memory.ts`

```typescript
export const MEMORY_MCP_CONFIG: MCPServerConfig = {
  name: 'memory',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-memory'],
  enabled: false, // DISABLED - ArborMemoryService is now primary
  env: {}
}
```

### Task 4.2: Add Migration Tool (Optional Enhancement)

If there's existing data in MCP Memory Server that should be migrated, create a migration utility:

**File:** `/src/main/services/MemoryMigration.ts` (NEW FILE - Optional)

```typescript
// Optional: Migration from MCP Memory Server to ArborMemoryService
// This would read from MCP Memory's JSON storage and import to SQLite

import { ArborMemoryService } from './ArborMemoryService'
import { mcpManager } from '../mcp/manager'

export async function migrateMCPMemoryToArbor(): Promise<{
  success: boolean
  migrated: number
  errors: number
}> {
  const memoryService = ArborMemoryService.getInstance()
  let migrated = 0
  let errors = 0

  try {
    // Fetch all entities from MCP Memory Server
    const result = await mcpManager.callTool('memory', 'open_nodes', { names: [] })
    
    if (!result) {
      return { success: true, migrated: 0, errors: 0 }
    }

    const data = typeof result === 'string' ? JSON.parse(result) : result

    // Migrate entities
    if (data.entities && Array.isArray(data.entities)) {
      for (const entity of data.entities) {
        try {
          await memoryService.storeMemory({
            content: `${entity.name}: ${entity.observations?.join(', ') || ''}`,
            type: 'fact',
            source: 'system',
            confidence: 0.8,
            tags: [entity.entityType || 'migrated']
          })
          migrated++
        } catch (e) {
          errors++
        }
      }
    }

    return { success: true, migrated, errors }
  } catch (error) {
    console.error('[MemoryMigration] Failed:', error)
    return { success: false, migrated, errors }
  }
}
```

---

## Phase 5: Testing & Verification

### Test Checklist

1. **Memory Injection Test**
   - [ ] Start a new conversation
   - [ ] Verify `fetchMemoryContext` is called with ArborMemoryService
   - [ ] Check console for "[useToolChat] Fetching memory context from ArborMemoryService..."
   - [ ] Verify memory appears in system prompt sent to AI

2. **Memory Storage Test**
   - [ ] Ask AI to remember something: "Please remember that I prefer TypeScript"
   - [ ] Verify AI uses `arbor_store_memory` tool
   - [ ] Check ArborMemoryService database for new entry
   - [ ] Open Memory Config modal and verify count increased

3. **Memory Persistence Test**
   - [ ] Store a memory in one conversation
   - [ ] Start a NEW conversation
   - [ ] Verify memory context is automatically loaded
   - [ ] Ask AI "What do you remember about me?" - should mention stored info

4. **Decay Test**
   - [ ] Manually trigger decay: `window.api.arborMemory.runDecay()`
   - [ ] Verify old, unaccessed memories have reduced confidence
   - [ ] Verify very low confidence memories are deleted

5. **Memory Config Modal Test**
   - [ ] Open Memory Configuration modal
   - [ ] Verify it shows correct ArborMemoryService stats
   - [ ] Test "Clear All Memory" button
   - [ ] Verify stats update after operations

---

## File Summary

### New Files
- `/src/main/mcp/tools/arborMemoryTool.ts` - AI tool for memory storage
- `/src/main/services/MemoryScheduler.ts` - Decay scheduler service

### Modified Files
- `/src/renderer/src/hooks/useToolChat.ts` - Use ArborMemoryService, update buildSystemPrompt
- `/src/renderer/src/App.tsx` - Pass memory context to system prompt
- `/src/main/mcp/manager.ts` - Register arbor tools, handle in callTool
- `/src/main/index.ts` - Initialize/cleanup MemoryScheduler
- `/src/main/mcp/servers/memory.ts` - Disable MCP Memory Server (optional)

---

## Success Criteria

1. ✅ Memory is automatically loaded from ArborMemoryService at conversation start
2. ✅ Memory context is injected into system prompt before MCP tools
3. ✅ AI can store memories using `arbor_store_memory` tool
4. ✅ Memories persist across conversations and app restarts
5. ✅ MemoryScheduler runs daily decay process
6. ✅ MemoryConfigModal shows accurate ArborMemoryService statistics
7. ✅ MCP Memory Server is no longer the primary memory system
