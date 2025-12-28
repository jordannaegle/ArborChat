# Agent System Design Document
## ArborChat Autonomous Coding Agents

**Design Lead:** Alex Chen
**Date:** December 27, 2025
**Status:** Draft v1.0

---

## 1. Executive Summary

This document outlines the design for an **Autonomous Agent System** within ArborChat that enables users to launch self-contained AI agents capable of performing coding tasks independently. Agents operate in their own context windows, allowing users to continue their primary conversations while agents work in the background.

### Key Value Propositions
- **Parallel Productivity**: Work on multiple tasks simultaneously
- **Autonomous Operation**: Agents continue working without constant user attention
- **Contextual Isolation**: Each agent has focused context for its specific task
- **Seamless Integration**: Familiar UI patterns (side panel) with enhanced capabilities

---

## 2. Core Concepts

### 2.1 What is an Agent?

An **Agent** is an autonomous AI worker with:
- Its own conversation context and history
- A defined task or objective
- Access to MCP tools for code execution
- The ability to work independently until completion or intervention needed

### 2.2 Agent vs Thread

| Aspect | Thread | Agent |
|--------|--------|-------|
| Purpose | Focused discussion | Autonomous task execution |
| User Attention | Required for each response | Only when intervention needed |
| Context | Branch of main conversation | Self-contained, task-focused |
| Persistence | Conversational | Task-oriented with completion state |
| Tool Usage | Manual per-message | Autonomous with approval workflows |

---

## 3. Agent Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENT LIFECYCLE                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐     │
│   │ CREATED  │───▶│ RUNNING  │───▶│ WAITING  │───▶│ RUNNING  │     │
│   └──────────┘    └────┬─────┘    └──────────┘    └────┬─────┘     │
│        │               │               ▲                │           │
│        │               │               │                │           │
│        │               ▼               │                ▼           │
│        │          ┌──────────┐        │          ┌──────────┐      │
│        │          │  PAUSED  │────────┘          │COMPLETED │      │
│        │          └──────────┘                   └──────────┘      │
│        │               │                              ▲            │
│        │               ▼                              │            │
│        │          ┌──────────┐                        │            │
│        └─────────▶│  FAILED  │────────────────────────┘            │
│                   └──────────┘      (retry)                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1 State Definitions

| State | Description | User Action Required |
|-------|-------------|---------------------|
| `CREATED` | Agent initialized, awaiting first run | None |
| `RUNNING` | Actively processing, executing tools | None |
| `WAITING` | Needs user input or tool approval | **Yes** |
| `PAUSED` | User manually paused execution | Resume action |
| `COMPLETED` | Task finished successfully | Review results |
| `FAILED` | Error occurred, cannot continue | Investigate/Retry |

---

## 4. User Interface Design

### 4.1 Launch Point

Add an "Agent" button next to the existing thread button in the message actions:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Claude's Response Message                                          │
│  ─────────────────────────────────────────────────────────────────  │
│  Here's how we could implement that feature...                      │
│                                                                      │
│  ```typescript                                                       │
│  function implementFeature() {                                       │
│    // implementation                                                 │
│  }                                                                   │
│  ```                                                                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  💬 Reply    🧵 Thread    🤖 Launch Agent    📋 Copy        │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Agent Launch Modal

When clicking "Launch Agent", a modal appears for configuration:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        🤖 Launch Coding Agent                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Agent Name                                                          │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Feature Implementation Agent                                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Task Instructions                                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Implement the user authentication feature based on our        │  │
│  │ discussion. Create the necessary files in src/auth/,          │  │
│  │ including:                                                     │  │
│  │ - AuthProvider component                                       │  │
│  │ - useAuth hook                                                 │  │
│  │ - Login and Register forms                                     │  │
│  │                                                                │  │
│  │ Follow the existing code patterns and use TypeScript.         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Context Seeding                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ ☑ Include current message                                     │  │
│  │ ☑ Include parent context (3 messages)                         │  │
│  │ ☐ Include full conversation                                   │  │
│  │ ☑ Include active persona                                      │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Tool Permissions                                                    │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ ◉ Standard (approve dangerous operations)                     │  │
│  │ ○ Restricted (approve all file operations)                    │  │
│  │ ○ Autonomous (auto-approve safe + moderate)                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Working Directory                                                   │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ /Users/cory.naegle/ArborChat                          📁     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│         ┌─────────────┐              ┌─────────────────────┐        │
│         │   Cancel    │              │   🚀 Launch Agent   │        │
│         └─────────────┘              └─────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Agent Side Panel

