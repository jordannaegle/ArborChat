# Agentic Memory System - ArborChat Implementation

## Overview

This document describes the implementation of an autonomous learning system for ArborChat based on the ACE Framework research and Swarm Sentinel patterns. The system enables agents to learn from past execution outcomes without fine-tuning, through context engineering.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENTIC MEMORY SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌────────────┐      ┌───────────────┐      ┌──────────────────┐           │
│   │   Agent    │ ───► │  Work Journal │ ───► │  Review Agent    │           │
│   │  Session   │      │  (execution   │      │  (Sentinel)      │           │
│   │            │      │   trace)      │      │  Analyzes        │           │
│   └────────────┘      └───────────────┘      │  outcomes        │           │
│         │                                     └────────┬─────────┘           │
│         │                                              │                     │
│         │                                              ▼                     │
│         │                                     ┌──────────────────┐           │
│         │                                     │     Curator      │           │
│         │                                     │  (merge/dedup)   │           │
│         │                                     └────────┬─────────┘           │
│         │                                              │                     │
│         │                                              ▼                     │
│         │                                     ┌──────────────────┐           │
│         │                                     │    Playbook      │           │
│         │                                     │    Store         │           │
│         ▼                                     │   (SQLite)       │           │
│   ┌────────────┐                              └────────┬─────────┘           │
│   │   Next     │ ◄────────────────────────────────────┘                     │
│   │   Agent    │    (playbook injected at spawn)                            │
│   └────────────┘                                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Files Created

### Type Definitions
- `src/shared/types/playbook.ts` - Playbook entry types and interfaces
- `src/shared/types/review.ts` - Review Agent types and configuration

### Main Process Services
- `src/main/services/PlaybookService.ts` - Playbook storage and retrieval
- `src/main/services/ReviewAgentService.ts` - Automated session evaluation (Sentinel)
- `src/main/services/CuratorService.ts` - Merge reviews into playbook
- `src/main/services/ReflectorService.ts` - Orchestrates the learning loop

### IPC & Preload
- `src/main/playbook/handlers.ts` - IPC handlers for playbook operations
- `src/main/playbook/index.ts` - Module exports
- `src/preload/playbook.ts` - Preload API for renderer access

### Renderer Components
- `src/renderer/src/hooks/usePlaybook.ts` - React hook for playbook access
- `src/renderer/src/components/agent/SessionFeedback.tsx` - User feedback UI

---

## Integration Steps

### Step 1: Update Type Exports

Add to `src/shared/types/index.ts`:

```typescript
export * from './playbook'
export * from './review'
```

### Step 2: Register IPC Handlers

In `src/main/index.ts`, add the playbook handler registration:

```typescript
import { registerPlaybookHandlers } from './playbook'
import { WorkJournalManager } from './services/WorkJournalManager'

// After WorkJournalManager initialization
const workJournal = new WorkJournalManager()
workJournal.init()

// Register playbook handlers
registerPlaybookHandlers(workJournal)
```

### Step 3: Update Preload Script

In `src/preload/index.ts`, add the playbook API:

```typescript
import { playbookApi } from './playbook'

const api = {
  // ... existing APIs ...
  playbook: playbookApi
}

contextBridge.exposeInMainWorld('api', api)
```

### Step 4: Configure Review Agent with AI Provider

In your initialization code, connect the Review Agent to your AI provider:

```typescript
import { getReflectorService } from './playbook'
import { getGeminiProvider } from './providers/gemini'  // or your provider

const reflector = getReflectorService(workJournal)

// Create a simple adapter for the Review Agent
const reviewProvider = {
  generateResponse: async ({ model, systemPrompt, messages, temperature, maxTokens }) => {
    const provider = getGeminiProvider()
    // Adapt to your provider's interface
    const response = await provider.generateContent({
      model,
      systemInstruction: systemPrompt,
      contents: messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    })
    return response.text()
  }
}

reflector.setAIProvider(reviewProvider)
```

### Step 5: Trigger Reflection on Session Completion

In your agent completion handler (likely in `useAgentRunner.ts` or similar):

```typescript
import { getReflectorService } from '../../main/playbook'

// When agent session completes
const handleSessionComplete = async (sessionId: string) => {
  // ... existing completion logic ...
  
  // Schedule reflection (async, non-blocking)
  window.api.playbook.triggerReflection(sessionId).catch(console.error)
}
```

### Step 6: Inject Playbook into Agent Context

In your agent spawn logic, add playbook context:

```typescript
// In useAgentRunner.ts or similar
const buildAgentSystemPrompt = async (persona: Persona, workingDirectory?: string) => {
  // Get playbook context
  const playbookSection = await window.api.playbook.generateContext(workingDirectory, 4000)
  
  return `${persona.systemPrompt}

