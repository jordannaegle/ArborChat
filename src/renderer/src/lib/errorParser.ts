/**
 * Error parsing utilities for AI provider errors
 */

export interface ParsedError {
  type: 'rate_limit' | 'billing_required' | 'quota_exceeded' | 'auth_error' | 'generic'
  provider: 'gemini' | 'anthropic' | 'ollama' | 'unknown'
  userMessage: string
  suggestedModels?: string[]
  actionRequired?: string
  technicalDetails?: string
}

/**
 * Parse Gemini API error messages and provide user-friendly responses
 */
export function parseAIError(errorMessage: string, currentModel: string): ParsedError {
  const lowerError = errorMessage.toLowerCase()

  // Detect provider
  let provider: ParsedError['provider'] = 'unknown'
  if (lowerError.includes('gemini') || lowerError.includes('generativelanguage')) {
    provider = 'gemini'
  } else if (lowerError.includes('anthropic') || lowerError.includes('claude')) {
    provider = 'anthropic'
  } else if (lowerError.includes('ollama')) {
    provider = 'ollama'
  }

  // Check for 429 rate limit errors
  if (lowerError.includes('429') || lowerError.includes('rate limit') || lowerError.includes('quota')) {
    // Check for limit: 0 (billing account issue)
    if (lowerError.includes('limit: 0') || lowerError.includes('limit:0')) {
      return {
        type: 'billing_required',
        provider,
        userMessage: `🔴 **Billing Account Required**

Google requires a billing account to be enabled for the Gemini API, even for free tier access.

**What to do:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable billing for your project (you won't be charged for free tier usage)
3. Generate a new API key at [Google AI Studio](https://aistudio.google.com/app/apikey)
4. Update your API key in Settings

**Alternative:** Switch to a local Ollama model for unlimited free usage.`,
        suggestedModels: ['ollama'],
        actionRequired: 'Enable billing account in Google Cloud Console',
        technicalDetails: errorMessage
      }
    }

    // General rate limit error
    const modelSuggestions: string[] = []
    
    if (provider === 'gemini') {
      // Suggest switching to Flash Lite (highest free tier quota)
      if (!currentModel.includes('flash-lite')) {
        modelSuggestions.push('gemini-2.5-flash-lite')
      }
      // Always suggest Ollama as fallback
      modelSuggestions.push('ollama')
    }

    // Extract retry time if available
    let retryMessage = ''
    const retryMatch = errorMessage.match(/retry in ([\d.]+)s/)
    if (retryMatch) {
      const seconds = Math.ceil(parseFloat(retryMatch[1]))
      retryMessage = `\n\n⏱️ You can retry in ${seconds} seconds.`
    }

    // Check which quota was exceeded
    let quotaType = 'requests'
    if (lowerError.includes('input_token')) {
      quotaType = 'input tokens'
    } else if (lowerError.includes('output_token')) {
      quotaType = 'output tokens'
    }

    return {
      type: 'rate_limit',
      provider,
      userMessage: `⚠️ **Rate Limit Exceeded**

You've exceeded your ${quotaType} quota for **${currentModel}**.${retryMessage}

**Suggestions:**
${modelSuggestions.length > 0 ? modelSuggestions.map((m, i) => `${i + 1}. Switch to **${m}** ${m.includes('flash-lite') ? '(1000 requests/day free tier)' : m === 'ollama' ? '(unlimited local usage)' : ''}`).join('\n') : '• Wait for quota to reset (midnight Pacific time)\n• Consider upgrading to a paid tier'}

💡 **Tip:** Gemini 2.5 Flash Lite has the highest free tier quota (1000 requests/day).`,
      suggestedModels: modelSuggestions,
      technicalDetails: errorMessage
    }
  }

  // Check for authentication errors
  if (lowerError.includes('401') || lowerError.includes('unauthorized') || lowerError.includes('invalid api key')) {
    return {
      type: 'auth_error',
      provider,
      userMessage: `🔑 **Authentication Error**

Your API key appears to be invalid or expired.

**What to do:**
1. Generate a new API key at [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Update your API key in Settings

**Alternative:** Switch to a local Ollama model (no API key required).`,
      suggestedModels: ['ollama'],
      actionRequired: 'Update API key in Settings',
      technicalDetails: errorMessage
    }
  }

  // Check for 404 errors (invalid model)
  if (lowerError.includes('404') || lowerError.includes('not found')) {
    return {
      type: 'generic',
      provider,
      userMessage: `❌ **Model Not Available**

The model **${currentModel}** is not available or doesn't exist.

**Suggestions:**
• Switch to a valid model like **gemini-2.5-flash-lite**
• Try a local Ollama model`,
      suggestedModels: ['gemini-2.5-flash-lite', 'ollama'],
      technicalDetails: errorMessage
    }
  }

  // Generic error
  return {
    type: 'generic',
    provider,
    userMessage: `⚠️ **Error**

${errorMessage}

**Suggestions:**
• Check your internet connection
• Verify your API key in Settings
• Try switching to a different model
• Consider using a local Ollama model`,
    suggestedModels: provider === 'gemini' ? ['gemini-2.5-flash-lite', 'ollama'] : ['ollama'],
    technicalDetails: errorMessage
  }
}