The agent opens in a side panel similar to threads, but with enhanced status UI:

```
┌───────────────────────────────────────┬─────────────────────────────────────┐
│                                       │                                     │
│         MAIN CHAT WINDOW              │         AGENT PANEL                 │
│                                       │                                     │
│  ┌─────────────────────────────────┐  │  ┌─────────────────────────────────┐│
│  │ User: Can you help me implement │  │  │ 🤖 Feature Implementation Agent ││
│  │ authentication for my app?      │  │  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ││
│  └─────────────────────────────────┘  │  │                                 ││
│                                       │  │  Status: 🟢 RUNNING             ││
│  ┌─────────────────────────────────┐  │  │  Progress: Step 3 of ~8         ││
│  │ Claude: Sure! Here's how we     │  │  │  Duration: 2m 34s               ││
│  │ could approach it...            │  │  │                                 ││
│  │                                 │  │  │  ┌─────┐ ┌─────┐ ┌─────────┐   ││
│  │ [🤖 Launch Agent]               │  │  │  │ ⏸️  │ │ 🛑  │ │ Minimize│   ││
│  └─────────────────────────────────┘  │  │  └─────┘ └─────┘ └─────────┘   ││
│                                       │  │─────────────────────────────────││
│  ┌─────────────────────────────────┐  │  │                                 ││
│  │ User: Great, what about OAuth?  │  │  │  Agent: I'll start by creating ││
│  └─────────────────────────────────┘  │  │  the AuthProvider component...  ││
│                                       │  │                                 ││
│  ┌─────────────────────────────────┐  │  │  ┌─────────────────────────────┐││
│  │ Claude: OAuth integration can   │  │  │  │ 🔧 TOOL: create_file        │││
│  │ be added with...                │  │  │  │ src/auth/AuthProvider.tsx   │││
│  └─────────────────────────────────┘  │  │  │ ✅ Auto-approved (safe)     │││
│                                       │  │  └─────────────────────────────┘││
│                                       │  │                                 ││
│                                       │  │  Agent: Now implementing the    ││
│                                       │  │  useAuth hook...                ││
│                                       │  │                                 ││
│                                       │  │  ┌─────────────────────────────┐││
│                                       │  │  │ 🔧 TOOL: edit_block         │││
│                                       │  │  │ src/App.tsx                  │││
│                                       │  │  │ ⚠️ Needs Approval            │││
│                                       │  │  │                              │││
│                                       │  │  │  [Approve] [Deny] [View]    │││
│                                       │  │  └─────────────────────────────┘││
│                                       │  │                                 ││
│  ┌─────────────────────────────────┐  │  │─────────────────────────────────││
│  │ Type a message...           📤 │  │  │ 💬 Send instruction to agent... ││
│  └─────────────────────────────────┘  │  └─────────────────────────────────┘│
│                                       │                                     │
└───────────────────────────────────────┴─────────────────────────────────────┘
```

### 4.4 Agent Status Indicators

Visual indicators for agent states:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AGENT STATUS INDICATORS                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🟢 RUNNING      - Pulsing green dot, animated activity indicator   │
│  🟡 WAITING      - Amber dot, attention badge with count            │
│  ⏸️ PAUSED       - Gray dot, dimmed panel                            │
│  ✅ COMPLETED    - Green checkmark, success state                    │
│  🔴 FAILED       - Red dot, error state with details                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.5 Agent Manager (Multiple Agents)

When multiple agents are running, show an agent manager:

```
┌─────────────────────────────────────────────────────────────────────┐
│  🤖 Active Agents (3)                                        [+]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ 🟢 Feature Implementation        2m 34s     Step 3/8    [Open] ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ 🟡 Bug Fix Agent               ⚠️ 1 approval    5m 12s  [Open] ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ✅ Test Writer                   Completed      8m 45s  [View] ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.6 Notification System

Agents notify users when attention is needed:

```
┌─────────────────────────────────────────────────────────────────────┐
│                       NOTIFICATION BANNER                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ 🟡 Bug Fix Agent needs approval for: delete_file                ││
│  │    /src/deprecated/old-component.tsx                            ││
│  │                                                                  ││
│  │         [View Agent]    [Quick Approve]    [Dismiss]            ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Architecture Design

### 5.1 Component Hierarchy

