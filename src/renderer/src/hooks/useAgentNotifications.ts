// src/renderer/src/hooks/useAgentNotifications.ts
// Hook to connect agent events to the notification system

import { useEffect, useRef } from 'react'
import { useAgentContext } from '../contexts/AgentContext'
import { useNotificationContext } from '../contexts/NotificationContext'
import type { Agent, AgentStatus } from '../types/agent'
import { TOAST_DURATIONS } from '../types/notification'

/**
 * Hook that monitors agent state changes and triggers appropriate notifications
 * Should be used in a component that has access to both AgentContext and NotificationContext
 */
export function useAgentNotifications() {
  const { state } = useAgentContext()
  const {
    showToast,
    sendDesktopNotification,
    preferences,
    setPendingAttentionCount
  } = useNotificationContext()

  // Track previous agent states to detect changes
  const prevAgentsRef = useRef<Record<string, Agent>>({})

  // Update pending attention count whenever agent state changes
  useEffect(() => {
    const pendingCount = Object.values(state.agents).reduce((count, agent) => {
      return count + agent.pendingApprovals.length
    }, 0)
    setPendingAttentionCount(pendingCount)
  }, [state.agents, setPendingAttentionCount])

  // Monitor agent state changes and trigger notifications
  useEffect(() => {
    const prevAgents = prevAgentsRef.current
    const currentAgents = state.agents

    // Check each agent for changes
    Object.entries(currentAgents).forEach(([id, agent]) => {
      const prevAgent = prevAgents[id]

      // New agent created
      if (!prevAgent) {
        if (preferences.events.agentStarted) {
          showToast({
            type: 'agent',
            title: `${agent.config.name} started`,
            message: 'Agent is beginning work',
            priority: 'low',
            duration: TOAST_DURATIONS.SHORT,
            agentId: id
          })
        }
        return
      }

      // Status changed
      if (prevAgent.status !== agent.status) {
        handleStatusChange(prevAgent.status, agent)
      }

      // New pending approval
      if (agent.pendingApprovals.length > prevAgent.pendingApprovals.length) {
        handleNewPendingApproval(agent)
      }
    })

    // Update ref for next comparison
    prevAgentsRef.current = { ...currentAgents }
  }, [state.agents, preferences.events, showToast, sendDesktopNotification])

  // Handle agent status changes
  function handleStatusChange(_prevStatus: AgentStatus, agent: Agent) {
    const agentName = agent.config.name

    switch (agent.status) {
      case 'completed':
        if (preferences.events.agentCompleted) {
          showToast({
            type: 'success',
            title: `${agentName} completed`,
            message: `Finished after ${agent.stepsCompleted} step${agent.stepsCompleted !== 1 ? 's' : ''}`,
            priority: 'normal',
            duration: TOAST_DURATIONS.NORMAL,
            agentId: agent.id
          })

          sendDesktopNotification({
            title: 'Agent Completed',
            body: `${agentName} finished successfully`,
            urgency: 'normal',
            agentId: agent.id
          })
        }
        break

      case 'failed':
        if (preferences.events.agentFailed) {
          showToast({
            type: 'error',
            title: `${agentName} failed`,
            message: agent.error || 'An error occurred',
            priority: 'high',
            duration: TOAST_DURATIONS.LONG,
            agentId: agent.id
          })

          sendDesktopNotification({
            title: 'Agent Failed',
            body: `${agentName}: ${agent.error || 'An error occurred'}`,
            urgency: 'critical',
            agentId: agent.id
          })
        }
        break

      case 'waiting':
        // Waiting could mean tool approval needed - handled separately
        break
    }
  }

  // Handle new pending approval
  function handleNewPendingApproval(agent: Agent) {
    if (!preferences.events.toolApprovalNeeded) return

    const agentName = agent.config.name
    const pendingCount = agent.pendingApprovals.length

    showToast({
      type: 'agent',
      title: `${agentName} needs approval`,
      message: `${pendingCount} tool${pendingCount > 1 ? 's' : ''} waiting for your decision`,
      priority: 'high',
      duration: TOAST_DURATIONS.PERSISTENT,
      dismissible: true,
      agentId: agent.id
    })

    sendDesktopNotification({
      title: 'Agent Needs Approval',
      body: `${agentName} is waiting for tool approval`,
      urgency: 'critical',
      agentId: agent.id
    })

    // Request window attention
    if (window.api?.notifications?.requestAttention) {
      window.api.notifications.requestAttention()
    }
  }

  // Listen for notification clicks from main process
  useEffect(() => {
    if (!window.api?.notifications?.onAgentClick) return

    const cleanup = window.api.notifications.onAgentClick((agentId: string) => {
      // This could be used to switch to the agent, but we'd need to expose
      // setActiveAgent and togglePanel from AgentContext
      console.log('[useAgentNotifications] Agent click from notification:', agentId)
    })

    return cleanup
  }, [])
}

export default useAgentNotifications
