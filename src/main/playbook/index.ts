/**
 * Playbook Module
 * 
 * Agentic Memory Playbook system entry point.
 * Exports services, handlers, and types for the learning system.
 * 
 * @module main/playbook
 */

export { registerPlaybookHandlers, type PlaybookAPI } from './handlers'
export { getPlaybookService, PlaybookService } from '../services/PlaybookService'
export { getReviewAgentService, ReviewAgentService } from '../services/ReviewAgentService'
export { getCuratorService, CuratorService } from '../services/CuratorService'
export { getReflectorService, initReflectorService, ReflectorService } from '../services/ReflectorService'