```
src/renderer/src/
├── components/
│   ├── agents/
│   │   ├── AgentLaunchButton.tsx      # Button in message actions
│   │   ├── AgentLaunchModal.tsx       # Configuration modal
│   │   ├── AgentPanel.tsx             # Main agent side panel
│   │   ├── AgentHeader.tsx            # Status, controls, info
│   │   ├── AgentMessages.tsx          # Agent conversation display
│   │   ├── AgentToolCard.tsx          # Tool execution display
│   │   ├── AgentInput.tsx             # User instruction input
│   │   ├── AgentManager.tsx           # Multi-agent overview
│   │   ├── AgentNotification.tsx      # Attention notifications
│   │   ├── AgentStatusBadge.tsx       # Status indicators
│   │   └── index.ts                   # Barrel exports
│   └── ...
├── contexts/
│   └── AgentContext.tsx               # Agent state management
├── hooks/
│   ├── useAgent.ts                    # Single agent operations
│   ├── useAgentManager.ts             # Multi-agent coordination
│   └── useAgentExecution.ts           # Agent execution loop
├── services/
│   └── agentService.ts                # Agent business logic
└── types/
    └── agent.ts                       # Agent type definitions
```

### 5.2 Type Definitions

```typescript
// src/renderer/src/types/agent.ts

export type AgentStatus = 
  | 'created'
  | 'running'
  | 'waiting'
  | 'paused'
  | 'completed'
  | 'failed';

export type AgentToolPermission = 
  | 'standard'      // Approve dangerous only
  | 'restricted'    // Approve all file operations
  | 'autonomous';   // Auto-approve safe + moderate

export interface AgentContext {
  seedMessages: Message[];          // Initial context from chat
  persona?: Persona;                // Active persona if any
  workingDirectory: string;         // Base path for operations
}

export interface AgentConfig {
  name: string;
  instructions: string;
  context: AgentContext;
  toolPermission: AgentToolPermission;
  modelId: string;
}

export interface AgentStep {
  id: string;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'message';
  content: string;
  timestamp: number;
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
    status: 'pending' | 'approved' | 'denied' | 'completed' | 'failed';
    result?: unknown;
  };
}

export interface Agent {
  id: string;
  config: AgentConfig;
  status: AgentStatus;
  steps: AgentStep[];
  
  // Execution state
  currentStepIndex: number;
  pendingApprovals: string[];       // Step IDs waiting for approval
  
  // Metadata
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  
  // Source reference
  sourceConversationId: string;
  sourceMessageId: string;
}

export interface AgentState {
  agents: Record<string, Agent>;
  activeAgentId: string | null;
  isPanelOpen: boolean;
}
```

### 5.3 Agent Context Provider

