# Phase 5: Tool Window Enhancement Implementation

**Project:** ArborChat (`/Users/cory.naegle/ArborChat`)  
**Persona:** Alex Chen - Distinguished Software Architect  
**Design Reference:** `/docs/designs/TOOL_WINDOW_ENHANCEMENT_DESIGN.md`

---

## Context

You are implementing Phase 5 (Tool Window Enhancements) for ArborChat. This phase transforms the tool execution display to mirror Claude Desktop's refined UX patterns with step grouping, accordion behavior, and visual hierarchy.

## Goals

1. **Step Grouping**: Group related AI thinking, tool calls, and verification steps together
2. **Accordion Behavior**: Implement exclusive expansion (opening one collapses others)
3. **Master Toggle**: Add "Hide steps" / "N steps" control for overall visibility
4. **Visual Hierarchy**: Distinct sections for Request, Response, and Thought Process
5. **Smooth Transitions**: Polished animations for state changes

---

## Implementation Phases

### Phase 5.1: Foundation Components

Create the core types and new components in `/src/renderer/src/components/mcp/`:

#### 1. Create Types (`types.ts`)

```typescript
// src/renderer/src/components/mcp/types.ts

export type ToolCallStatus = 
  | 'pending' 
  | 'approved' 
  | 'executing' 
  | 'completed' 
  | 'error' 
  | 'rejected'

export type StepType = 
  | 'thinking' 
  | 'tool_call' 
  | 'verification' 
  | 'thought_process'

export interface ToolStep {
  id: string
  type: StepType
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
  riskLevel?: 'safe' | 'moderate' | 'dangerous'
}

export interface ToolStepGroupData {
  groupId: string
  steps: ToolStep[]
  collapsed: boolean
}
```

#### 2. Create Server Icons Utility (`/src/renderer/src/lib/serverIcons.ts`)

```typescript
export const SERVER_ICONS: Record<string, { abbrev: string; color: string }> = {
  'desktop-commander': { abbrev: 'DC', color: '#10B981' },
  'github': { abbrev: 'GH', color: '#6366F1' },
  'ssh-mcp': { abbrev: 'SSH', color: '#F59E0B' },
  'memory': { abbrev: 'MEM', color: '#8B5CF6' },
}

export function getServerIcon(serverName: string): { abbrev: string; color: string } {
  return SERVER_ICONS[serverName] ?? { abbrev: '⚡', color: '#6B7280' }
}
```

#### 3. Create `ToolStepGroupContext.tsx`

Implement accordion state management:

```typescript
interface ToolStepGroupContextValue {
  expandedStepId: string | null
  toggleStep: (stepId: string) => void
  collapseAll: () => void
  isGroupVisible: boolean
  toggleGroupVisibility: () => void
  stepCount: number
}
```

---

### Phase 5.2: UI Components

#### 4. Create `StepMasterToggle.tsx`

The "Hide steps" / "N steps" header control:

```tsx
interface StepMasterToggleProps {
  stepCount: number
  isVisible: boolean
  onToggle: () => void
}
```

Visual design:
- Chevron rotates on collapse/expand
- Shows "Hide steps" when expanded, "N steps" when collapsed
- Subtle hover state

#### 5. Create `ToolStepItem.tsx`

Individual step item with:
- Bullet indicator for thinking/verification steps
- Server icon badge for tool calls (DC, GH, SSH, MEM)
- Chevron for expand/collapse state
- Hover highlight

```tsx
interface ToolStepItemProps {
  step: ToolStep
  isExpanded: boolean
  onToggleExpand: () => void
  onApprove?: (id: string, modifiedArgs?: Record<string, unknown>) => void
  onAlwaysApprove?: (id: string, toolName: string) => void
  onReject?: (id: string) => void
}
```

#### 6. Create `InlineToolCallV2.tsx`

Enhanced tool call display with Request/Response sections:

```
┌─ Request ───────────────────────────────┐
│ {                                       │
│   `command`: `cd /Users/...`,          │
│   `timeout_ms`: 30000                  │
│ }                                       │
└─────────────────────────────────────────┘
┌─ Response ──────────────────────────────┐
│ Process started with PID 80415...       │
└─────────────────────────────────────────┘
```

#### 7. Create `ThoughtProcessSection.tsx`

AI reasoning display:

```tsx
interface ThoughtProcessSectionProps {
  content: string
  bulletPoints?: string[]
  conclusion?: string
  isExpanded: boolean
  onToggleExpand: () => void
}
```

#### 8. Create `ToolStepGroup.tsx`

Container component that orchestrates all the above:

```tsx
interface ToolStepGroupProps {
  steps: ToolStep[]
  groupId: string
  isGroupVisible: boolean
  onToggleGroupVisibility: () => void
  expandedStepId: string | null
  onExpandStep: (stepId: string | null) => void
  onApprove?: (id: string, modifiedArgs?: Record<string, unknown>) => void
  onAlwaysApprove?: (id: string, toolName: string) => void
  onReject?: (id: string) => void
}
```

---

### Phase 5.3: Integration

#### 9. Update `index.ts` Barrel Exports

Add all new components to the barrel file.

#### 10. Create Step Extractor Utility (`/src/renderer/src/lib/stepExtractor.ts`)

Parse assistant messages to identify thinking steps:

```typescript
interface ExtractedSteps {
  thinkingSteps: Array<{ id: string; content: string }>
  remainingContent: string
}

export function extractStepsFromMessage(content: string): ExtractedSteps {
  // Look for planning markers, numbered steps, verification statements
}
```

