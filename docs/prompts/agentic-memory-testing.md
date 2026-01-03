# Agentic Memory System - End-to-End Testing Prompt

## Session Context

You are testing the completed Agentic Memory System for ArborChat. All implementation is complete and TypeScript compiles cleanly. This session focuses on verifying the system works end-to-end.

## System Overview

The Agentic Memory System enables autonomous learning from agent execution outcomes:

```
Agent Session → Work Journal → Review Agent (Sentinel)
                                      ↓
                               Curator Service
                                      ↓
                               Playbook Store (SQLite)
                                      ↓
                              Next Agent Spawn
                           (playbook injected)
```

## Pre-Testing Setup

### 1. Start the Development Server

```bash
cd /Users/cory.naegle/ArborChat
npm run dev
```

### 2. Verify Clean Build

Confirm no TypeScript errors:
```bash
npm run typecheck
```

Expected: Both `typecheck:node` and `typecheck:web` pass with no errors.

---

## Testing Checklist

### Phase 1: Database & Service Initialization

**Test 1.1: Verify Tables Exist**

```bash
sqlite3 ~/Library/Application\ Support/ArborChat/arborchat.db ".tables"
```

Expected output should include:
- `playbook_entries`
- `session_reviews`
- `user_session_feedback`

If tables are missing, they should be created on first app launch. Restart the app if needed.

**Test 1.2: Check Initial State (DevTools Console)**

Open ArborChat, press `Cmd+Option+I` to open DevTools, then run:

```javascript
// Should return stats (may be zeros initially)
await window.api.playbook.getStats()
```

Expected:
```javascript
{
  totalEntries: 0,
  strategiesCount: 0,
  mistakesCount: 0,
  preferencesCount: 0,
  codebaseContextCount: 0,
  avgHelpfulScore: 0,
  lastUpdated: <timestamp>
}
```

---

### Phase 2: Seed Initial Playbook Entries

**Test 2.1: Seed the Playbook**

```javascript
await window.api.playbook.seed()
```

This should create initial strategy and mistake entries based on ArborChat best practices.

**Test 2.2: Verify Seeding Worked**

```javascript
const stats = await window.api.playbook.getStats()
console.log('Total entries:', stats.totalEntries)
console.log('Strategies:', stats.strategiesCount)
console.log('Mistakes:', stats.mistakesCount)
```

Expected: `totalEntries` > 0, with a mix of strategies and mistakes.

**Test 2.3: View Seeded Entries**

```javascript
const entries = await window.api.playbook.getEntries({ limit: 10 })
entries.forEach(e => console.log(`[${e.entryType}] ${e.content.substring(0, 80)}...`))
```

---

### Phase 3: Playbook Context Generation

**Test 3.1: Generate Context for Injection**

```javascript
const context = await window.api.playbook.generateContext(undefined, 2000)
console.log('Context length:', context.length)
console.log(context)
```

Expected: A formatted string with sections like:
```
## Learned Strategies
- Strategy 1
- Strategy 2

## Mistakes to Avoid
- Mistake 1
```

**Test 3.2: Generate Project-Scoped Context**

```javascript
const projectContext = await window.api.playbook.generateContext('/Users/cory.naegle/ArborChat', 2000)
console.log(projectContext)
```

Should include any project-specific entries (may be empty initially).

---

### Phase 4: Agent Session with Playbook Injection

**Test 4.1: Spawn an Agent and Verify Playbook Injection**

1. Open the Agent panel in ArborChat
2. Set a working directory (e.g., `/Users/cory.naegle/ArborChat`)
3. Create a new agent with a task like: "List the files in the src directory and describe the project structure"
4. Watch the console for these log messages:

```
[AgentContext] Fetching playbook context...
[AgentContext] Playbook context loaded, length: XXX
```

**Test 4.2: Verify Agent Uses Tools**

The agent should execute at least 2 tool calls (e.g., `list_directory`, `read_file`). This is required for the Review Agent to trigger.

Watch console for work journal entries:
```
[WorkJournal] Logged entry: tool_call
[WorkJournal] Logged entry: tool_result
```

---

### Phase 5: Review Agent (Sentinel) Trigger

**Test 5.1: Complete the Agent Session**

Let the agent complete its task naturally, or manually complete it.

**Test 5.2: Verify Review Agent Triggers**

Watch console for:
```
[ReflectorService] Starting reflection for session: <session-id>
[ReviewAgentService] Evaluating session...
[ReviewAgentService] Review complete, score: X.XX
[CuratorService] Processing review...
[CuratorService] Created X new playbook entries
```

Note: Review Agent only triggers for sessions with 2+ tool calls. It also samples at 30% rate for normal sessions (always reviews 5+ minute sessions).

**Test 5.3: Check Learning Stats**

```javascript
const learningStats = await window.api.playbook.getLearningStats()
console.log(learningStats)
```

Expected:
```javascript
{
  totalSessionsReviewed: 1,
  totalEntriesCreated: X,
  avgSessionScore: 0.XX,
  reviewsToday: 1,
  lastReviewTimestamp: <timestamp>
}
```

---

### Phase 6: User Feedback Integration

**Test 6.1: Submit Feedback via API**

```javascript
// Get a recent session ID from work journal
const sessions = await window.api.workJournal.getResumableSessions(5)
const sessionId = sessions[0]?.id

if (sessionId) {
  await window.api.playbook.submitFeedback(sessionId, 'helpful', 'Agent did great!')
  console.log('Feedback submitted')
}
```

