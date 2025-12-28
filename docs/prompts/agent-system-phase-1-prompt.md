# Phase 1: Agent System Core Infrastructure
## ArborChat Implementation Prompt

---

**Reference Document:** [Agent System Design Specs](/docs/arbor-chat-agent-specs.md)

---

## Objective

Implement the core infrastructure for the ArborChat Agent System, enabling users to launch autonomous coding agents from chat messages. This phase focuses on foundational components: type definitions, state management, and basic UI scaffolding.

---

## Phase 1 Deliverables

By the end of this phase, users should be able to:
1. See a "Launch Agent" button next to the thread button on AI messages
2. Click the button to open an Agent Launch Modal
3. Configure basic agent settings (name, instructions, permissions)
4. Launch an agent that appears in a side panel (similar to threads)
5. Close/minimize the agent panel

---

## Implementation Tasks

### Task 1: Type Definitions
**File:** `src/renderer/src/types/agent.ts`

Create all TypeScript types as specified in Section 5.2 of the design doc:
- `AgentStatus` union type
- `AgentToolPermission` union type  
- `AgentContext` interface
- `AgentConfig` interface
- `AgentStep` interface
- `Agent` interface
- `AgentState` interface

### Task 2: Agent Context Provider
**File:** `src/renderer/src/contexts/AgentContext.tsx`

Implement the AgentContext provider as specified in Section 5.3:
- Create reducer with all action types
- Implement `AgentProvider` component
- Export `useAgentContext` hook
- Include all lifecycle methods (createAgent, startAgent, pauseAgent, etc.)
- Include all UI state methods (setActiveAgent, togglePanel)
- Include computed getters (getAgent, getActiveAgent, getPendingApprovals, getRunningAgents)

### Task 3: Agent Launch Button
**File:** `src/renderer/src/components/agents/AgentLaunchButton.tsx`

Create the launch button component as specified in Section 8.1:
- Use Lucide `Bot` icon
- Match existing message action button styling
- Accept `onLaunch` and `disabled` props

### Task 4: Agent Launch Modal
**File:** `src/renderer/src/components/agents/AgentLaunchModal.tsx`

Create the configuration modal as specified in Section 4.2:
- Agent name input
- Task instructions textarea
- Context seeding checkboxes:
  - Include current message (default: checked)
  - Include parent context (default: checked, configurable depth)
  - Include full conversation (default: unchecked)
  - Include active persona (default: checked)
- Tool permission radio buttons:
  - Standard (default)
  - Restricted
  - Autonomous
- Working directory input with folder picker
- Cancel and Launch buttons

### Task 5: Agent Panel Shell
**File:** `src/renderer/src/components/agents/AgentPanel.tsx`

Create the basic panel structure as specified in Section 8.2:
- Fixed width (480px) side panel
- Header area (placeholder for AgentHeader)
- Messages area (placeholder for AgentMessages)
- Input area (placeholder for AgentInput)
- Minimize and close functionality

### Task 6: Agent Status Badge
**File:** `src/renderer/src/components/agents/AgentStatusBadge.tsx`

Create the status indicator as specified in Section 8.4:
- Visual indicator for each status (created, running, waiting, paused, completed, failed)
- Pulsing animation for running state
- Color-coded labels

### Task 7: Barrel Exports
**File:** `src/renderer/src/components/agents/index.ts`

Create barrel exports for all agent components.

### Task 8: Integration Points

**Update `src/renderer/src/App.tsx`:**
- Wrap app with `AgentProvider`

**Update message actions (find existing component):**
- Add `AgentLaunchButton` next to thread button
- Wire up modal open state

**Update main layout:**
- Add `AgentPanel` to layout (conditionally rendered based on `isPanelOpen`)

---

## Technical Requirements

### Styling
- Use existing Tailwind CSS patterns
- Match dark theme (zinc-900, zinc-700 borders, etc.)
- Use Lucide React icons consistently
- Follow existing component patterns in the codebase

### State Management
- Use React Context + useReducer pattern (matching existing patterns)
- Generate unique IDs using existing utility or create one

### Imports to Reference
```typescript
// Existing patterns to follow
import { Message } from '../types/chat';
import { Persona } from '../types/persona';
import { useMCP } from '../hooks/useMCP';
```

---

## Verification Checklist

- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] Development server runs (`npm run dev`)
- [ ] "Launch Agent" button appears on AI messages
- [ ] Clicking button opens modal
- [ ] Modal form is functional (inputs work)
- [ ] Clicking "Launch Agent" creates agent and opens panel
- [ ] Panel can be minimized and closed
- [ ] Agent state persists while navigating the app

---

## File Structure After Phase 1

```
src/renderer/src/
├── components/
│   ├── agents/
│   │   ├── AgentLaunchButton.tsx    ✨ NEW
│   │   ├── AgentLaunchModal.tsx     ✨ NEW
│   │   ├── AgentPanel.tsx           ✨ NEW
│   │   ├── AgentStatusBadge.tsx     ✨ NEW
│   │   └── index.ts                 ✨ NEW
│   └── ...
├── contexts/
│   ├── AgentContext.tsx             ✨ NEW
│   └── ...
└── types/
    ├── agent.ts                     ✨ NEW
    └── ...
```

---

## Notes for Implementation

1. **Examine existing patterns first:** Before creating new components, look at how threads, MCP, and personas are implemented for consistent patterns.

2. **Start with types:** Get the type definitions solid first, as everything else depends on them.

3. **Stub execution logic:** In Phase 1, the agent won't actually execute. The `startAgent` function should just update status to 'running' for now.

4. **Match thread panel behavior:** The agent panel should behave similarly to the existing thread panel in terms of layout and animations.

5. **Working directory default:** Default to the project root or last used directory.

---

## Questions to Resolve During Implementation

1. Where exactly is the thread button in the current codebase? (Need to find it to place agent button)
2. Is there an existing ID generation utility?
3. What's the current modal pattern in the app?
4. How is the thread panel integrated into the layout?

---

*Estimated Time: 4-6 hours*

*After completing Phase 1, proceed to Phase 2: Agent Execution Engine*