#### 11. Update `ChatWindow.tsx` Timeline Building

Modify timeline logic to group steps:

```typescript
// New timeline item type
interface TimelineItem {
  type: 'message' | 'tool_step_group' | 'pending_tool' | 'typing_indicator'
  data: Message | ToolStepGroupData | PendingToolCall | null
  isStreaming?: boolean
}
```

---

### Phase 5.4: Agent Panel Integration

#### 12. Update `AgentStepTimeline.tsx`

Replace current `InlineToolCall` usage with `ToolStepGroup` for consistent UX.

---

## File Structure

```
src/renderer/src/components/mcp/
├── index.ts                    # Updated exports
├── types.ts                    # NEW: Shared types
├── InlineToolCall.tsx          # Existing (keep for fallback)
├── InlineToolCallV2.tsx        # NEW: Request/Response sections
├── ToolStepGroup.tsx           # NEW: Container with accordion
├── ToolStepGroupContext.tsx    # NEW: State management
├── ToolStepItem.tsx            # NEW: Individual step item
├── ThoughtProcessSection.tsx   # NEW: AI reasoning display
├── StepMasterToggle.tsx        # NEW: "Hide steps" / "N steps"
├── ToolApprovalCard.tsx        # Existing
├── ToolResultCard.tsx          # Existing
├── MCPProvider.tsx             # Existing
└── MemoryIndicator.tsx         # Existing

src/renderer/src/lib/
├── serverIcons.ts              # NEW: Server icon mapping
└── stepExtractor.ts            # NEW: Message parsing
```

---

## Implementation Order

1. **Phase 5.1** (Foundation):
   - Create `types.ts`
   - Create `serverIcons.ts`
   - Create `ToolStepGroupContext.tsx`
   - Run `npm run typecheck`

2. **Phase 5.2** (Components):
   - Create `StepMasterToggle.tsx`
   - Create `ToolStepItem.tsx`
   - Create `InlineToolCallV2.tsx`
   - Create `ThoughtProcessSection.tsx`
   - Create `ToolStepGroup.tsx`
   - Update `index.ts`
   - Run `npm run typecheck`

3. **Phase 5.3** (Integration):
   - Create `stepExtractor.ts`
   - Update `ChatWindow.tsx` timeline building
   - Test in chat interface
   - Run `npm run typecheck`

4. **Phase 5.4** (Agent Panel):
   - Update `AgentStepTimeline.tsx`
   - Verify consistent behavior
   - Run `npm run typecheck`

---

## Animation Specifications

### Expand/Collapse
```tsx
const expandAnimation = cn(
  'grid transition-all duration-200 ease-out',
  isExpanded 
    ? 'grid-rows-[1fr] opacity-100' 
    : 'grid-rows-[0fr] opacity-0'
)
```

### Chevron Rotation
```tsx
const chevronClasses = cn(
  'transition-transform duration-200',
  isExpanded ? 'rotate-0' : '-rotate-90'
)
```

### Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  .step-item, .tool-section {
    transition: none;
    animation: none;
  }
}
```

---

## Accessibility Requirements

1. **Keyboard Navigation**:
   - Arrow keys to navigate between steps
   - Enter/Space to toggle expansion
   - Escape to collapse current item

2. **ARIA Attributes**:
   ```tsx
   <div
     role="button"
     aria-expanded={isExpanded}
     aria-controls={`step-content-${stepId}`}
     tabIndex={0}
   >
   ```

3. **Focus Management**: Maintain focus when toggling

---

## Visual Reference

**Collapsed State:**
```
┌─────────────────────────────────────────────────┐
│ ∨ Hide steps                                    │
│ • Charted build and launch sequence...      ∨  │
│ DC start_process                            ∨  │
│ • Verified successful application launch... ∨  │
└─────────────────────────────────────────────────┘
```

**Tool Expanded State:**
```
┌─────────────────────────────────────────────────┐
│ ∨ Hide steps                                    │
│ • Charted build and launch sequence...      ∨  │
│ DC start_process                            ∧  │
│   ┌─ Request ───────────────────────────────┐  │
│   │ { "command": "cd /Users/...",          │  │
│   │   "timeout_ms": 30000 }                 │  │
│   └─────────────────────────────────────────┘  │
│   ┌─ Response ──────────────────────────────┐  │
│   │ Process started with PID 80415...       │  │
│   └─────────────────────────────────────────┘  │
│ • Verified successful application launch... ∨  │
└─────────────────────────────────────────────────┘
```

---

## Test Scenarios

1. **Master Toggle**: Click "Hide steps" → all steps collapse, shows "N steps"
2. **Accordion Behavior**: Expand tool → thinking step collapses automatically
3. **Tool Sections**: Expanded tool shows Request and Response sections
4. **Server Icons**: DC, GH, SSH, MEM badges display correctly
5. **Keyboard Nav**: Tab through steps, Enter to expand, Escape to collapse
6. **Animation**: Smooth expand/collapse with 200ms duration

---

## Commands

```bash
cd /Users/cory.naegle/ArborChat
npm run typecheck     # Verify types after each phase
npm run dev           # Test in dev server
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Visual match to Claude Desktop | >90% similarity |
| Accordion toggle responsiveness | <100ms |
| Animation smoothness | 60fps |
| TypeScript compilation | Zero errors |
| Accessibility | WCAG 2.1 AA |

---

## Notes

- Keep existing `InlineToolCall.tsx` as fallback during migration
- Feature can be toggled via a setting if needed
- Consider virtualization for very long step lists (future optimization)

---

Enter **Alex Chen mode** and begin implementation with Phase 5.1.