**Test 6.2: Verify Feedback Stored**

```bash
sqlite3 ~/Library/Application\ Support/ArborChat/arborchat.db \
  "SELECT * FROM user_session_feedback ORDER BY timestamp DESC LIMIT 5;"
```

**Test 6.3: Test SessionFeedback Component (if integrated in UI)**

If the SessionFeedback component is rendered after agent completion, test clicking the thumbs up/down buttons.

---

### Phase 7: Entry Scoring & Maintenance

**Test 7.1: Update Entry Score**

```javascript
const entries = await window.api.playbook.getEntries({ limit: 1 })
if (entries.length > 0) {
  const entry = entries[0]
  console.log('Before:', entry.helpfulCount, entry.harmfulCount)
  
  await window.api.playbook.updateScore(entry.id, true)  // Mark helpful
  
  const updated = await window.api.playbook.getEntries({ limit: 1 })
  console.log('After:', updated[0].helpfulCount, updated[0].harmfulCount)
}
```

**Test 7.2: Run Maintenance (Prune Stale Entries)**

```javascript
await window.api.playbook.runMaintenance()
```

This prunes entries older than 30 days with low helpful scores.

---

### Phase 8: Full Cycle Verification

**Test 8.1: Run Multiple Agent Sessions**

1. Run 3-5 agent sessions with different tasks
2. Verify playbook grows with new strategies/mistakes
3. Check that subsequent agents receive the updated playbook context

**Test 8.2: Verify Deduplication**

The system should not create duplicate entries. Run a similar task twice and verify no duplicates:

```javascript
const entries = await window.api.playbook.getEntries({ limit: 50 })
const contents = entries.map(e => e.content)
const uniqueContents = [...new Set(contents)]
console.log('Total:', contents.length, 'Unique:', uniqueContents.length)
```

---

## Troubleshooting

### Issue: Tables Don't Exist

```bash
# Check if database exists
ls -la ~/Library/Application\ Support/ArborChat/arborchat.db

# If missing, restart app to trigger initialization
```

### Issue: Review Agent Not Triggering

1. Ensure session had 2+ tool calls
2. Check sampling rate (30%) - may need multiple sessions
3. Verify AI provider credentials are configured (Gemini required)

```javascript
// Check if Gemini is configured
await window.api.credentials.hasKey('gemini')
```

### Issue: Playbook Context Empty

```javascript
// Check if entries exist
const stats = await window.api.playbook.getStats()
console.log(stats)

// If empty, seed first
await window.api.playbook.seed()
```

### Issue: TypeScript Errors

```bash
cd /Users/cory.naegle/ArborChat
npm run typecheck
```

If errors appear, check `src/preload/index.d.ts` for Playbook type definitions.

---

## Database Inspection Commands

```bash
# View all playbook entries
sqlite3 ~/Library/Application\ Support/ArborChat/arborchat.db \
  "SELECT id, entry_type, substr(content, 1, 50), helpful_count, harmful_count FROM playbook_entries;"

# View session reviews
sqlite3 ~/Library/Application\ Support/ArborChat/arborchat.db \
  "SELECT id, session_id, overall_score, task_completed FROM session_reviews ORDER BY timestamp DESC LIMIT 10;"

# View user feedback
sqlite3 ~/Library/Application\ Support/ArborChat/arborchat.db \
  "SELECT * FROM user_session_feedback;"

# Count entries by type
sqlite3 ~/Library/Application\ Support/ArborChat/arborchat.db \
  "SELECT entry_type, COUNT(*) FROM playbook_entries GROUP BY entry_type;"
```

---

## Success Criteria

The Agentic Memory System is working correctly if:

- [ ] Playbook tables exist in database
- [ ] `seed()` creates initial entries
- [ ] `generateContext()` returns formatted playbook text
- [ ] Agent spawn logs show playbook context injection
- [ ] Review Agent triggers after qualifying sessions
- [ ] New entries appear in playbook after reviews
- [ ] User feedback updates entry scores
- [ ] Maintenance prunes stale entries
- [ ] Deduplication prevents duplicates
- [ ] Subsequent agents receive updated playbook

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/main/services/PlaybookService.ts` | Core playbook storage |
| `src/main/services/ReviewAgentService.ts` | Sentinel evaluation |
| `src/main/services/CuratorService.ts` | Review → Entry conversion |
| `src/main/services/ReflectorService.ts` | Learning loop orchestration |
| `src/main/services/ReviewAgentAdapter.ts` | AI provider bridge |
| `src/main/playbook/handlers.ts` | IPC handlers |
| `src/preload/playbook.ts` | Renderer API |
| `src/preload/index.d.ts` | Type declarations |
| `src/renderer/src/hooks/usePlaybook.ts` | React hook |
| `src/renderer/src/contexts/AgentContext.tsx` | Playbook injection (line ~670) |

---

## RAG Query for Debugging

```bash
ssh -i ~/.ssh/swarm_key root@134.199.235.140 "curl -s -X POST http://localhost:8082/api/rag/search -H 'Content-Type: application/json' -d '{\"query\": \"YOUR_QUERY\", \"repository\": \"ArborChat\", \"top_k\": 10}'"
```

Useful queries:
- `"PlaybookService addEntry deduplication"`
- `"ReviewAgentService evaluate session"`
- `"ReflectorService triggerReflection"`
- `"AgentContext playbook generateContext"`