```typescript
// src/renderer/src/contexts/AgentContext.tsx

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { Agent, AgentState, AgentConfig, AgentStatus, AgentStep } from '../types/agent';
import { generateId } from '../utils/id';

type AgentAction =
  | { type: 'CREATE_AGENT'; payload: AgentConfig & { sourceConversationId: string; sourceMessageId: string } }
  | { type: 'UPDATE_AGENT_STATUS'; payload: { agentId: string; status: AgentStatus } }
  | { type: 'ADD_AGENT_STEP'; payload: { agentId: string; step: AgentStep } }
  | { type: 'UPDATE_STEP'; payload: { agentId: string; stepId: string; updates: Partial<AgentStep> } }
  | { type: 'SET_ACTIVE_AGENT'; payload: string | null }
  | { type: 'TOGGLE_PANEL'; payload?: boolean }
  | { type: 'REMOVE_AGENT'; payload: string }
  | { type: 'SET_ERROR'; payload: { agentId: string; error: string } };

interface AgentContextType {
  state: AgentState;
  
  // Agent lifecycle
  createAgent: (config: AgentConfig, sourceConversationId: string, sourceMessageId: string) => string;
  startAgent: (agentId: string) => void;
  pauseAgent: (agentId: string) => void;
  resumeAgent: (agentId: string) => void;
  stopAgent: (agentId: string) => void;
  
  // Agent interaction
  sendInstruction: (agentId: string, instruction: string) => void;
  approveStep: (agentId: string, stepId: string) => void;
  denyStep: (agentId: string, stepId: string) => void;
  
  // UI state
  setActiveAgent: (agentId: string | null) => void;
  togglePanel: (open?: boolean) => void;
  
  // Computed
  getAgent: (agentId: string) => Agent | undefined;
  getActiveAgent: () => Agent | undefined;
  getPendingApprovals: () => Array<{ agent: Agent; step: AgentStep }>;
  getRunningAgents: () => Agent[];
}

const initialState: AgentState = {
  agents: {},
  activeAgentId: null,
  isPanelOpen: false,
};

function agentReducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case 'CREATE_AGENT': {
      const id = generateId();
      const newAgent: Agent = {
        id,
        config: {
          name: action.payload.name,
          instructions: action.payload.instructions,
          context: action.payload.context,
          toolPermission: action.payload.toolPermission,
          modelId: action.payload.modelId,
        },
        status: 'created',
        steps: [],
        currentStepIndex: 0,
        pendingApprovals: [],
        createdAt: Date.now(),
        sourceConversationId: action.payload.sourceConversationId,
        sourceMessageId: action.payload.sourceMessageId,
      };
      return {
        ...state,
        agents: { ...state.agents, [id]: newAgent },
        activeAgentId: id,
        isPanelOpen: true,
      };
    }
    
    case 'UPDATE_AGENT_STATUS': {
      const agent = state.agents[action.payload.agentId];
      if (!agent) return state;
      
      const updates: Partial<Agent> = { status: action.payload.status };
      if (action.payload.status === 'running' && !agent.startedAt) {
        updates.startedAt = Date.now();
      }
      if (action.payload.status === 'completed' || action.payload.status === 'failed') {
        updates.completedAt = Date.now();
      }
      
      return {
        ...state,
        agents: {
          ...state.agents,
          [action.payload.agentId]: { ...agent, ...updates },
        },
      };
    }
    
    case 'ADD_AGENT_STEP': {
      const agent = state.agents[action.payload.agentId];
      if (!agent) return state;
      
      const newPendingApprovals = action.payload.step.toolCall?.status === 'pending'
        ? [...agent.pendingApprovals, action.payload.step.id]
        : agent.pendingApprovals;
      
      return {
        ...state,
        agents: {
          ...state.agents,
          [action.payload.agentId]: {
            ...agent,
            steps: [...agent.steps, action.payload.step],
            pendingApprovals: newPendingApprovals,
          },
        },
      };
    }
    
    case 'UPDATE_STEP': {
      const agent = state.agents[action.payload.agentId];
      if (!agent) return state;
      
      const updatedSteps = agent.steps.map(step =>
        step.id === action.payload.stepId
          ? { ...step, ...action.payload.updates }
          : step
      );
      
      // Remove from pending if approved/denied
      const updatedPendingApprovals = action.payload.updates.toolCall?.status !== 'pending'
        ? agent.pendingApprovals.filter(id => id !== action.payload.stepId)
        : agent.pendingApprovals;
      
      return {
        ...state,
        agents: {
          ...state.agents,
          [action.payload.agentId]: {
            ...agent,
            steps: updatedSteps,
            pendingApprovals: updatedPendingApprovals,
          },
        },
      };
    }
    
    case 'SET_ACTIVE_AGENT':
      return { ...state, activeAgentId: action.payload };
    
    case 'TOGGLE_PANEL':
      return { 
        ...state, 
        isPanelOpen: action.payload !== undefined ? action.payload : !state.isPanelOpen 
      };
    
    case 'REMOVE_AGENT': {
      const { [action.payload]: removed, ...remainingAgents } = state.agents;
      return {
        ...state,
        agents: remainingAgents,
        activeAgentId: state.activeAgentId === action.payload ? null : state.activeAgentId,
      };
    }
    
    case 'SET_ERROR': {
      const agent = state.agents[action.payload.agentId];
      if (!agent) return state;
      return {
        ...state,
        agents: {
          ...state.agents,
          [action.payload.agentId]: {
            ...agent,
            status: 'failed',
            error: action.payload.error,
            completedAt: Date.now(),
          },
        },
      };
    }
    
    default:
      return state;
  }
}

export const AgentContext = createContext<AgentContextType | null>(null);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(agentReducer, initialState);
  
  // Implementation of context methods...
  // (Full implementation in actual code)
  
  return (
    <AgentContext.Provider value={/* context value */}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentContext() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgentContext must be used within AgentProvider');
  }
  return context;
}
```

### 5.4 Agent Execution Engine

