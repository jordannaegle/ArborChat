import { AIModel, ModelProbeResult, ProviderValidationResult, StreamParams } from './types'

/**
 * Abstract interface that all AI providers must implement
 */
export interface AIProvider {
  /**
   * Name of the provider (e.g., 'gemini', 'ollama')
   */
  readonly name: string

  /**
   * Validates that the provider is properly configured and accessible
   * @param apiKey - Optional API key for cloud providers
   * @returns Structured validation status
   */
  validateConnection(apiKey?: string): Promise<ProviderValidationResult>

  /**
   * Retrieves list of available models from this provider
   * @param apiKey - Optional API key for cloud providers
   * @returns Promise resolving to array of available models
   */
  getAvailableModels(apiKey?: string): Promise<AIModel[]>

  /**
   * Retrieves provider models that are candidates for chat generation.
   * Returned list should include model metadata but not access verification.
   */
  listCandidateModels(apiKey: string): Promise<AIModel[]>

  /**
   * Probes whether the provided model is actually usable with this token.
   */
  probeModelAccess(model: AIModel, apiKey: string): Promise<ModelProbeResult>

  /**
   * Streams a response from the AI model
   * @param params - Streaming parameters including window, messages, and model ID
   * @param apiKey - Optional API key for cloud providers
   * @returns Promise that resolves when streaming is complete
   */
  streamResponse(params: StreamParams, apiKey?: string): Promise<void>

  /**
   * Checks if this provider can handle the given model ID
   * @param modelId - The model identifier
   * @returns True if this provider handles this model
   */
  canHandleModel(modelId: string): boolean
}
