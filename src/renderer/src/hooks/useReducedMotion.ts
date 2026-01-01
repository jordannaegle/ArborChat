// src/renderer/src/hooks/useReducedMotion.ts
// Phase 6.5: Respects user's reduced motion preference
// WCAG 2.1 Success Criterion 2.3.3 (AAA) support

import { useState, useEffect } from 'react'

/**
 * Hook to detect if user prefers reduced motion
 * 
 * Listens to the prefers-reduced-motion media query and updates
 * reactively when the preference changes.
 * 
 * @returns Whether the user prefers reduced motion
 * 
 * @example
 * ```tsx
 * const prefersReducedMotion = useReducedMotion()
 * 
 * const animationClass = cn(
 *   'transition-all',
 *   !prefersReducedMotion && 'duration-200 ease-out'
 * )
 * ```
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    // Check on initial render (SSR-safe)
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches)
    
    // Listen for changes
    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }
    
    mediaQuery.addEventListener('change', handler)
    
    return () => {
      mediaQuery.removeEventListener('change', handler)
    }
  }, [])

  return prefersReducedMotion
}

export default useReducedMotion
