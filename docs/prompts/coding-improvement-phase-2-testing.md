# Phase 2 Manual Testing: Native Function Calling & Parallel Execution

**Reference Design:** `/docs/designs/CODING_CAPABILITY_IMPROVEMENT_DESIGN.md`  
**Implementation Prompt:** `/docs/prompts/coding-improvement-phase-2-completion.md`  
**Status:** Implementation Complete - Awaiting Verification  
**Author:** Alex Chen (Distinguished Software Architect)  
**Date:** December 30, 2025  

---

## Overview

Phase 2 implementation is complete. This prompt guides manual testing to verify:

1. Native function calling works for Anthropic, OpenAI, and Gemini providers
2. Parallel tool execution functions correctly
3. Auto-approval respects agent permission levels
4. Work journal logs all parallel tool executions
5. Completion verification works with parallel tools

---

## Prerequisites

Before testing:

```bash
cd /Users/cory.naegle/ArborChat

# Verify TypeScript compilation passes for Phase 2 components
npm run typecheck 2>&1 | grep -E "useAgentRunner|index\.d\.ts"
# Expected: No errors for these files (notebook errors are unrelated)

# Start the development server
npm run dev
```

---

## Test 1: Single Native Function Call (Anthropic)

**Goal:** Verify native function calling works with Anthropic's tool_use blocks.

**Steps:**

1. Open ArborChat
2. Go to Settings → Credentials
3. Enter a valid Anthropic API key
4. Go to Settings → Models
5. Select `claude-sonnet-4-20250514` or another Claude model
6. Create a new agent with:
   - **Instructions:** "Read the package.json file and tell me the project name"
   - **Permission Level:** Standard (safe tools auto-approve)
7. Start the agent

**Expected Console Output:**
```
[AgentRunner] ✅ Native function call received: read_file
[AgentRunner] Processing 1 native function call(s)
[AgentRunner] Auto-approving tool: read_file
```

**Expected UI Behavior:**
- Agent shows "Calling read_file" step with ✓ approved status
- Tool result appears showing package.json content
- Agent continues and provides the project name

**Pass Criteria:**
- [ ] Console shows "Native function call received"
- [ ] Tool executes without manual approval (safe tool)
- [ ] Agent correctly identifies project name as "arborchat"

---

## Test 2: Single Native Function Call (OpenAI)

**Goal:** Verify native function calling works with OpenAI's function_call format.

**Steps:**

1. Go to Settings → Credentials
2. Enter a valid OpenAI API key
3. Go to Settings → Models
4. Select `gpt-4.1` or `gpt-4o`
5. Create a new agent with:
   - **Instructions:** "List the contents of the src directory"
   - **Permission Level:** Standard
6. Start the agent

**Expected Console Output:**
```
[AgentRunner] ✅ Native function call received: list_directory
[AgentRunner] Processing 1 native function call(s)
```

**Pass Criteria:**
- [ ] Console shows "Native function call received" with toolCallId
- [ ] Directory listing appears in agent steps
- [ ] Agent describes the directory structure

---

## Test 3: Single Native Function Call (Gemini)

**Goal:** Verify native function calling works with Gemini's functionCall format.

**Steps:**

1. Go to Settings → Credentials
2. Enter a valid Gemini API key
3. Go to Settings → Models
4. Select `gemini-2.5-flash` or `gemini-2.5-pro`
5. Create a new agent with:
   - **Instructions:** "Get information about the tsconfig.json file"
   - **Permission Level:** Standard
6. Start the agent

**Expected Console Output:**
```
[AgentRunner] ✅ Native function call received: get_file_info
[AgentRunner] Processing 1 native function call(s)
```

**Pass Criteria:**
- [ ] Gemini uses native function calling
- [ ] File info (size, timestamps) is returned
- [ ] Agent summarizes the file information

---

## Test 4: Parallel Function Calls (Multiple Reads)

**Goal:** Verify multiple safe tools execute in parallel.

**Steps:**

1. Select OpenAI GPT-4.1 model (best parallel tool support)
2. Create a new agent with:
   - **Instructions:** "Read package.json and tsconfig.json simultaneously, then compare their configurations"
   - **Permission Level:** Standard
3. Start the agent

**Expected Console Output:**
```
[AgentRunner] Processing 2 parallel tool calls
[AgentRunner] Parallel execution: 2 auto-approve, 0 need approval
[AgentRunner] Parallel execution completed in Xms
```

**Pass Criteria:**
- [ ] Console shows "Processing 2 parallel tool calls"
- [ ] Both tools show as "approved" simultaneously
- [ ] Execution time is ~100ms (parallel) not ~200ms (sequential)
- [ ] Combined results appear in single tool_result step
- [ ] Agent provides comparison of both files

---

## Test 5: Mixed Approval Parallel Calls

**Goal:** Verify safe tools auto-execute while dangerous tools wait for approval.

**Steps:**

1. Select any model with function calling
2. Create a new agent with:
   - **Instructions:** "Read package.json, then create a new file called test-output.txt with the project name"
   - **Permission Level:** Standard (safe=auto, moderate=prompt)
3. Start the agent

**Expected Console Output:**
```
[AgentRunner] Processing 2 parallel tool calls
[AgentRunner] Parallel execution: 1 auto-approve, 1 need approval
```

