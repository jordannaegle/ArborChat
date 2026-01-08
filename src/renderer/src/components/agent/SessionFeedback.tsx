/**
 * SessionFeedback Component
 * 
 * UI component for collecting user feedback on agent sessions.
 * Triggers the learning system to process feedback and update the playbook.
 * 
 * @module renderer/components/agent/SessionFeedback
 */

import React, { useState, useCallback } from 'react'
import { ThumbsUp, ThumbsDown, MessageSquare, Loader2 } from 'lucide-react'
import { usePlaybook } from '../../hooks/usePlaybook'


// ============================================================================
// Component Props
// ============================================================================

interface SessionFeedbackProps {
  sessionId: string
  onFeedbackSubmitted?: (rating: 'helpful' | 'unhelpful') => void
  compact?: boolean
  className?: string
}


// ============================================================================
// Component Implementation
// ============================================================================

export function SessionFeedback({ 
  sessionId, 
  onFeedbackSubmitted,
  compact = false,
  className = ''
}: SessionFeedbackProps): React.ReactElement {
  const { submitFeedback } = usePlaybook(false)  // Don't auto-load
  
  const [rating, setRating] = useState<'helpful' | 'unhelpful' | null>(null)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleFeedback = useCallback(async (value: 'helpful' | 'unhelpful') => {
    if (submitted || isSubmitting) return

    setRating(value)
    setIsSubmitting(true)

    try {
      await submitFeedback(sessionId, value, comment || undefined)
      setSubmitted(true)
      onFeedbackSubmitted?.(value)
    } catch (error) {
      console.error('[SessionFeedback] Error submitting:', error)
      setRating(null)
    } finally {
      setIsSubmitting(false)
    }
  }, [sessionId, comment, submitted, isSubmitting, submitFeedback, onFeedbackSubmitted])

  const handleCommentSubmit = useCallback(async () => {
    if (!rating || isSubmitting) return

    setIsSubmitting(true)
    try {
      await submitFeedback(sessionId, rating, comment)
      setSubmitted(true)
      setShowComment(false)
    } catch (error) {
      console.error('[SessionFeedback] Error submitting comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [sessionId, rating, comment, isSubmitting, submitFeedback])

  // Already submitted - show thank you
  if (submitted) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <span className="text-green-500">✓</span>
        <span>Thanks for your feedback!</span>
      </div>
    )
  }

  // Compact mode - just buttons
  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <button
          onClick={() => handleFeedback('helpful')}
          disabled={isSubmitting}
          className={`p-1.5 rounded-md transition-colors ${
            rating === 'helpful' 
              ? 'bg-green-500/20 text-green-500' 
              : 'hover:bg-accent text-muted-foreground hover:text-foreground'
          }`}
          title="This was helpful"
        >
          {isSubmitting && rating === 'helpful' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ThumbsUp className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={() => handleFeedback('unhelpful')}
          disabled={isSubmitting}
          className={`p-1.5 rounded-md transition-colors ${
            rating === 'unhelpful' 
              ? 'bg-red-500/20 text-red-500' 
              : 'hover:bg-accent text-muted-foreground hover:text-foreground'
          }`}
          title="This wasn't helpful"
        >
          {isSubmitting && rating === 'unhelpful' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ThumbsDown className="w-4 h-4" />
          )}
        </button>
      </div>
    )
  }

  // Full mode - with optional comment
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">How did this session go?</span>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleFeedback('helpful')}
            disabled={isSubmitting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              rating === 'helpful' 
                ? 'bg-green-500/20 text-green-500 border border-green-500/30' 
                : 'bg-accent/50 hover:bg-accent text-muted-foreground hover:text-foreground'
            }`}
          >
            {isSubmitting && rating === 'helpful' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ThumbsUp className="w-4 h-4" />
            )}
            <span>Helpful</span>
          </button>
          
          <button
            onClick={() => handleFeedback('unhelpful')}
            disabled={isSubmitting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              rating === 'unhelpful' 
                ? 'bg-red-500/20 text-red-500 border border-red-500/30' 
                : 'bg-accent/50 hover:bg-accent text-muted-foreground hover:text-foreground'
            }`}
          >
            {isSubmitting && rating === 'unhelpful' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ThumbsDown className="w-4 h-4" />
            )}
            <span>Not helpful</span>
          </button>
        </div>

        {rating && !showComment && (
          <button
            onClick={() => setShowComment(true)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Add comment</span>
          </button>
        )}
      </div>

      {showComment && (
        <div className="flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What could have been better?"
            className="flex-1 px-3 py-1.5 text-sm rounded-md bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />
          <button
            onClick={handleCommentSubmit}
            disabled={isSubmitting || !comment.trim()}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Submit'
            )}
          </button>
          <button
            onClick={() => setShowComment(false)}
            className="px-3 py-1.5 text-sm rounded-md bg-accent hover:bg-accent/80"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}


// ============================================================================
// Export
// ============================================================================

export default SessionFeedback