```typescript
// src/renderer/src/hooks/useAgentExecution.ts

import { useCallback, useRef, useEffect } from 'react';
import { Agent, AgentStep, AgentToolPermission } from '../types/agent';
import { useMCP } from './useMCP';
import { useAgentContext } from '../contexts/AgentContext';
import { generateId } from '../utils/id';

interface ExecutionState {
  isExecuting: boolean;
  abortController: AbortController | null;
}

export function useAgentExecution(agentId: string) {
  const { state, dispatch } = useAgentContext();
  const { executeTool, getToolRiskLevel } = useMCP();
  const executionRef = useRef<ExecutionState>({
    isExecuting: false,
    abortController: null,
  });
  
  const agent = state.agents[agentId];
  
  const shouldAutoApprove = useCallback((
    toolName: string, 
    permission: AgentToolPermission
  ): boolean => {
    const riskLevel = getToolRiskLevel(toolName);
    
    switch (permission) {
      case 'autonomous':
        return riskLevel === 'safe' || riskLevel === 'moderate';
      case 'standard':
        return riskLevel === 'safe';
      case 'restricted':
        return false;
      default:
        return false;
    }
  }, [getToolRiskLevel]);
  
  const executeAgentLoop = useCallback(async () => {
    if (!agent || executionRef.current.isExecuting) return;
    
    executionRef.current.isExecuting = true;
    executionRef.current.abortController = new AbortController();
    
    try {
      dispatch({ 
        type: 'UPDATE_AGENT_STATUS', 
        payload: { agentId, status: 'running' } 
      });
      
      // Build conversation for AI
      const messages = buildAgentMessages(agent);
      
      while (!executionRef.current.abortController.signal.aborted) {
        // Get next AI response
        const response = await callAgentAI(messages, agent.config);
        
        // Parse response for tool calls
        const toolCalls = parseToolCalls(response);
        
        if (toolCalls.length === 0) {
          // No more tool calls, agent is thinking or complete
          const step: AgentStep = {
            id: generateId(),
            type: 'message',
            content: response,
            timestamp: Date.now(),
          };
          dispatch({ type: 'ADD_AGENT_STEP', payload: { agentId, step } });
          
          // Check if agent considers itself done
          if (isCompletionMessage(response)) {
            dispatch({ 
              type: 'UPDATE_AGENT_STATUS', 
              payload: { agentId, status: 'completed' } 
            });
            break;
          }
          
          continue;
        }
        
        // Process each tool call
        for (const toolCall of toolCalls) {
          const autoApprove = shouldAutoApprove(
            toolCall.name, 
            agent.config.toolPermission
          );
          
          const step: AgentStep = {
            id: generateId(),
            type: 'tool_call',
            content: `Executing ${toolCall.name}`,
            timestamp: Date.now(),
            toolCall: {
              name: toolCall.name,
              args: toolCall.args,
              status: autoApprove ? 'approved' : 'pending',
            },
          };
          
          dispatch({ type: 'ADD_AGENT_STEP', payload: { agentId, step } });
          
          if (!autoApprove) {
            // Wait for user approval
            dispatch({ 
              type: 'UPDATE_AGENT_STATUS', 
              payload: { agentId, status: 'waiting' } 
            });
            return; // Exit loop, will resume after approval
          }
          
          // Execute tool
          const result = await executeTool(toolCall.name, toolCall.args);
          
          dispatch({
            type: 'UPDATE_STEP',
            payload: {
              agentId,
              stepId: step.id,
              updates: {
                toolCall: {
                  ...step.toolCall!,
                  status: 'completed',
                  result,
                },
              },
            },
          });
          
          // Add result to messages for next iteration
          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            toolCallId: step.id,
          });
        }
      }
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: { 
          agentId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        },
      });
    } finally {
      executionRef.current.isExecuting = false;
    }
  }, [agent, agentId, dispatch, executeTool, shouldAutoApprove]);
  
  const pause = useCallback(() => {
    executionRef.current.abortController?.abort();
    dispatch({ 
      type: 'UPDATE_AGENT_STATUS', 
      payload: { agentId, status: 'paused' } 
    });
  }, [agentId, dispatch]);
  
  const resume = useCallback(() => {
    executeAgentLoop();
  }, [executeAgentLoop]);
  
  const stop = useCallback(() => {
    executionRef.current.abortController?.abort();
    dispatch({ 
      type: 'UPDATE_AGENT_STATUS', 
      payload: { agentId, status: 'completed' } 
    });
  }, [agentId, dispatch]);
  
  return {
    execute: executeAgentLoop,
    pause,
    resume,
    stop,
    isExecuting: executionRef.current.isExecuting,
  };
}
```

---

## 6. Data Flow

