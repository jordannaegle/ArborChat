// src/renderer/src/hooks/index.ts

export { useMCPTools } from './useMCPTools'
export type { ToolExecution } from './useMCPTools'

export { useToolChat } from './useToolChat'
export type { PendingToolCall, UseToolChatResult } from './useToolChat'

// Phase 4: Slash Commands
export { useSlashCommands } from './useSlashCommands'
export type { 
  SlashCommand, 
  SlashCommandMatch, 
  SlashCommandState 
} from './useSlashCommands'

// Agent System
export { useAgent } from './useAgent'
export type { UseAgentResult } from './useAgent'

// Agent Execution Engine
export { useAgentRunner } from './useAgentRunner'
export type { UseAgentRunnerResult, AgentRunnerState } from './useAgentRunner'
