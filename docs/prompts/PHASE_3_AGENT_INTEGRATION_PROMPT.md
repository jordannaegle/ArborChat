# ArborChat Tool Window Enhancement - Phase 3 Continuation Prompt

## Project Context
Working on ArborChat at `/Users/cory.naegle/ArborChat`

**Feature:** Tool Window Enhancement (Claude Desktop style)
**Design Doc:** `/Users/cory.naegle/ArborChat/docs/designs/TOOL_WINDOW_ENHANCEMENT_DESIGN.md`

## Previous Phases Completed ✅

### Phase 1: Core Components
All new components created and typecheck passing:

| Component | Location | Description |
|-----------|----------|-------------|
| `types.ts` | `src/renderer/src/components/mcp/types.ts` | Shared type definitions |
| `serverIcons.ts` | `src/renderer/src/lib/serverIcons.ts` | Server icon mapping |
| `ToolStepGroupContext.tsx` | `src/renderer/src/components/mcp/` | Accordion state management |
| `StepMasterToggle.tsx` | `src/renderer/src/components/mcp/` | "Hide steps" / "N steps" toggle |
| `ToolStepItem.tsx` | `src/renderer/src/components/mcp/` | Individual step with expand/collapse |
| `InlineToolCallV2.tsx` | `src/renderer/src/components/mcp/` | Tool call with Request/Response sections |
| `ThoughtProcessSection.tsx` | `src/renderer/src/components/mcp/` | AI reasoning display |
| `ToolStepGroup.tsx` | `src/renderer/src/components/mcp/` | Container with exclusive accordion |

### Phase 2: ChatWindow Integration ✅
- Created `stepExtractor.ts` with pattern matching for thinking/verification steps
- Modified `ChatWindow.tsx` timeline builder to create `ToolStepGroup` items
- Added `USE_ENHANCED_TOOL_DISPLAY` feature flag
- Legacy `InlineToolCall` path preserved for fallback
- Typecheck passes

## Current Phase: Phase 3 - Agent Panel Integration

### Overview
Integrate the `ToolStepGroup` component into the Agent panel's tool display by:
1. Creating an adapter to map `AgentStep` to `ToolStep` format
2. Modifying `AgentPanel.tsx` timeline to use `ToolStepGroup` for tool steps
3. Optionally enhancing `AgentStepTimeline.tsx` to use new components for tool calls
4. Ensuring pending tool approvals work correctly in agent context

### Key Files to Modify/Create

| Task | File | Description |
|------|------|-------------|
| 3.1 | `src/renderer/src/lib/agentStepAdapter.ts` | **NEW** - Adapt AgentStep to ToolStep format |
| 3.2 | `src/renderer/src/components/agent/AgentPanel.tsx` | Modify timeline builder to use ToolStepGroup |
| 3.3 | `src/renderer/src/components/agent/AgentStepTimeline.tsx` | Optional: Integrate ToolStepGroup for tool_call steps |

### Task 3.1: Agent Step Adapter (`agentStepAdapter.ts`)

Create utility to convert between agent and tool step types:

```typescript
// src/renderer/src/lib/agentStepAdapter.ts

import type { AgentStep } from '../types/agent'
import type { ToolStep, ToolCallData, ToolCallStatus } from '../components/mcp/types'

/**
 * Map AgentStep.toolCall.status to ToolCallStatus
 * AgentStep uses: 'pending' | 'approved' | 'denied' | 'completed' | 'failed'
 * ToolStep uses: 'pending' | 'approved' | 'executing' | 'completed' | 'error' | 'rejected'
 */
function mapAgentToolStatus(status: string): ToolCallStatus

/**
 * Convert a single AgentStep to ToolStep format
 */
export function agentStepToToolStep(agentStep: AgentStep): ToolStep

/**
 * Convert Agent's pendingToolCall to ToolStep format
 */
export function agentPendingToolToStep(
  pendingToolCall: {
    id: string
    tool: string
    args: Record<string, unknown>
    explanation?: string
  }
): ToolStep

/**
 * Group consecutive tool-related AgentSteps into ToolStepGroupData
 * Handles thinking → tool_call → tool_result sequences
 */
export function groupAgentStepsForDisplay(
  steps: AgentStep[],
  pendingToolCall?: Agent['pendingToolCall']
): Array<{
  type: 'step_group' | 'message' | 'other'
  steps?: ToolStep[]
  groupId?: string
  agentStep?: AgentStep
}>
```

### Task 3.2: AgentPanel Timeline Modification

