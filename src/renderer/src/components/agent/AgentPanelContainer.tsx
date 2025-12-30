// src/renderer/src/components/agent/AgentPanelContainer.tsx
// Container component that wires AgentPanel to useAgentRunner
// Author: Alex Chen (Distinguished Software Architect)

import { useEffect, useCallback } from 'react'
import { useAgentContext } from '../../contexts/AgentContext'
import { useAgentRunner } from '../../hooks'
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
    canRetry
  } = useAgentRunner(agentId)

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
      onRetry={handleRetry}
      canRetry={canRetry}
      isRetrying={runnerState.isRetrying}
      onClose={handleClose}
      onMinimize={onMinimize}
      onToolApprove={handleToolApprove}
      onToolAlwaysApprove={handleToolAlwaysApprove}
      onToolReject={handleToolReject}
    />
  )
}

export default AgentPanelContainer