### 6.1 Agent Launch Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AGENT LAUNCH FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User clicks "Launch Agent" on a message                         │
│                    │                                                 │
│                    ▼                                                 │
│  2. AgentLaunchModal opens with context seeding options             │
│                    │                                                 │
│                    ▼                                                 │
│  3. User configures: name, instructions, permissions                │
│                    │                                                 │
│                    ▼                                                 │
│  4. createAgent() called → Agent created in 'created' state         │
│                    │                                                 │
│                    ▼                                                 │
│  5. AgentPanel opens → User clicks "Start"                          │
│                    │                                                 │
│                    ▼                                                 │
│  6. executeAgentLoop() begins → Status: 'running'                   │
│                    │                                                 │
│                    ▼                                                 │
│  7. AI generates response with tool calls                           │
│                    │                                                 │
│           ┌───────┴───────┐                                         │
│           ▼               ▼                                         │
│     Auto-approve    Needs approval                                  │
│           │               │                                         │
│           │               ▼                                         │
│           │         Status: 'waiting'                               │
│           │         Notification shown                              │
│           │               │                                         │
│           │               ▼                                         │
│           │         User approves/denies                            │
│           │               │                                         │
│           └───────┬───────┘                                         │
│                   ▼                                                 │
│  8. Tool executed → Result added to context                         │
│                   │                                                 │
│                   ▼                                                 │
│  9. Loop continues until completion or error                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 IPC Communication

```typescript
// Main process handlers for agent persistence

// src/main/handlers/agentHandlers.ts

export function registerAgentHandlers() {
  // Save agent state
  ipcMain.handle('agent:save', async (_, agent: Agent) => {
    const agentsPath = path.join(app.getPath('userData'), 'agents');
    await fs.mkdir(agentsPath, { recursive: true });
    
    const filePath = path.join(agentsPath, `${agent.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(agent, null, 2));
    
    return { success: true };
  });
  
  // Load all agents
  ipcMain.handle('agent:loadAll', async () => {
    const agentsPath = path.join(app.getPath('userData'), 'agents');
    
    try {
      const files = await fs.readdir(agentsPath);
      const agents: Agent[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(
            path.join(agentsPath, file), 
            'utf-8'
          );
          agents.push(JSON.parse(content));
        }
      }
      
      return agents;
    } catch {
      return [];
    }
  });
  
  // Delete agent
  ipcMain.handle('agent:delete', async (_, agentId: string) => {
    const filePath = path.join(
      app.getPath('userData'), 
      'agents', 
      `${agentId}.json`
    );
    
    try {
      await fs.unlink(filePath);
      return { success: true };
    } catch {
      return { success: false };
    }
  });
}
```

---

## 7. Implementation Phases

### Phase 1: Core Infrastructure (Priority: High)
**Estimated Time: 4-6 hours**

- [ ] Create type definitions (`src/renderer/src/types/agent.ts`)
- [ ] Implement AgentContext provider
- [ ] Create basic AgentPanel component
- [ ] Add AgentLaunchButton to message actions
- [ ] Implement AgentLaunchModal

**Deliverables:**
- Users can click "Launch Agent" and see a modal
- Basic agent state management works
- Agent panel opens/closes

### Phase 2: Agent Execution Engine (Priority: High)
**Estimated Time: 6-8 hours**

- [ ] Implement useAgentExecution hook
- [ ] Integrate with existing MCP tool execution
- [ ] Build auto-approval logic based on permissions
- [ ] Handle tool results and context updates
- [ ] Implement pause/resume/stop functionality

**Deliverables:**
- Agents can execute tools autonomously
- Auto-approval works based on permission level
- Users can pause and resume agents

### Phase 3: Agent UI Components (Priority: High)
**Estimated Time: 4-6 hours**

- [ ] Build AgentHeader with status and controls
- [ ] Create AgentMessages for conversation display
- [ ] Implement AgentToolCard for tool visualization
- [ ] Add AgentInput for user instructions
- [ ] Create AgentStatusBadge component

**Deliverables:**
- Full agent UI in side panel
- Real-time status updates
- Tool execution visualization

### Phase 4: Multi-Agent Management (Priority: Medium)
**Estimated Time: 3-4 hours**

- [ ] Build AgentManager component
- [ ] Implement agent switching in panel
- [ ] Add agent list to sidebar or status bar
- [ ] Handle multiple concurrent agents

**Deliverables:**
- Users can run multiple agents
- Easy switching between agents
- Overview of all agent statuses

### Phase 5: Notifications & Attention (Priority: Medium)
**Estimated Time: 2-3 hours**

- [ ] Implement AgentNotification component
- [ ] Add notification badges to UI
- [ ] Create attention sound/visual effects
- [ ] Build quick-approve from notification

**Deliverables:**
- Users notified when agents need attention
- Quick approval without opening panel
- Clear visual indicators

### Phase 6: Persistence & History (Priority: Low)
**Estimated Time: 3-4 hours**

- [ ] Implement IPC handlers for agent persistence
- [ ] Save/load agent state on app restart
- [ ] Add agent history view
- [ ] Allow rerunning completed agents

**Deliverables:**
- Agents persist across app restarts
- View history of past agents
- Rerun agents with modifications

---

## 8. UI Component Specifications

### 8.1 AgentLaunchButton

```tsx
// src/renderer/src/components/agents/AgentLaunchButton.tsx

