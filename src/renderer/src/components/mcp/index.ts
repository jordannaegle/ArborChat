// src/renderer/src/components/mcp/index.ts
// MCP component exports - Tool display, approval, and memory management
// Phase 6: Added accessibility and virtualization components

// === Legacy Components (preserved for backward compatibility) ===
export { ToolApprovalCard } from './ToolApprovalCard'
export { ToolResultCard } from './ToolResultCard'
export { InlineToolCall } from './InlineToolCall'
export type { InlineToolCallProps } from './InlineToolCall'

// === Provider and Hooks ===
export { MCPProvider, useMCP } from './MCPProvider'

// === Memory Components ===
export { MemoryIndicator, MemoryBadge } from './MemoryIndicator'
export type { MemoryStatus } from './MemoryIndicator'

// === Enhanced Tool Step Display Components ===
// Types
export type {
  ToolCallStatus,
  StepType,
  RiskLevel,
  ToolStep,
  ToolCallData,
  ToolStepGroupData,
  ToolApprovalCallbacks,
  ServerIconConfig,
  AccordionItemProps,
  StatusStyleConfig
} from './types'

// Context and Hooks
export {
  ToolStepGroupProvider,
  useToolStepGroup,
  useAccordion
} from './ToolStepGroupContext'

// Components
export { StepMasterToggle } from './StepMasterToggle'
export { ToolStepItem } from './ToolStepItem'
export { InlineToolCallV2 } from './InlineToolCallV2'
export type { InlineToolCallV2Props } from './InlineToolCallV2'
export { ThoughtProcessSection } from './ThoughtProcessSection'
export { ToolStepGroup } from './ToolStepGroup'

// === Phase 6: Accessibility Components ===
export { StepAnnouncer, formatStatusAnnouncement, formatFocusAnnouncement, formatExpansionAnnouncement } from './StepAnnouncer'
export { AccessibleStepGroup } from './AccessibleStepGroup'
export type { AccessibleStepGroupRenderProps } from './AccessibleStepGroup'

// === Phase 6: Performance Components ===
export { VirtualizedStepList } from './VirtualizedStepList'

// === Phase 7: Shared Configuration ===
export {
  STATUS_CONFIG,
  getStatusIcon,
  RISK_STYLES,
  isLongContent,
  formatResult,
  getArgsSummary
} from './toolCallConfig'
export type { StatusConfig, RiskConfig } from './toolCallConfig'
