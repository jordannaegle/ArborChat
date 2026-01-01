# ArborChat Tool Window Enhancement - Phase 2 Continuation Prompt

## Project Context
Working on ArborChat at `/Users/cory.naegle/ArborChat`

**Feature:** Tool Window Enhancement (Claude Desktop style)
**Design Doc:** `/Users/cory.naegle/ArborChat/docs/designs/TOOL_WINDOW_ENHANCEMENT_DESIGN.md`

## Phase 1 Completed ✅
All new components created and typecheck passing:

| Component | Location | Description |
|-----------|----------|-------------|
| `types.ts` | `src/renderer/src/components/mcp/types.ts` | Shared type definitions (`ToolStep`, `ToolCallStatus`, `StepType`, etc.) |
| `serverIcons.ts` | `src/renderer/src/lib/serverIcons.ts` | Server icon mapping (DC, GH, SSH, MEM) |
| `ToolStepGroupContext.tsx` | `src/renderer/src/components/mcp/` | Accordion state management + `useAccordion` hook |
| `StepMasterToggle.tsx` | `src/renderer/src/components/mcp/` | "Hide steps" / "N steps" toggle |
| `ToolStepItem.tsx` | `src/renderer/src/components/mcp/` | Individual step with expand/collapse |
| `InlineToolCallV2.tsx` | `src/renderer/src/components/mcp/` | Tool call with Request/Response sections |
| `ThoughtProcessSection.tsx` | `src/renderer/src/components/mcp/` | AI reasoning display |
| `ToolStepGroup.tsx` | `src/renderer/src/components/mcp/` | Container with exclusive accordion |
| `index.ts` | `src/renderer/src/components/mcp/index.ts` | Updated exports (backward compatible) |

## Current Phase: Phase 2 - ChatWindow Integration

### Overview
Integrate the new `ToolStepGroup` component into `ChatWindow.tsx` by:
1. Creating step extraction logic to parse AI messages for thinking/verification steps
2. Modifying timeline building to group tool executions with surrounding context
3. Conditionally rendering `ToolStepGroup` vs legacy `InlineToolCall`
4. Adding a feature flag for gradual rollout

### Key Files to Modify/Create

| Task | File | Description |
|------|------|-------------|
| 2.1 | `src/renderer/src/lib/stepExtractor.ts` | **NEW** - Extract thinking/verification steps from AI message content |
| 2.2 | `src/renderer/src/components/ChatWindow.tsx` | Modify timeline builder to create `ToolStepGroup` items |
| 2.3 | `src/renderer/src/components/ChatWindow.tsx` | Add conditional rendering for new vs legacy components |
| 2.4 | `src/renderer/src/contexts/SettingsContext.tsx` | Add feature flag `useEnhancedToolDisplay` (if needed) |

### Task 2.1: Step Extractor (`stepExtractor.ts`)

Create utility to parse AI messages and extract thinking/verification patterns:

```typescript
// src/renderer/src/lib/stepExtractor.ts

interface ExtractedSteps {
  thinkingSteps: Array<{ id: string; content: string }>
  verificationSteps: Array<{ id: string; content: string }>
  remainingContent: string
}

export function extractStepsFromMessage(content: string): ExtractedSteps {
  // Detect patterns like:
  // - Planning: "Let me...", "I'll start by...", "First, I'll..."
  // - Numbered steps: "1. First...", "2. Then..."  
  // - Verification: "I've verified...", "Successfully...", "The result shows..."
}

export function createToolStepsFromExecutions(
  executions: ToolExecution[],
  precedingMessage?: string,
  followingMessage?: string
): ToolStep[]
```

### Task 2.2-2.3: ChatWindow Timeline Modification

Current timeline approach (flat list):
```typescript
items.push({ type: 'tool_execution', data: exec })
```

New approach (grouped steps):
```typescript
interface TimelineItem {
  type: 'message' | 'tool_step_group' | 'pending_tool' | 'typing_indicator'
  data: Message | ToolStepGroupData | PendingToolCall | null
  isStreaming?: boolean
}
```

Group consecutive tool executions with surrounding AI context into `ToolStepGroup`.

### Important Considerations

1. **Backward Compatibility**: Keep legacy `InlineToolCall` rendering path available
2. **Streaming Support**: Handle in-progress tool executions gracefully
3. **Pending Approvals**: Ensure pending tool calls still show approval UI
4. **Performance**: Use memoization to prevent unnecessary re-renders
5. **Feature Flag**: Allow toggling between old and new display modes

### Reference Components

Review these existing files for context:
- `ChatWindow.tsx` - Main chat display with timeline building
- `InlineToolCall.tsx` - Legacy tool display (for comparison)
- `MCPProvider.tsx` - Tool execution state management
- `AgentStepTimeline.tsx` - Agent panel's step display (Phase 3 target)

## Instructions
Go into Alex Chen mode. Start with Task 2.1, then proceed sequentially. Run typecheck after completing all Phase 2 tasks. Stop and wait for instructions after Phase 2 is complete.

## Alex Chen Persona
Located at `/Users/cory.naegle/ArborChat/ARCHITECT_PERSONA.md` - Distinguished Software Architect focusing on security boundaries, type safety, and scalable patterns.

## Success Criteria
- [ ] `stepExtractor.ts` created with robust pattern matching
- [ ] `ChatWindow.tsx` builds grouped timeline items
- [ ] `ToolStepGroup` renders for tool executions
- [ ] Legacy fallback path preserved
- [ ] Feature flag (optional) allows toggling display mode
- [ ] Typecheck passes (`npm run typecheck`)
- [ ] Pending tool approvals continue to work
