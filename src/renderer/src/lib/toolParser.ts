// src/renderer/src/lib/toolParser.ts

/**
 * Represents a parsed tool call from AI response
 */
export interface ToolCall {
  tool: string
  args: Record<string, unknown>
  explanation: string
}

/**
 * Parse tool calls from AI response content
 * Looks for ```tool_use code blocks with JSON
 */
export function parseToolCalls(content: string): ToolCall[] {
  const regex = /```tool_use\n([\s\S]*?)\n```/g
  const calls: ToolCall[] = []

  let match
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      calls.push({
        tool: parsed.tool || '',
        args: parsed.args || {},
        explanation: parsed.explanation || ''
      })
    } catch (e) {
      console.error('[ToolParser] Failed to parse tool call:', e, match[1])
    }
  }

  return calls
}

/**
 * Strip tool call blocks from content for display
 */
export function stripToolCalls(content: string): string {
  return content.replace(/```tool_use\n[\s\S]*?\n```/g, '').trim()
}

/**
 * Check if content contains tool calls
 */
export function hasToolCalls(content: string): boolean {
  return /```tool_use\n[\s\S]*?\n```/.test(content)
}

/**
 * Extract the first tool call from content (for sequential processing)
 */
export function extractFirstToolCall(content: string): ToolCall | null {
  const calls = parseToolCalls(content)
  return calls[0] || null
}

/**
 * Format tool result for AI context
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

  const resultStr = typeof result === 'string' 
    ? result 
    : JSON.stringify(result, null, 2)

  return `<tool_result name="${toolName}" status="success">
${resultStr}
</tool_result>`
}