import React from 'react';
import { Bot } from 'lucide-react';

interface AgentLaunchButtonProps {
  onLaunch: () => void;
  disabled?: boolean;
}

export function AgentLaunchButton({ onLaunch, disabled }: AgentLaunchButtonProps) {
  return (
    <button
      onClick={onLaunch}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm 
                 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 
                 rounded-md transition-colors disabled:opacity-50 
                 disabled:cursor-not-allowed"
      title="Launch Agent"
    >
      <Bot className="w-4 h-4" />
      <span>Launch Agent</span>
    </button>
  );
}
```

### 8.2 AgentPanel

```tsx
// src/renderer/src/components/agents/AgentPanel.tsx

import React from 'react';
import { X, Pause, Play, Square, Minimize2 } from 'lucide-react';
import { useAgentContext } from '../../contexts/AgentContext';
import { useAgentExecution } from '../../hooks/useAgentExecution';
import { AgentHeader } from './AgentHeader';
import { AgentMessages } from './AgentMessages';
import { AgentInput } from './AgentInput';

export function AgentPanel() {
  const { state, togglePanel, getActiveAgent } = useAgentContext();
  const agent = getActiveAgent();
  
  if (!state.isPanelOpen || !agent) return null;
  
  const { execute, pause, resume, stop } = useAgentExecution(agent.id);
  
  return (
    <div className="w-[480px] h-full border-l border-zinc-700 
                    bg-zinc-900 flex flex-col">
      {/* Header */}
      <AgentHeader
        agent={agent}
        onPause={pause}
        onResume={resume}
        onStop={stop}
        onMinimize={() => togglePanel(false)}
        onClose={() => {/* Remove agent */}}
      />
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <AgentMessages agent={agent} />
      </div>
      
      {/* Input */}
      <AgentInput 
        agentId={agent.id}
        disabled={agent.status === 'completed' || agent.status === 'failed'}
      />
    </div>
  );
}
```

### 8.3 AgentHeader

```tsx
// src/renderer/src/components/agents/AgentHeader.tsx

import React from 'react';
import { 
  Bot, X, Pause, Play, Square, Minimize2, 
  Clock, AlertCircle, CheckCircle 
} from 'lucide-react';
import { Agent, AgentStatus } from '../../types/agent';
import { AgentStatusBadge } from './AgentStatusBadge';
import { formatDuration } from '../../utils/time';

