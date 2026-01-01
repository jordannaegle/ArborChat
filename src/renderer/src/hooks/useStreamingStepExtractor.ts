// src/renderer/src/hooks/useStreamingStepExtractor.ts
// Phase 6.4: Extract thinking patterns from streaming AI messages
// Enables real-time step display as AI response streams in

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useDebounce } from './useDebounce'

export interface ExtractedThought {
  id: string
  content: string
  type: 'thinking' | 'verification'
  timestamp: number
}

export interface UseStreamingStepExtractorOptions {
  /** The streaming content to analyze */
  streamingContent: string
  /** Whether content is currently streaming */
  isStreaming: boolean
  /** Minimum content length before extraction starts */
  minContentLength?: number
  /** Debounce delay for extraction (ms) */
  extractionDelay?: number
}

export interface UseStreamingStepExtractorReturn {
  /** Extracted thinking steps */
  thinkingSteps: ExtractedThought[]
  /** Extracted verification steps */
  verificationSteps: ExtractedThought[]
  /** Whether extraction is currently processing */
  isExtracting: boolean
  /** Clear all extracted steps */
  clearSteps: () => void
}

// Pattern matchers for thinking content (same as stepExtractor.ts)
const THINKING_PATTERNS = [
  /^(Let me|I'll|I will|First,? I'll|First,? let me|Now I'll|Now let me)/i,
  /^\d+\.\s+(First|Then|Next|Finally|Now)/i,
  /^(Looking at|Analyzing|Examining|Checking|Reading|Reviewing)/i,
  /^(I need to|I should|I'm going to|I am going to)/i
]

// Pattern matchers for verification content
const VERIFICATION_PATTERNS = [
  /^(I've verified|I have verified|Successfully|The result shows|Verified that)/i,
  /^(Done|Completed|Finished|That's done|The .+ (is|are) (now|complete))/i,
  /^(As we can see|The output shows|This confirms|Looking at the result)/i,
  /^(Unfortunately|However,? the|The error indicates|It seems|There was)/i
]

let stepIdCounter = 0

/**
 * Generate a unique step ID
 */
function generateStepId(prefix: string): string {
  return `streaming-${prefix}-${Date.now()}-${++stepIdCounter}`
}

/**
 * Test if a line matches thinking patterns
 */
function isThinkingLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length < 10) return false
  return THINKING_PATTERNS.some(pattern => pattern.test(trimmed))
}

/**
 * Test if a line matches verification patterns
 */
function isVerificationLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length < 10) return false
  return VERIFICATION_PATTERNS.some(pattern => pattern.test(trimmed))
}

/**
 * Extract steps from content (simplified for streaming)
 */
function extractStepsFromContent(content: string): {
  thinking: string[]
  verification: string[]
} {
  const lines = content.split('\n')
  const thinking: string[] = []
  const verification: string[] = []
  
  let currentBlock: string[] = []
  let currentType: 'thinking' | 'verification' | null = null
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    if (isThinkingLine(trimmed)) {
      // Flush previous block if different type
      if (currentType === 'verification' && currentBlock.length > 0) {
        verification.push(currentBlock.join('\n'))
        currentBlock = []
      }
      currentType = 'thinking'
      currentBlock.push(trimmed)
    } else if (isVerificationLine(trimmed)) {
      // Flush previous block if different type
      if (currentType === 'thinking' && currentBlock.length > 0) {
        thinking.push(currentBlock.join('\n'))
        currentBlock = []
      }
      currentType = 'verification'
      currentBlock.push(trimmed)
    } else if (trimmed && currentType) {
      // Continue current block if not empty and not a new section
      if (!trimmed.startsWith('#') && !trimmed.startsWith('---')) {
        currentBlock.push(trimmed)
      } else {
        // Flush and reset on section breaks
        if (currentType === 'thinking' && currentBlock.length > 0) {
          thinking.push(currentBlock.join('\n'))
        } else if (currentType === 'verification' && currentBlock.length > 0) {
          verification.push(currentBlock.join('\n'))
        }
        currentBlock = []
        currentType = null
      }
    }
  }
  
  // Flush remaining block
  if (currentType === 'thinking' && currentBlock.length > 0) {
    thinking.push(currentBlock.join('\n'))
  } else if (currentType === 'verification' && currentBlock.length > 0) {
    verification.push(currentBlock.join('\n'))
  }
  
  return { thinking, verification }
}

