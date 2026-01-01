# ArborChat Tool Window Enhancement - Phase 4 Continuation Prompt

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

### Phase 3: Agent Panel Integration ✅
- Created `agentStepAdapter.ts` with type mapping utilities
- Modified `AgentPanel.tsx` timeline builder to use `ToolStepGroup`
- Added `USE_ENHANCED_AGENT_TOOL_DISPLAY` feature flag
- Legacy `AgentStepTimeline` preserved (Option B approach)
- Pending tool approvals work correctly with callbacks
- Typecheck passes

## Current Phase: Phase 4 - Settings Integration & Polish

### Overview
This phase focuses on:
1. Moving feature flags to SettingsContext for user-configurable toggle
2. Adding UI controls in Settings panel
3. Visual polish and accessibility improvements
4. Optional: AgentStepTimeline enhancement (Option A)

### Key Files to Modify/Create

| Task | File | Description |
|------|------|-------------|
| 4.1 | `src/renderer/src/contexts/SettingsContext.tsx` | Add enhanced tool display setting |
| 4.2 | `src/renderer/src/components/settings/SettingsPanel.tsx` | Add toggle UI for setting |
| 4.3 | `src/renderer/src/components/ChatWindow.tsx` | Replace hardcoded flag with context |
| 4.4 | `src/renderer/src/components/agent/AgentPanel.tsx` | Replace hardcoded flag with context |
| 4.5 | `src/renderer/src/components/mcp/*.tsx` | Accessibility & polish (optional) |

### Task 4.1: Settings Context Enhancement

Add new setting to SettingsContext for tool display mode:

```typescript
// Add to Settings interface
interface Settings {
  // ... existing settings
  
  /** Enable Claude Desktop-style grouped tool display */
  enhancedToolDisplay: boolean
}

// Add default value
const defaultSettings: Settings = {
  // ... existing defaults
  enhancedToolDisplay: true
}
```

### Task 4.2: Settings Panel UI

Add a toggle in the appropriate settings section (likely "Appearance" or "Chat"):

```typescript
// Example toggle component
<SettingToggle
  label="Enhanced Tool Display"
  description="Group tool calls with thinking/verification steps (Claude Desktop style)"
  checked={settings.enhancedToolDisplay}
  onChange={(checked) => updateSetting('enhancedToolDisplay', checked)}
/>
```

### Task 4.3: ChatWindow Integration

Replace hardcoded flag with context value:

```typescript
// Before
const USE_ENHANCED_TOOL_DISPLAY = true

// After
import { useSettings } from '../contexts/SettingsContext'

// Inside component
const { settings } = useSettings()
const useEnhancedDisplay = settings.enhancedToolDisplay
```

### Task 4.4: AgentPanel Integration

Same pattern as ChatWindow:

```typescript
// Before
const USE_ENHANCED_AGENT_TOOL_DISPLAY = true

// After
import { useSettings } from '../../contexts/SettingsContext'

// Inside component
const { settings } = useSettings()
const useEnhancedDisplay = settings.enhancedToolDisplay
```

### Task 4.5: Accessibility & Polish (Optional)

Enhance components with:
- Keyboard navigation (Arrow keys for accordion)
- ARIA attributes for screen readers
- Focus management
- Smooth animations
- Loading states

Example accessibility additions:
```typescript
// ToolStepGroup.tsx
<div
  role="region"
  aria-label="Tool execution steps"
  aria-expanded={isGroupVisible}
>
  <button
    aria-controls={`steps-${groupId}`}
    aria-expanded={isGroupVisible}
    onKeyDown={handleKeyNavigation}
  >
    ...
  </button>
</div>
```

### Reference: Existing Settings Structure

Check current SettingsContext for:
- Settings interface definition
- Default values
- Persistence mechanism (localStorage, IPC to main process)
- How other settings are exposed to components

### Reference: Existing Settings Panel

Check SettingsPanel for:
- Section organization (Appearance, Chat, Privacy, etc.)
- Toggle component patterns used
- Styling conventions

### Important Considerations

1. **Persistence**: Settings should persist across sessions
   - Check if settings use localStorage or IPC storage
   - Ensure new setting is included in persistence

2. **Default Value**: Default to `true` (enhanced display enabled)
   - New users get the improved experience
   - Existing users can disable if preferred

3. **Reactivity**: Components should update immediately when setting changes
   - Use context subscription pattern
   - No page reload required

4. **Migration**: Handle case where setting doesn't exist
   - Provide sensible default
   - Don't break existing user configs

5. **Type Safety**: Update all relevant type definitions
   - Settings interface
   - Default settings object
   - Any serialization/deserialization logic

### Files to Reference

- `src/renderer/src/contexts/SettingsContext.tsx` - Settings context implementation
- `src/renderer/src/components/settings/SettingsPanel.tsx` - Settings UI
- `src/renderer/src/components/settings/SettingToggle.tsx` - Toggle component (if exists)
- `src/renderer/src/types/settings.ts` - Settings type definitions (if separate)

## Instructions
Go into Alex Chen mode. Start with Task 4.1 to understand current Settings structure, then proceed sequentially. Run typecheck after completing all Phase 4 tasks. Stop and wait for instructions after Phase 4 is complete.

## Alex Chen Persona
Located at `/Users/cory.naegle/ArborChat/ARCHITECT_PERSONA.md` - Distinguished Software Architect focusing on security boundaries, type safety, and scalable patterns.

## Success Criteria
- [ ] `enhancedToolDisplay` setting added to SettingsContext
- [ ] Toggle UI added to Settings panel
- [ ] ChatWindow uses setting from context
- [ ] AgentPanel uses setting from context
- [ ] Setting persists across sessions
- [ ] Components react immediately to setting changes
- [ ] Typecheck passes (`npm run typecheck`)
- [ ] No regression in tool display functionality

## Notes
- Pre-existing typecheck warnings exist in AgentLaunchModal.tsx and AgentContext.tsx (unused imports)
- These are not related to this feature and can be addressed in a separate cleanup
- Task 4.5 (Accessibility) is optional and can be deferred to Phase 5 if time-constrained
