// src/renderer/src/components/agent/AgentPanelContainer.tsx
// Container component that wires AgentPanel to useAgentRunner
// Author: Alex Chen (Distinguished Software Architect)
// Phase 2: Added watchdog integration for stall detection

import { useEffect, useCallback, useState } from 'react'
import { useAgentContext } from '../../contexts/AgentContext'
import { useAgentRunner, useAgentWatchdog } from '../../hooks'
import type { WatchdogActivityState } from '../../hooks'
import { AgentPanel } from './AgentPanel'

interface AgentPanelContainerProps {
  agentId: string
  selectedModel: string
  onModelChange: (modelId: string) => void
  onClose: () => void
  onMinimize: () => void
}

export function AgentPanelContainer({
  agentId,
  selectedModel,
  onModelChange,
  onClose,
  onMinimize
}: AgentPanelContainerProps) {
  const { getAgent } = useAgentContext()
  const agent = getAgent(agentId)
  
  // Track stall warnings for UI notifications
  const [_stallWarningCount, setStallWarningCount] = useState(0)

  const {
    state: runnerState,
    start,
    pause,
    resume,
    stop,
    retry,
    sendMessage,
    approveTool,
    rejectTool,
    canRetry,
    // Phase 2: Stall recovery actions
    forceRetry,
    killCurrentTool
  } = useAgentRunner(agentId)

  // Phase 2: Convert execution state to watchdog-compatible format
  const watchdogActivity: WatchdogActivityState | null = runnerState.execution
    ? {
        phase: runnerState.execution.phase,
        currentActivity: runnerState.execution.currentActivity,
        activityStartedAt: runnerState.execution.activityStartedAt,
        lastProgressAt: runnerState.execution.lastProgressAt,
        currentToolName: runnerState.execution.currentToolName,
        currentToolDuration: runnerState.execution.currentToolDuration
      }
    : null

  // Phase 2: Watchdog hook for stall detection
  const watchdogState = useAgentWatchdog(
    agentId,
    watchdogActivity,
    {
      onWarnThresholdExceeded: () => {
        console.log(`[AgentPanelContainer] Stall warning for agent ${agentId}`)
        setStallWarningCount(prev => prev + 1)
      },
      onStallDetected: () => {
        console.log(`[AgentPanelContainer] Stall detected for agent ${agentId}`)
        // Could trigger a notification here
      },
      onToolTimeoutImminent: () => {
        console.log(`[AgentPanelContainer] Tool timeout imminent for agent ${agentId}`)
      },
      onActivityResumed: () => {
        console.log(`[AgentPanelContainer] Activity resumed for agent ${agentId}`)
        setStallWarningCount(0)
      }
    }
  )

  // Auto-start agent when first created
  useEffect(() => {
    if (agent?.status === 'created') {
      console.log('[AgentPanelContainer] Auto-starting agent:', agentId)
      start()
    }
  }, [agent?.status, agentId, start])

  // Handle pause
  const handlePause = useCallback(() => {
    pause()
  }, [pause])

  // Handle resume
  const handleResume = useCallback(() => {
    if (agent?.status === 'paused') {
      resume()
    } else if (agent?.status === 'created') {
      start()
    } else if (agent?.status === 'waiting' && !agent.pendingToolCall) {
      // Agent waiting for user input but no tool pending - continue
      resume()
    }
  }, [agent?.status, agent?.pendingToolCall, resume, start])

  // Handle stop - terminates agent execution immediately
  const handleStop = useCallback(() => {
    console.log('[AgentPanelContainer] Stopping agent:', agentId)
    stop()
  }, [agentId, stop])

  // Handle tool approval
  const handleToolApprove = useCallback(
    async (id: string, modifiedArgs?: Record<string, unknown>) => {
      console.log('[AgentPanelContainer] Tool approved:', id)
      await approveTool(modifiedArgs)
    },
    [approveTool]
  )

  // Handle "always approve" - for agents, this just approves the current tool
  // TODO: Could add persistent auto-approval settings per tool in agent config
  const handleToolAlwaysApprove = useCallback(
    async (id: string, toolName: string, modifiedArgs?: Record<string, unknown>) => {
      console.log('[AgentPanelContainer] Tool always-approved:', id, toolName)
      await approveTool(modifiedArgs)
    },
    [approveTool]
  )

  // Handle tool rejection
  const handleToolReject = useCallback(
    (id: string) => {
      console.log('[AgentPanelContainer] Tool rejected:', id)
      rejectTool()
    },
    [rejectTool]
  )

  // Handle retry failed agent
  const handleRetry = useCallback(async () => {
    if (canRetry) {
      console.log('[AgentPanelContainer] Retrying agent:', agentId)
      await retry()
    }
  }, [canRetry, agentId, retry])

  // Phase 2: Handle force retry for stall recovery
  const handleForceRetry = useCallback(async () => {
    console.log('[AgentPanelContainer] Force retry agent:', agentId)
    await forceRetry()
  }, [agentId, forceRetry])

  // Phase 2: Handle kill current tool
  const handleKillTool = useCallback(() => {
    console.log('[AgentPanelContainer] Killing current tool for agent:', agentId)
    killCurrentTool()
  }, [agentId, killCurrentTool])

  // Handle close with cleanup
  const handleClose = useCallback(() => {
    if (runnerState.isRunning) {
      stop()
    }
    onClose()
  }, [runnerState.isRunning, stop, onClose])

  // Handle send message
  const handleSendMessage = useCallback(
    async (content: string) => {
      await sendMessage(content)
    },
    [sendMessage]
  )

  if (!agent) {
    return null
  }

  return (
    <AgentPanel
      agent={agent}
      isStreaming={runnerState.isStreaming}
      streamingContent={runnerState.streamingContent}
      selectedModel={selectedModel}
      onModelChange={onModelChange}
      onSendMessage={handleSendMessage}
      onPause={handlePause}
      onResume={handleResume}
      onStop={handleStop}
      onRetry={handleRetry}
      canRetry={canRetry}
      isRetrying={runnerState.isRetrying}
      onClose={handleClose}
      onMinimize={onMinimize}
      onToolApprove={handleToolApprove}
      onToolAlwaysApprove={handleToolAlwaysApprove}
      onToolReject={handleToolReject}
      // Phase 2: Execution monitoring props
      execution={runnerState.execution}
      tokens={runnerState.tokens}
      diagnostics={runnerState.diagnostics}
      watchdogState={watchdogState}
      onForceRetry={handleForceRetry}
      onKillTool={handleKillTool}
    />
  )
}

export default AgentPanelContainer
