/**
 * Provider Icons - Official AI provider logo icons as React components
 * Based on official brand assets
 */

import React, { SVGProps } from 'react'
import type { ModelProvider } from '../../types'

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

/**
 * Anthropic Claude Logo - Official starburst/sunburst pattern
 * Coral/orange colored rays emanating from center
 */
export function ClaudeIcon({ size = 20, className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#D97757"
      className={className}
      {...props}
    >
      {/* Starburst rays - varying lengths and angles */}
      <path d="M12 12L12 1" stroke="#D97757" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L17.5 2.5" stroke="#D97757" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L21.5 5" stroke="#D97757" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L23 10" stroke="#D97757" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L22 14" stroke="#D97757" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L19 19" stroke="#D97757" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L14 22" stroke="#D97757" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L8 21" stroke="#D97757" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L3 17" stroke="#D97757" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L1.5 12" stroke="#D97757" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L3 7" stroke="#D97757" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 12L6 3" stroke="#D97757" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.5" fill="#D97757" />
    </svg>
  )
}


/**
 * OpenAI Logo - Official hexagonal/flower logo
 */
export function OpenAIIcon({ size = 20, className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.6 8.3829l2.02-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  )
}

/**
 * Mistral AI Logo - Official "M" shape with gradient horizontal stripes
 * Yellow to orange gradient from top to bottom
 */
export function MistralIcon({ size = 20, className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      {/* M shape made of horizontal stripes with gradient colors */}
      {/* Row 1 - Yellow */}
      <rect x="1" y="1" width="4" height="3" fill="#F7D046" />
      <rect x="10" y="1" width="4" height="3" fill="#F7D046" />
      <rect x="19" y="1" width="4" height="3" fill="#F7D046" />
      {/* Row 2 - Yellow-Orange */}
      <rect x="1" y="5" width="4" height="3" fill="#F7D046" />
      <rect x="5" y="5" width="4" height="3" fill="#F7D046" />
      <rect x="15" y="5" width="4" height="3" fill="#F7D046" />
      <rect x="19" y="5" width="4" height="3" fill="#F7D046" />
      {/* Row 3 - Orange */}
      <rect x="1" y="9" width="4" height="3" fill="#F2A73B" />
      <rect x="5" y="9" width="4" height="3" fill="#F2A73B" />
      <rect x="10" y="9" width="4" height="3" fill="#F2A73B" />
      <rect x="15" y="9" width="4" height="3" fill="#F2A73B" />
      <rect x="19" y="9" width="4" height="3" fill="#F2A73B" />
      {/* Row 4 - Dark Orange */}
      <rect x="1" y="13" width="4" height="3" fill="#EE792F" />
      <rect x="10" y="13" width="4" height="3" fill="#EE792F" />
      <rect x="19" y="13" width="4" height="3" fill="#EE792F" />
      {/* Row 5 - Red-Orange */}
      <rect x="1" y="17" width="4" height="3" fill="#EB5829" />
      <rect x="10" y="17" width="4" height="3" fill="#EB5829" />
      <rect x="19" y="17" width="4" height="3" fill="#EB5829" />
      {/* Row 6 - Red */}
      <rect x="1" y="21" width="4" height="2" fill="#EA3326" />
      <rect x="10" y="21" width="4" height="2" fill="#EA3326" />
      <rect x="19" y="21" width="4" height="2" fill="#EA3326" />
    </svg>
  )
}


/**
 * Google Gemini Logo - Official sparkle/star with gradient
 */
export function GeminiIcon({ size = 20, className, ...props }: IconProps) {
  const gradientId = `gemini-gradient-${Math.random().toString(36).substr(2, 9)}`
  
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="25%" stopColor="#9B72CB" />
          <stop offset="50%" stopColor="#D96570" />
          <stop offset="75%" stopColor="#D96570" />
          <stop offset="100%" stopColor="#9B72CB" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  )
}

/**
 * GitHub Copilot Logo - Robot face with headphones and goggles
 * Rounded head with ear pieces, large oval eyes, rectangular mouth with slots
 */
export function GitHubCopilotIcon({ size = 20, className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      {/* Left ear/headphone piece */}
      <rect x="1" y="7" width="4" height="10" rx="2" fill="currentColor" />
      {/* Right ear/headphone piece */}
      <rect x="19" y="7" width="4" height="10" rx="2" fill="currentColor" />
      {/* Main head - rounded rectangle */}
      <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" />
      {/* Left goggle eye - large oval */}
      <ellipse cx="8.5" cy="10" rx="3" ry="2.5" fill="white" />
      {/* Right goggle eye - large oval */}
      <ellipse cx="15.5" cy="10" rx="3" ry="2.5" fill="white" />
      {/* Mouth area - rounded rectangle */}
      <rect x="8" y="14" width="8" height="4" rx="1" fill="white" />
      {/* Left mouth slot */}
      <rect x="9.5" y="15" width="2" height="2" rx="0.5" fill="currentColor" />
      {/* Right mouth slot */}
      <rect x="12.5" y="15" width="2" height="2" rx="0.5" fill="currentColor" />
    </svg>
  )
}

/**
 * Ollama Logo - Official llama silhouette
 */
export function OllamaIcon({ size = 20, className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7zm-2.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm5 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-4.5 5h4a2 2 0 0 1-4 0z" />
    </svg>
  )
}


/**
 * Helper function to get provider icon component by provider ID
 */
export function getProviderIcon(providerId: ModelProvider, size: number = 20): React.ReactElement {
  const iconMap: Record<ModelProvider, React.ReactElement> = {
    anthropic: <ClaudeIcon size={size} />,
    openai: <OpenAIIcon size={size} />,
    mistral: <MistralIcon size={size} />,
    gemini: <GeminiIcon size={size} />,
    github: <GitHubCopilotIcon size={size} />,
    ollama: <OllamaIcon size={size} />
  }
  
  return iconMap[providerId] || <OpenAIIcon size={size} />
}

/**
 * Provider Icon component that renders the appropriate icon based on provider ID
 */
interface ProviderIconProps {
  provider: ModelProvider
  size?: number
  className?: string
}

export function ProviderIcon({ provider, size = 20, className }: ProviderIconProps) {
  const iconComponents: Record<ModelProvider, React.FC<IconProps>> = {
    anthropic: ClaudeIcon,
    openai: OpenAIIcon,
    mistral: MistralIcon,
    gemini: GeminiIcon,
    github: GitHubCopilotIcon,
    ollama: OllamaIcon
  }
  
  const IconComponent = iconComponents[provider] || OpenAIIcon
  return <IconComponent size={size} className={className} />
}
