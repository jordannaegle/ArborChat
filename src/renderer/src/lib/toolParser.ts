// src/renderer/src/lib/toolParser.ts
// Enhanced tool call parsing with fallbacks
// Author: Alex Chen (Distinguished Software Architect)
// Phase 1: Coding Capability Improvements

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
  
  // Fix single quotes to double quotes (careful with nested strings)
  // Only do this if the JSON doesn't already have double quotes for the keys
  if (!fixed.includes('"tool"')) {
    fixed = fixed.replace(/'/g, '"')
  }
  
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

/**
 * Validate a tool call has the required structure
 */
export function isValidToolCall(obj: unknown): obj is ToolCall {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'tool' in obj &&
    typeof (obj as Record<string, unknown>).tool === 'string'
  )
}