/**
 * Hook to extract thinking and verification patterns from streaming AI content
 * 
 * This enables real-time display of AI thought processes as they stream in,
 * rather than waiting for the full response to complete.
 * 
 * @example
 * ```tsx
 * const { thinkingSteps, verificationSteps } = useStreamingStepExtractor({
 *   streamingContent: lastMessage?.content || '',
 *   isStreaming: isLastMessageStreaming
 * })
 * 
 * // Display extracted steps in real-time
 * {thinkingSteps.map(step => (
 *   <ThinkingStep key={step.id} content={step.content} />
 * ))}
 * ```
 */
export function useStreamingStepExtractor(
  options: UseStreamingStepExtractorOptions
): UseStreamingStepExtractorReturn {
  const {
    streamingContent,
    isStreaming,
    minContentLength = 50,
    extractionDelay = 150
  } = options
  
  const [thinkingSteps, setThinkingSteps] = useState<ExtractedThought[]>([])
  const [verificationSteps, setVerificationSteps] = useState<ExtractedThought[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  
  // Track previously processed content to avoid re-extracting
  const processedContentRef = useRef('')
  const extractedIdsRef = useRef<Set<string>>(new Set())
  
  // Debounce content changes during streaming
  const debouncedContent = useDebounce(streamingContent, extractionDelay)
  
  // Clear steps
  const clearSteps = useCallback(() => {
    setThinkingSteps([])
    setVerificationSteps([])
    processedContentRef.current = ''
    extractedIdsRef.current.clear()
  }, [])
  
  // Extract steps when content changes during streaming
  useEffect(() => {
    // Skip if not streaming or content too short
    if (!isStreaming || debouncedContent.length < minContentLength) {
      return
    }
    
    // Skip if content hasn't meaningfully changed
    const newContent = debouncedContent.slice(processedContentRef.current.length)
    if (newContent.length < 20) {
      return
    }
    
    setIsExtracting(true)
    
    // Extract from full content to get complete patterns
    const { thinking, verification } = extractStepsFromContent(debouncedContent)
    const timestamp = Date.now()
    
    // Add new thinking steps (avoid duplicates by content hash)
    const newThinking: ExtractedThought[] = []
    for (const content of thinking) {
      const contentHash = content.slice(0, 50)
      if (!extractedIdsRef.current.has(contentHash)) {
        extractedIdsRef.current.add(contentHash)
        newThinking.push({
          id: generateStepId('think'),
          content,
          type: 'thinking',
          timestamp
        })
      }
    }
    
    // Add new verification steps
    const newVerification: ExtractedThought[] = []
    for (const content of verification) {
      const contentHash = content.slice(0, 50)
      if (!extractedIdsRef.current.has(contentHash)) {
        extractedIdsRef.current.add(contentHash)
        newVerification.push({
          id: generateStepId('verify'),
          content,
          type: 'verification',
          timestamp
        })
      }
    }
    
    if (newThinking.length > 0) {
      setThinkingSteps(prev => [...prev, ...newThinking])
    }
    
    if (newVerification.length > 0) {
      setVerificationSteps(prev => [...prev, ...newVerification])
    }
    
    processedContentRef.current = debouncedContent
    setIsExtracting(false)
  }, [debouncedContent, isStreaming, minContentLength])
  
  // Clear extracted steps when streaming starts fresh
  useEffect(() => {
    if (isStreaming && streamingContent.length < minContentLength) {
      clearSteps()
    }
  }, [isStreaming, streamingContent.length, minContentLength, clearSteps])
  
  return useMemo(() => ({
    thinkingSteps,
    verificationSteps,
    isExtracting,
    clearSteps
  }), [thinkingSteps, verificationSteps, isExtracting, clearSteps])
}

export default useStreamingStepExtractor