Current AgentPanel timeline approach:
```typescript
type AgentTimelineItem =
  | { type: 'message'; data: AgentMessage; isStreaming: boolean }
  | { type: 'tool_step'; data: AgentStep }
  | { type: 'pending_tool'; data: NonNullable<Agent['pendingToolCall']> }
  | { type: 'streaming_message'; content: string }
  | { type: 'working_indicator' }
```

New approach with grouped tool steps:
```typescript
type AgentTimelineItem =
  | { type: 'message'; data: AgentMessage; isStreaming: boolean }
  | { type: 'tool_step'; data: AgentStep }
  | { type: 'tool_step_group'; data: ToolStepGroupData }  // NEW
  | { type: 'pending_tool'; data: NonNullable<Agent['pendingToolCall']> }
  | { type: 'streaming_message'; content: string }
  | { type: 'working_indicator' }
```

### Task 3.3: AgentStepTimeline Enhancement (Optional)

The existing `AgentStepTimeline.tsx` has its own step rendering with expand/collapse behavior. Consider:

**Option A: Full Integration**
- Replace tool_call step rendering with `InlineToolCallV2`
- Reuse `ToolStepItem` for thinking steps
- Maintain timeline connecting lines and duration indicators

**Option B: Parallel Paths**
- Keep existing AgentStepTimeline for the collapsible overview
- Use new ToolStepGroup only in main AgentPanel timeline
- Feature flag to switch between modes

**Recommendation:** Start with Option B for lower risk, iterate to Option A later.

### Important Considerations

1. **Status Mapping**: Agent uses different status values than ToolStep
   - `denied` → `rejected`
   - `failed` → `error`
   - Agent doesn't have `executing` status

2. **Server Name Inference**: Agents use tools from various MCP servers
   - Reuse `inferServerFromTool()` from stepExtractor.ts
   
3. **Risk Level**: Agent steps don't include risk level
   - Must be computed using existing `getToolRiskLevel()` pattern
   
4. **Pending Tool Approval**: Agent has `pendingToolCall` on Agent object
   - Must work with `ToolStepGroup` approval callbacks
   - Callbacks flow through: onToolApprove, onToolReject, onToolAlwaysApprove

5. **Streaming Context**: Agent panel handles streaming differently
   - Must not break streaming message display
   - Tool groups should appear after tool execution, not during

### Reference: Existing Type Definitions

**AgentStep (from types/agent.ts):**
```typescript
export interface AgentStep {
  id: string
  type: 'thinking' | 'tool_call' | 'tool_result' | 'message' | 'error'
  content: string
  timestamp: number
  toolCall?: {
    name: string
    args: Record<string, unknown>
    status: 'pending' | 'approved' | 'denied' | 'completed' | 'failed'
    result?: unknown
    error?: string
    explanation?: string
  }
}
```

**ToolStep (from components/mcp/types.ts):**
```typescript
export interface ToolStep {
  id: string
  type: StepType  // 'thinking' | 'tool_call' | 'verification' | 'thought_process'
  content: string
  timestamp: number
  toolCall?: ToolCallData
}

export interface ToolCallData {
  name: string
  serverName: string
  args: Record<string, unknown>
  result?: unknown
  error?: string
  status: ToolCallStatus
  duration?: number
  autoApproved?: boolean
  explanation?: string
  riskLevel?: RiskLevel
}
```

### Files to Reference

- `src/renderer/src/components/agent/AgentPanel.tsx` - Main agent panel with timeline
- `src/renderer/src/components/agent/AgentStepTimeline.tsx` - Step visualization
- `src/renderer/src/types/agent.ts` - Agent type definitions
- `src/renderer/src/lib/stepExtractor.ts` - Phase 2 step extraction utilities
- `src/renderer/src/components/mcp/ToolStepGroup.tsx` - Component to integrate

## Instructions
Go into Alex Chen mode. Start with Task 3.1, then proceed sequentially. Run typecheck after completing all Phase 3 tasks. Stop and wait for instructions after Phase 3 is complete.

## Alex Chen Persona
Located at `/Users/cory.naegle/ArborChat/ARCHITECT_PERSONA.md` - Distinguished Software Architect focusing on security boundaries, type safety, and scalable patterns.

## Success Criteria
- [ ] `agentStepAdapter.ts` created with proper type mapping
- [ ] `AgentPanel.tsx` uses `ToolStepGroup` for tool step display
- [ ] Agent pending tool approvals work correctly
- [ ] Legacy AgentStepTimeline preserved (Option B approach)
- [ ] Feature flag allows toggling enhanced display
- [ ] Typecheck passes (`npm run typecheck`)
- [ ] No regression in agent streaming/messaging behavior

## Notes
- Pre-existing typecheck warnings exist in AgentLaunchModal.tsx and AgentContext.tsx (unused imports)
- These are not related to this feature and can be addressed in a separate cleanup