interface AgentHeaderProps {
  agent: Agent;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export function AgentHeader({ 
  agent, 
  onPause, 
  onResume, 
  onStop, 
  onMinimize,
  onClose 
}: AgentHeaderProps) {
  const duration = agent.startedAt 
    ? (agent.completedAt || Date.now()) - agent.startedAt
    : 0;
  
  return (
    <div className="p-4 border-b border-zinc-700">
      {/* Title row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-400" />
          <h2 className="font-medium text-zinc-100 truncate max-w-[280px]">
            {agent.config.name}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 
                       hover:bg-zinc-700 rounded"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 
                       hover:bg-zinc-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AgentStatusBadge status={agent.status} />
          {agent.pendingApprovals.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <AlertCircle className="w-3 h-3" />
              {agent.pendingApprovals.length} pending
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Clock className="w-3 h-3" />
          {formatDuration(duration)}
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center gap-2 mt-3">
        {agent.status === 'running' && (
          <button
            onClick={onPause}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm
                       bg-zinc-700 hover:bg-zinc-600 text-zinc-200 
                       rounded transition-colors"
          >
            <Pause className="w-3.5 h-3.5" />
            Pause
          </button>
        )}
        
        {agent.status === 'paused' && (
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm
                       bg-blue-600 hover:bg-blue-500 text-white 
                       rounded transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Resume
          </button>
        )}
        
        {(agent.status === 'running' || agent.status === 'paused') && (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm
                       bg-zinc-700 hover:bg-red-600/20 text-zinc-400 
                       hover:text-red-400 rounded transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        )}
        
        {agent.status === 'created' && (
          <button
            onClick={onResume}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm
                       bg-green-600 hover:bg-green-500 text-white 
                       rounded transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Start Agent
          </button>
        )}
      </div>
    </div>
  );
}
```

### 8.4 AgentStatusBadge

```tsx
// src/renderer/src/components/agents/AgentStatusBadge.tsx

import React from 'react';
import { AgentStatus } from '../../types/agent';
import { cn } from '../../utils/cn';

interface AgentStatusBadgeProps {
  status: AgentStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<AgentStatus, { 
  label: string; 
  color: string; 
  bgColor: string;
  pulse?: boolean;
}> = {
  created: { 
    label: 'Ready', 
    color: 'text-zinc-400', 
    bgColor: 'bg-zinc-500' 
  },
  running: { 
    label: 'Running', 
    color: 'text-green-400', 
    bgColor: 'bg-green-500',
    pulse: true 
  },
  waiting: { 
    label: 'Waiting', 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-500' 
  },
  paused: { 
    label: 'Paused', 
    color: 'text-zinc-400', 
    bgColor: 'bg-zinc-500' 
  },
  completed: { 
    label: 'Completed', 
    color: 'text-green-400', 
    bgColor: 'bg-green-500' 
  },
  failed: { 
    label: 'Failed', 
    color: 'text-red-400', 
    bgColor: 'bg-red-500' 
  },
};

export function AgentStatusBadge({ status, size = 'md' }: AgentStatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <div className={cn(
      "flex items-center gap-1.5",
      size === 'sm' ? 'text-xs' : 'text-sm'
    )}>
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            config.bgColor
          )} />
        )}
        <span className={cn(
          "relative inline-flex rounded-full h-2 w-2",
          config.bgColor
        )} />
      </span>
      <span className={config.color}>{config.label}</span>
    </div>
  );
}
```

---

## 9. Security Considerations

### 9.1 Permission Levels

| Level | Safe Tools | Moderate Tools | Dangerous Tools |
|-------|------------|----------------|-----------------|
| Restricted | Require Approval | Require Approval | Require Approval |
| Standard | Auto-approve | Require Approval | Require Approval |
| Autonomous | Auto-approve | Auto-approve | Require Approval |

### 9.2 Safety Rails

1. **No Full Autonomous Mode**: Dangerous operations always require approval
2. **Audit Trail**: All agent actions are logged with timestamps
3. **Kill Switch**: Users can always stop agents immediately
4. **Scope Limitation**: Agents can only access tools enabled in MCP
5. **Working Directory Constraint**: File operations scoped to working directory

### 9.3 Rate Limiting

- Maximum 10 tool calls per minute per agent
- Maximum 5 concurrent agents per user
- Automatic pause after 100 tool calls (require user acknowledgment)

---

## 10. Future Enhancements

### 10.1 Potential Features (Post-MVP)

- **Agent Templates**: Pre-configured agents for common tasks
- **Agent Sharing**: Export/import agent configurations
- **Collaborative Agents**: Multiple agents working together
- **Agent Memory**: Persistent knowledge across sessions
- **Cost Tracking**: Monitor token usage per agent
- **Scheduled Agents**: Run agents on a schedule
- **Agent Webhooks**: Trigger agents from external events

### 10.2 Integration Opportunities

- **GitHub Integration**: Create PRs from agent output
- **CI/CD Triggers**: Run agents on code changes
- **Slack Notifications**: Agent status updates to Slack
- **VS Code Extension**: Launch agents from IDE

---

## 11. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Agent Launch Rate | >20% of power users | Analytics |
| Task Completion | >80% of started agents | Agent status tracking |
| User Intervention | <3 approvals per task | Approval count |
| Performance | <2s response time | Timing metrics |
| Error Rate | <5% of agents fail | Error tracking |

---

## 12. Open Questions

1. **Context Size**: How much context should agents receive? Token limits?
2. **Model Selection**: Should agents use the same model as main chat?
3. **Cost Visibility**: How to show users the cost of agent operations?
4. **Concurrency**: How many agents can run simultaneously?
5. **Timeout Behavior**: What happens if an agent runs for hours?

---

*This design document should be reviewed and refined during implementation. Each phase should include verification against these specifications.*

---

**Next Steps:**
1. Review and approve design
2. Begin Phase 1 implementation
3. Set up tracking for success metrics
