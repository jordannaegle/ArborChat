// src/main/mcp/prompts.ts

import { ToolDefinition } from './types'

/**
 * Generate a system prompt that describes available MCP tools to the AI
 */
export function generateToolSystemPrompt(tools: ToolDefinition[]): string {
  if (tools.length === 0) {
    return ''
  }

  const toolDescriptions = tools
    .map(
      (tool) => `### ${tool.name}
${tool.description || 'No description available'}

**Input Schema:**
\`\`\`json
${JSON.stringify(tool.inputSchema, null, 2)}
\`\`\`
`
    )
    .join('\n')

  return `## Available Tools

You have access to the following tools for interacting with the local file system and processes:

${toolDescriptions}

## How to Request Tool Use

When you need to use a tool, respond with a JSON block in this exact format:

\`\`\`tool_use
{
  "tool": "tool_name",
  "args": {
    "param1": "value1",
    "param2": "value2"
  },
  "explanation": "Brief explanation of why you're using this tool"
}
\`\`\`

## Important Guidelines

1. **Explain before acting** - Always explain what you're about to do before requesting a tool
2. **Read before write** - Use read_file or list_directory to check before modifying files
3. **Use absolute paths** - Always use full paths like /Users/username/project/file.txt
4. **One tool at a time** - Request only one tool per response, wait for results
5. **Handle errors gracefully** - If a tool fails, explain what happened and suggest alternatives
6. **Prefer safe operations** - Use read-only tools when possible

## Tool Categories

**File System (read-only):** read_file, read_multiple_files, list_directory, get_file_info
**File System (write):** write_file, create_directory, move_file, edit_block
**Search:** start_search, get_more_search_results, stop_search
**Processes:** start_process, read_process_output, interact_with_process, list_sessions

After requesting a tool, wait for the user to approve and for the result before continuing.`
}

/**
 * Generate a compact tool list for context
 */
export function generateToolList(tools: ToolDefinition[]): string {
  return tools.map((t) => `- ${t.name}: ${t.description || 'No description'}`).join('\n')
}
