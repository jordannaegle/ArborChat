// src/main/providers/toolFormatter.ts
// Converts MCP tool definitions to provider-specific formats
// Author: Alex Chen (Distinguished Software Architect)
// Phase 1 & 2: Coding Capability Improvements - Native Tool Calling

import type { ToolDefinition } from '../mcp/types'
import { 
  SchemaType, 
  type FunctionDeclaration, 
  type FunctionDeclarationSchema,
  type Schema 
} from '@google/generative-ai'

/**
 * Convert MCP tools to Gemini function declarations
 * @see https://ai.google.dev/gemini-api/docs/function-calling
 */
export function toGeminiFunctions(tools: ToolDefinition[]): FunctionDeclaration[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description || `Execute the ${tool.name} tool`,
    parameters: sanitizeSchemaForGemini(tool.inputSchema)
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
 * Convert a JSON Schema property to Gemini Schema format
 * Uses type narrowing to build proper discriminated union types
 */
function convertPropertyToSchema(prop: Record<string, unknown>): Schema {
  const type = (prop.type as string) || 'string'
  const description = prop.description as string | undefined
  
  switch (type) {
    case 'string': {
      // Check if it's an enum string
      if (prop.enum && Array.isArray(prop.enum)) {
        return {
          type: SchemaType.STRING,
          format: 'enum',
          enum: prop.enum as string[],
          ...(description && { description })
        }
      }
      return {
        type: SchemaType.STRING,
        ...(description && { description })
      }
    }
    
    case 'number':
      return {
        type: SchemaType.NUMBER,
        ...(description && { description })
      }
    
    case 'integer':
      return {
        type: SchemaType.INTEGER,
        ...(description && { description })
      }
    
    case 'boolean':
      return {
        type: SchemaType.BOOLEAN,
        ...(description && { description })
      }
    
    case 'array': {
      const items = prop.items 
        ? convertPropertyToSchema(prop.items as Record<string, unknown>)
        : { type: SchemaType.STRING } as Schema
      return {
        type: SchemaType.ARRAY,
        items,
        ...(description && { description })
      }
    }
    
    case 'object': {
      const nestedProps: Record<string, Schema> = {}
      if (prop.properties) {
        for (const [key, value] of Object.entries(prop.properties as Record<string, unknown>)) {
          nestedProps[key] = convertPropertyToSchema(value as Record<string, unknown>)
        }
      }
      return {
        type: SchemaType.OBJECT,
        properties: nestedProps,
        ...(description && { description })
      }
    }
    
    default:
      // Default to string for unknown types
      return {
        type: SchemaType.STRING,
        ...(description && { description })
      }
  }
}

/**
 * Sanitize JSON schema specifically for Gemini's FunctionDeclarationSchema type
 * Returns the top-level schema format Gemini expects for function parameters
 */
function sanitizeSchemaForGemini(schema: ToolDefinition['inputSchema']): FunctionDeclarationSchema {
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

  const result: FunctionDeclarationSchema = {
    type: SchemaType.OBJECT,
    properties
  }

  // Only include required if it's a non-empty array
  if (schema.required && Array.isArray(schema.required) && schema.required.length > 0) {
    result.required = schema.required
  }

  // Include description if present
  if (schema.description && typeof schema.description === 'string') {
    result.description = schema.description
  }

  return result
}

/**
 * Tool risk classification for filtering
 */
type ToolRiskLevel = 'safe' | 'moderate' | 'dangerous'

const TOOL_RISK: Record<string, ToolRiskLevel> = {
  // Safe operations - read-only, no side effects
  read_file: 'safe',
  read_multiple_files: 'safe',
  list_directory: 'safe',
  get_file_info: 'safe',
  get_config: 'safe',
  list_sessions: 'safe',
  list_processes: 'safe',
  list_searches: 'safe',
  get_more_search_results: 'safe',
  start_search: 'safe',
  get_usage_stats: 'safe',
  get_recent_tool_calls: 'safe',
  
  // Moderate operations - write operations, reversible
  write_file: 'moderate',
  create_directory: 'moderate',
  edit_block: 'moderate',
  str_replace: 'moderate',
  start_process: 'moderate',
  interact_with_process: 'moderate',
  read_process_output: 'moderate',
  stop_search: 'moderate',
  
  // Dangerous operations - destructive, system-level
  move_file: 'dangerous',
  force_terminate: 'dangerous',
  kill_process: 'dangerous',
  set_config_value: 'dangerous'
}

/**
 * Filter tools to a specific subset (e.g., safe tools only)
 */
export function filterToolsByRisk(
  tools: ToolDefinition[],
  allowedRiskLevels: ToolRiskLevel[]
): ToolDefinition[] {
  return tools.filter(tool => {
    const risk = TOOL_RISK[tool.name] || 'moderate'
    return allowedRiskLevels.includes(risk)
  })
}

/**
 * Get the risk level for a specific tool
 */
export function getToolRisk(toolName: string): ToolRiskLevel {
  return TOOL_RISK[toolName] || 'moderate'
}

/**
 * Validate tool definitions have required fields
 */
export function validateToolDefinitions(tools: ToolDefinition[]): {
  valid: ToolDefinition[]
  invalid: Array<{ tool: ToolDefinition; reason: string }>
} {
  const valid: ToolDefinition[] = []
  const invalid: Array<{ tool: ToolDefinition; reason: string }> = []
  
  for (const tool of tools) {
    if (!tool.name) {
      invalid.push({ tool, reason: 'Missing tool name' })
      continue
    }
    
    if (tool.name.length > 64) {
      invalid.push({ tool, reason: 'Tool name exceeds 64 characters' })
      continue
    }
    
    // Gemini requires alphanumeric names with underscores
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tool.name)) {
      invalid.push({ tool, reason: 'Tool name contains invalid characters' })
      continue
    }
    
    valid.push(tool)
  }
  
  return { valid, invalid }
}
