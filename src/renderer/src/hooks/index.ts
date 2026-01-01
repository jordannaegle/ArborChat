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

// Phase 2: Agent Watchdog System
export { useAgentWatchdog, formatWatchdogDuration } from './useAgentWatchdog'
export type {
  WatchdogStatus,
  WatchdogActivityState,
  WatchdogState,
  WatchdogCallbacks
} from './useAgentWatchdog'

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

// Tool Window Phase 6: Keyboard Navigation & Accessibility
export { useStepKeyboardNav } from './useStepKeyboardNav'
export type {
  UseStepKeyboardNavOptions,
  UseStepKeyboardNavReturn
} from './useStepKeyboardNav'

export { useReducedMotion } from './useReducedMotion'

// Tool Window Phase 6.4: Real-time Streaming Extraction
export { useStreamingStepExtractor } from './useStreamingStepExtractor'
export type {
  ExtractedThought,
  UseStreamingStepExtractorOptions,
  UseStreamingStepExtractorReturn
} from './useStreamingStepExtractor'

// Phase 7: Tool Call State Management (Shared Hook)
export { useToolCallState } from './useToolCallState'
export type {
  UseToolCallStateOptions,
  UseToolCallStateReturn
} from './useToolCallState'