${playbookSection}
`
}
```

### Step 7: Add Feedback UI

In your agent panel or session completion UI:

```tsx
import { SessionFeedback } from './components/agent/SessionFeedback'

// In your agent session component
<SessionFeedback 
  sessionId={session.id}
  onFeedbackSubmitted={(rating) => {
    console.log(`User rated session as ${rating}`)
  }}
/>
```

---

## Database Schema

The system adds these tables to `arborchat.db`:

```sql
-- Playbook entries (learned strategies)
CREATE TABLE playbook_entries (
  id TEXT PRIMARY KEY,
  entry_type TEXT NOT NULL,  -- 'strategy', 'mistake', 'preference', 'codebase_context'
  content TEXT NOT NULL,
  helpful_count INTEGER DEFAULT 1,
  harmful_count INTEGER DEFAULT 0,
  scope TEXT DEFAULT 'global',  -- or 'tool:xxx', 'project:xxx'
  source_session_id TEXT,
  created_at INTEGER NOT NULL,
  last_referenced INTEGER NOT NULL
);

-- Session reviews (Sentinel output)
CREATE TABLE session_reviews (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  overall_score REAL NOT NULL,
  task_completed INTEGER NOT NULL,
  categories TEXT NOT NULL,  -- JSON
  issues TEXT NOT NULL,      -- JSON
  strengths TEXT NOT NULL,   -- JSON
  suggested_strategies TEXT NOT NULL,  -- JSON
  suggested_mistakes TEXT NOT NULL,    -- JSON
  review_duration_ms INTEGER,
  model_used TEXT
);

-- User session feedback
CREATE TABLE user_session_feedback (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  rating TEXT NOT NULL,  -- 'helpful' or 'unhelpful'
  comment TEXT,
  timestamp INTEGER NOT NULL
);
```

---

## Configuration

### Review Agent Sampling

The Review Agent doesn't review every session (cost optimization):

```typescript
const CONFIG = {
  minToolCallsForReview: 2,      // Skip trivial sessions
  samplingRate: 0.3,              // Review 30% of normal sessions
  alwaysReviewAboveDurationMs: 300000,  // Always review 5+ minute sessions
  skipSimilarRecentCount: 3       // Skip if similar work reviewed recently
}
```

### Playbook Limits

```typescript
const CONFIG = {
  MAX_ENTRY_LENGTH: 2000,         // Characters per entry
  SIMILARITY_THRESHOLD: 0.7,      // For deduplication
  PRUNE_AFTER_DAYS: 30,           // Remove unhelpful entries
  MIN_HELPFUL_TO_KEEP: 1          // Minimum score to survive pruning
}
```

---

## Security Considerations

1. **Credential Filtering**: The PlaybookService rejects entries containing patterns that look like credentials (API keys, passwords, SSH keys).

2. **Content Sanitization**: All entries are sanitized before storage.

3. **Rate Limiting**: Maximum entries per session prevents abuse.

4. **User Isolation**: Playbook is per-user (single-user Electron app).

---

## Testing

### Manual Testing Checklist

1. [ ] Seed initial playbook entries: Call `window.api.playbook.seed()`
2. [ ] Run an agent session with multiple tool calls
3. [ ] Verify work journal entries are logged
4. [ ] Check that Review Agent is triggered (console logs)
5. [ ] Verify playbook entries are created (check stats)
6. [ ] Submit user feedback and verify it affects scores
7. [ ] Run maintenance and verify pruning works

### Debug Commands (DevTools Console)

```javascript
// Check playbook stats
await window.api.playbook.getStats()

// View all entries
await window.api.playbook.getEntries({ limit: 50 })

// Get learning stats
await window.api.playbook.getLearningStats()

// Manual reflection trigger
await window.api.playbook.triggerReflection('session-id-here')

// Run maintenance
await window.api.playbook.runMaintenance()
```

---

## Future Enhancements

1. **Scoped Playbooks**: Project-specific knowledge (partially implemented via scope field)
2. **Embedding-Based Similarity**: Replace Jaccard with vector embeddings for better deduplication
3. **Playbook Export/Import**: Share learned strategies between installations
4. **A/B Testing**: Compare agent performance with/without playbook
5. **Adaptive Sampling**: Adjust review rate based on learning velocity

---

## References

- ACE Framework: https://arxiv.org/abs/2510.04618
- Manus Context Engineering: https://manus.im/blog/Context-Engineering-for-AI-Agents
- Anthropic Context Engineering: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
