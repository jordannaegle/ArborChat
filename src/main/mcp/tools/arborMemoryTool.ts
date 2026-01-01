/**
 * Arbor Memory Storage Tool
 * 
 * Provides AI with the ability to explicitly store memories
 * to the ArborMemoryService (native SQLite storage).
 * 
 * This is an internal tool that does NOT require MCP server connection.
 * It integrates directly with ArborMemoryService.
 * 
 * @module main/mcp/tools/arborMemoryTool
 * @author Alex Chen Design Implementation
 */

import { ArborMemoryService } from '../../services/ArborMemoryService'
import type { MemoryType, MemoryScope, MemorySource, MemoryPrivacyLevel } from '../../../shared/types/memory'

// ============================================================================
// Types
// ============================================================================

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

export interface ArborMemoryToolResult {
  success: boolean
  message: string
  memoryId?: string
}

// ============================================================================
// Tool Definition (MCP-compatible schema)
// ============================================================================

/**
 * Tool definition for AI to store memories.
 * This definition is compatible with MCP tool schema format.
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
        enum: ['preference', 'fact', 'instruction', 'skill', 'context', 'relationship'],
        description: `Category of memory:
- preference: User preferences (coding style, UI preferences)
- fact: Facts about the user (name, role, projects)
- instruction: Standing instructions (always do X, never do Y)
- skill: User skills and expertise
- context: Current work context (ongoing projects, goals)
- relationship: Relations to other entities or people`
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


// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Execute the arbor_store_memory tool.
 * 
 * Maps the tool parameters to ArborMemoryService's storeMemory method,
 * handling importance-to-privacy-level conversion and scope determination.
 * 
 * @param params - Tool parameters from AI
 * @param context - Execution context (conversation/project info)
 * @returns Result object with success status and message
 */
export async function executeArborMemoryTool(
  params: ArborMemoryToolParams,
  context: ArborMemoryToolContext
): Promise<ArborMemoryToolResult> {
  const memoryService = ArborMemoryService.getInstance()

  // Map importance to privacy level
  const privacyLevel: MemoryPrivacyLevel = {
    low: 'normal' as const,
    medium: 'normal' as const,
    high: 'always_include' as const
  }[params.importance || 'medium']

  // Map importance to confidence
  const confidence: number = {
    low: 0.7,
    medium: 0.85,
    high: 1.0
  }[params.importance || 'medium']

  // Determine scope based on context
  const scope: MemoryScope = context.projectPath ? 'project' : 'global'
  const scopeId = context.projectPath

  // Store the memory
  const result = memoryService.storeMemory({
    content: params.content,
    type: params.type,
    scope,
    scopeId,
    source: 'agent_stored' as MemorySource,
    confidence,
    privacyLevel,
    tags: params.tags
  })

  if (result.success) {
    if (result.duplicate) {
      return {
        success: true,
        message: `Memory already exists (refreshed): "${params.content.substring(0, 50)}${params.content.length > 50 ? '...' : ''}"`,
        memoryId: result.existingMemoryId
      }
    }
    return {
      success: true,
      message: `Stored ${params.type} memory: "${params.content.substring(0, 50)}${params.content.length > 50 ? '...' : ''}"`,
      memoryId: result.memoryId
    }
  }

  return {
    success: false,
    message: `Failed to store memory: ${result.error}`
  }
}

// ============================================================================
// Internal Tool Registry
// ============================================================================

/**
 * Check if a tool name is an internal Arbor tool.
 */
export function isArborInternalTool(toolName: string): boolean {
  return toolName === 'arbor_store_memory'
}

/**
 * Get all internal tool definitions.
 */
export function getArborInternalTools(): Array<typeof arborMemoryToolDefinition> {
  return [arborMemoryToolDefinition]
}