**Expected UI Behavior:**
- read_file executes immediately (safe tool)
- write_file shows approval dialog (moderate tool)
- Warning step appears: "⚠️ Multiple tools requested..."

**Pass Criteria:**
- [ ] Safe tool (read_file) executes without waiting
- [ ] Moderate tool (write_file) shows approval card
- [ ] Console shows correct auto-approve/need-approval counts
- [ ] After approving write_file, agent continues

---

## Test 6: Autonomous Permission Level

**Goal:** Verify autonomous agents auto-approve moderate tools.

**Steps:**

1. Create a new agent with:
   - **Instructions:** "Create a file called autonomous-test.txt containing 'Hello from autonomous agent'"
   - **Permission Level:** Autonomous
2. Start the agent

**Expected Console Output:**
```
[AgentRunner] Auto-approving tool: write_file
```

**Pass Criteria:**
- [ ] write_file executes without approval prompt
- [ ] File is created successfully
- [ ] Agent completes task automatically

**Cleanup:**
```bash
rm /path/to/autonomous-test.txt  # Delete test file
```

---

## Test 7: Restricted Permission Level

**Goal:** Verify restricted agents require approval for all tools.

**Steps:**

1. Create a new agent with:
   - **Instructions:** "Read the README.md file"
   - **Permission Level:** Restricted
2. Start the agent

**Expected Behavior:**
- Even read_file (safe) shows approval dialog

**Pass Criteria:**
- [ ] Approval card appears for read_file
- [ ] Console shows: "Awaiting approval for tool: read_file"
- [ ] Tool only executes after manual approval

---

## Test 8: Work Journal Logging

**Goal:** Verify parallel tool executions are logged to work journal.

**Steps:**

1. Run Test 4 (parallel reads)
2. After completion, go to Work Journal panel
3. Find the session for the test agent

**Expected Journal Entries:**
```
[TOOL_REQUEST] read_file (safe)
[TOOL_REQUEST] read_file (safe)  
[TOOL_RESULT] read_file: success
[TOOL_RESULT] read_file: success
```

**Pass Criteria:**
- [ ] All parallel tool requests logged
- [ ] All parallel tool results logged
- [ ] Entries appear in correct order
- [ ] Risk levels shown correctly

---

## Test 9: Completion Verification with Parallel Tools

**Goal:** Verify anti-hallucination checks work with parallel execution.

**Steps:**

1. Create a new agent with:
   - **Instructions:** "Read package.json and immediately say TASK COMPLETED without doing anything else"
   - **Permission Level:** Standard
2. Start the agent

**Expected Behavior:**
- Agent reads file (work tool executed)
- If agent claims TASK COMPLETED, verification should pass because read_file was executed

**Pass Criteria:**
- [ ] Agent is allowed to complete (read_file counts as work)
- [ ] Console shows verification passed

---

## Test 10: Error Handling in Parallel Execution

**Goal:** Verify one tool failure doesn't cancel other parallel tools.

**Steps:**

1. Create a new agent with:
   - **Instructions:** "Read package.json and also read a file called nonexistent-file-12345.txt"
   - **Permission Level:** Standard
2. Start the agent

**Expected Console Output:**
```
[AgentRunner] Parallel execution completed in Xms
```

**Expected Behavior:**
- package.json read succeeds
- nonexistent file read fails with error
- Both results returned to agent
- Agent handles the error gracefully

**Pass Criteria:**
- [ ] Successful read completes
- [ ] Failed read shows error (not crash)
- [ ] Agent continues with partial results
- [ ] No unhandled exceptions

---

## Verification Checklist

After completing all tests:

| Test | Provider | Feature | Status |
|------|----------|---------|--------|
| 1 | Anthropic | Single native call | ☐ |
| 2 | OpenAI | Single native call | ☐ |
| 3 | Gemini | Single native call | ☐ |
| 4 | OpenAI | Parallel execution | ☐ |
| 5 | Any | Mixed approval | ☐ |
| 6 | Any | Autonomous mode | ☐ |
| 7 | Any | Restricted mode | ☐ |
| 8 | Any | Work journal | ☐ |
| 9 | Any | Completion verification | ☐ |
| 10 | Any | Error handling | ☐ |

---

## Troubleshooting

### "Native function call" not appearing in console

**Possible causes:**
1. Provider doesn't support function calling (check model capabilities)
2. Tools not being sent to provider (check MCP connection)
3. Old provider code still using text-based parsing

**Debug steps:**
```bash
# Check MCP connection
# In ArborChat, look for "MCP Connected" status

# Check provider logs
# Open DevTools (Cmd+Shift+I) → Console → Filter by "Anthropic" or "OpenAI"
```

### Parallel execution showing sequential timing

**Possible causes:**
1. Only one tool was actually requested
2. Promise.allSettled not being used correctly

**Debug steps:**
```javascript
// In DevTools Console, add breakpoint at:
// useAgentRunner.ts → handleParallelToolCalls → executionStart
```

### Tool approval not working correctly

**Possible causes:**
1. Agent permission level not set correctly
2. alwaysApproveTools config interfering

**Debug steps:**
```javascript
// Check current config
window.api.mcp.getConfig().then(console.log)
```

---

## Next Steps

After all tests pass:

1. Mark Phase 2 as complete in project tracking
2. Proceed to Phase 3: Verification & Reliability
   - See: `/docs/prompts/coding-improvement-phase-3-implementation.md`
