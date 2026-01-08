/**
 * Services Module - Barrel Export
 * 
 * Re-exports all main process services for centralized access.
 */

export { workJournalManager, WorkJournalManager } from './WorkJournalManager';
export { summarizationService, SummarizationService } from './SummarizationService';
export type { SummarizationOptions, SummarizationResult, SummarizationConfig } from './SummarizationService';
export * from './GitService';
export { ArborMemoryService } from './ArborMemoryService';
export { MemoryScheduler, getMemoryScheduler, resetMemoryScheduler } from './MemoryScheduler';
export type { DecayResult, SchedulerStatus } from './MemoryScheduler';
export { 
  TokenizerService, 
  tokenizer, 
  countTokens, 
  countTokensSync, 
  truncateToTokens 
} from './TokenizerService';
export type { TokenizerEncoding, TokenCountResult, TokenCountOptions } from './TokenizerService';

// Agentic Memory System Services
export { PlaybookService, getPlaybookService } from './PlaybookService';
export { ReviewAgentService, getReviewAgentService } from './ReviewAgentService';
export { CuratorService, getCuratorService } from './CuratorService';
export type { CurationResult, MaintenanceResult } from './CuratorService';
export { ReflectorService, getReflectorService, initReflectorService } from './ReflectorService';
export { GeminiReviewAdapter, getReviewAgentAdapter } from './ReviewAgentAdapter';
export type { AIProviderInterface } from './ReviewAgentAdapter';
