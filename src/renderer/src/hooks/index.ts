// src/renderer/src/hooks/index.ts
// Phase 6.5: Added useAgentCleanup for resource management

export { useMCPTools } from './useMCPTools'
export type { ToolExecution } from './useMCPTools'

export { useToolChat } from './useToolChat'
export type { PendingToolCall, UseToolChatResult } from './useToolChat'

// Phase 4: Slash Commands
export { useSlashCommands } from './useSlashCommands'
export type { SlashCommand, SlashCommandMatch, SlashCommandState } from './useSlashCommands'

// Agent System
export { useAgent } from './useAgent'
export type { UseAgentResult } from './useAgent'

// Agent Execution Engine
export { useAgentRunner } from './useAgentRunner'
export type { UseAgentRunnerResult, AgentRunnerState } from './useAgentRunner'

// Agent Notifications (Phase 5)
export { useAgentNotifications } from './useAgentNotifications'

// Phase 6.5: Agent Resource Cleanup
export { useAgentCleanup, CLEANUP_THRESHOLDS } from './useAgentCleanup'
export type { MemorySnapshot } from './useAgentCleanup'

// Work Journal hooks
export { useWorkJournal } from './useWorkJournal'
export { useWorkSession } from './useWorkSession'
export type {
  ThinkingContent,
  ToolRequestContent,
  ToolResultContent,
  DecisionContent,
  ErrorContent,
  FileOperationContent
} from './useWorkJournal'

// Notebook System
export { useNotebooks } from './useNotebooks'
export type {
  UseNotebooksState,
  UseNotebooksActions,
  UseNotebooksReturn
} from './useNotebooks'

// Notebook Keyboard Shortcuts (Phase 6)
export { useNotebookShortcuts } from './useNotebookShortcuts'

// Phase 7: Accessibility and Polish Utilities
export { useFocusTrap } from './useFocusTrap'
export { useDebounce } from './useDebounce'
