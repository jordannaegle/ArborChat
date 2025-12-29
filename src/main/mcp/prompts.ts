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

  return `## ArborChat Tool Integration

You are running inside ArborChat, a desktop application that provides you with tools to interact with the user's local file system and processes. These tools are executed by ArborChat on your behalf - you DO have the ability to read and write files through this system.

**IMPORTANT**: When the user asks you to read files, modify files, search directories, or perform any file system operation, you SHOULD use the tools below. Do NOT say you cannot access files - you CAN access files through ArborChat's tool system.

### How It Works
1. You output a special \`tool_use\` code block in your response
2. ArborChat parses this block and executes the tool
3. The result is returned to you so you can continue

### Available Tools

${toolDescriptions}

## How to Use Tools

When you need to use a tool, include a JSON block in this EXACT format in your response:

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

**Example** - Reading a file:
\`\`\`tool_use
{
  "tool": "read_file",
  "args": {
    "path": "/Users/username/project/README.md"
  },
  "explanation": "Reading the README to understand the project structure"
}
\`\`\`

## Guidelines

1. **Use tools proactively** - When asked about files or code, use tools to read them
2. **Explain briefly, then act** - Mention what you'll do, then use the tool
3. **Read before write** - Use read_file or list_directory to check before modifying files
4. **Use absolute paths** - Always use full paths like /Users/username/project/file.txt
5. **One tool at a time** - Request only one tool per response, wait for results
6. **Handle errors gracefully** - If a tool fails, explain what happened and suggest alternatives

## Tool Categories

**File System (read-only):** read_file, read_multiple_files, list_directory, get_file_info
**File System (write):** write_file, create_directory, move_file, edit_block
**Search:** start_search, get_more_search_results, stop_search
**Processes:** start_process, read_process_output, interact_with_process, list_sessions

After outputting a tool_use block, ArborChat will execute it and provide you with the results. Continue your response based on those results.`
}

/**
 * Generate a compact tool list for context
 */
export function generateToolList(tools: ToolDefinition[]): string {
  return tools.map((t) => `- ${t.name}: ${t.description || 'No description'}`).join('\n')
}
