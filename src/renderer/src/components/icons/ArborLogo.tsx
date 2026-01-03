import React from 'react'

interface ArborLogoProps {
  size?: number
  className?: string
}

/**
 * ArborChat Logo Component
 * Displays a tree on a theme-colored background with iOS-style rounded corners.
 * The background and tree colors automatically adapt to the current theme.
 * - Background uses --theme-logo-background (falls back to primary color)
 * - Tree uses --theme-logo-foreground (typically white, golden for Golden Hour)
 */
export const ArborLogo: React.FC<ArborLogoProps> = ({ size = 32, className = '' }) => {
  // iOS-style corner radius is ~22% of size
  const borderRadius = Math.round(size * 0.22)

  // Theme-aware colors via CSS variables
  const bgColor = 'var(--theme-logo-background, var(--theme-primary, #5865f2))'
  const fgColor = 'var(--theme-logo-foreground, #ffffff)'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ borderRadius }}
    >
      {/* Background with theme logo color */}
      <rect
        width="512"
        height="512"
        rx={borderRadius * (512 / size)}
        fill={bgColor}
      />
      
      {/* Tree - theme-aware color (white or golden depending on theme) */}
      <g transform="translate(256, 256) scale(0.75) translate(-256, -256)" style={{ color: fgColor }}>
        {/* Main trunk */}
        <path
          d="M248 480 L248 320 Q248 300 256 280 Q264 300 264 320 L264 480 Z"
          fill="currentColor"
        />
        
        {/* Root flare */}
        <path
          d="M230 480 Q240 460 248 450 L248 480 Z M264 480 L264 450 Q272 460 282 480 Z"
          fill="currentColor"
        />
        
        {/* Lower trunk widening */}
        <path
          d="M244 380 L244 320 Q244 310 256 300 Q268 310 268 320 L268 380 Q268 390 256 395 Q244 390 244 380 Z"
          fill="currentColor"
        />

        {/* Branch Level 1 - Bottom drooping branches */}
        <path
          d="M256 340 Q200 320 160 360 Q180 340 200 335 Q220 330 240 340"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M256 340 Q312 320 352 360 Q332 340 312 335 Q292 330 272 340"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Branch Level 2 */}
        <path
          d="M256 300 Q190 280 140 310 Q170 290 200 285 Q230 280 250 295"
          stroke="currentColor"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M256 300 Q322 280 372 310 Q342 290 312 285 Q282 280 262 295"
          stroke="currentColor"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Branch Level 3 */}
        <path
          d="M256 260 Q180 240 120 260 Q160 245 200 240 Q240 238 252 255"
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M256 260 Q332 240 392 260 Q352 245 312 240 Q272 238 260 255"
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Branch Level 4 */}
        <path
          d="M256 220 Q190 200 130 210 Q170 200 210 195 Q245 192 254 215"
          stroke="currentColor"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M256 220 Q322 200 382 210 Q342 200 302 195 Q267 192 258 215"
          stroke="currentColor"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Branch Level 5 - Upper spreading */}
        <path
          d="M256 180 Q200 160 150 155 Q190 158 225 160 Q250 165 254 178"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M256 180 Q312 160 362 155 Q322 158 287 160 Q262 165 258 178"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Branch Level 6 - Top */}
        <path
          d="M256 140 Q210 120 170 110 Q200 115 230 120 Q252 128 255 138"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M256 140 Q302 120 342 110 Q312 115 282 120 Q260 128 257 138"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Crown/Top */}
        <path
          d="M256 100 Q240 80 256 60 Q272 80 256 100"
          stroke="currentColor"
          strokeWidth="3"
          fill="currentColor"
          strokeLinecap="round"
        />

        {/* Leaves - scattered ellipses */}
        {/* Bottom level leaves */}
        <ellipse cx="160" cy="355" rx="12" ry="8" fill="currentColor" transform="rotate(-30 160 355)" />
        <ellipse cx="180" cy="340" rx="10" ry="6" fill="currentColor" transform="rotate(-20 180 340)" />
        <ellipse cx="352" cy="355" rx="12" ry="8" fill="currentColor" transform="rotate(30 352 355)" />
        <ellipse cx="332" cy="340" rx="10" ry="6" fill="currentColor" transform="rotate(20 332 340)" />
        
        {/* Level 2 leaves */}
        <ellipse cx="140" cy="305" rx="14" ry="9" fill="currentColor" transform="rotate(-25 140 305)" />
        <ellipse cx="165" cy="290" rx="11" ry="7" fill="currentColor" transform="rotate(-15 165 290)" />
        <ellipse cx="372" cy="305" rx="14" ry="9" fill="currentColor" transform="rotate(25 372 305)" />
        <ellipse cx="347" cy="290" rx="11" ry="7" fill="currentColor" transform="rotate(15 347 290)" />
        
        {/* Level 3 leaves */}
        <ellipse cx="120" cy="255" rx="15" ry="10" fill="currentColor" transform="rotate(-20 120 255)" />
        <ellipse cx="150" cy="242" rx="12" ry="8" fill="currentColor" transform="rotate(-10 150 242)" />
        <ellipse cx="392" cy="255" rx="15" ry="10" fill="currentColor" transform="rotate(20 392 255)" />
        <ellipse cx="362" cy="242" rx="12" ry="8" fill="currentColor" transform="rotate(10 362 242)" />
        
        {/* Level 4 leaves */}
        <ellipse cx="130" cy="205" rx="14" ry="9" fill="currentColor" transform="rotate(-15 130 205)" />
        <ellipse cx="160" cy="192" rx="11" ry="7" fill="currentColor" transform="rotate(-5 160 192)" />
        <ellipse cx="382" cy="205" rx="14" ry="9" fill="currentColor" transform="rotate(15 382 205)" />
        <ellipse cx="352" cy="192" rx="11" ry="7" fill="currentColor" transform="rotate(5 352 192)" />
        
        {/* Level 5 leaves */}
        <ellipse cx="150" cy="150" rx="13" ry="8" fill="currentColor" transform="rotate(-10 150 150)" />
        <ellipse cx="180" cy="155" rx="10" ry="6" fill="currentColor" transform="rotate(0 180 155)" />
        <ellipse cx="362" cy="150" rx="13" ry="8" fill="currentColor" transform="rotate(10 362 150)" />
        <ellipse cx="332" cy="155" rx="10" ry="6" fill="currentColor" transform="rotate(0 332 155)" />
        
        {/* Top leaves */}
        <ellipse cx="170" cy="105" rx="12" ry="7" fill="currentColor" transform="rotate(-5 170 105)" />
        <ellipse cx="200" cy="95" rx="9" ry="5" fill="currentColor" transform="rotate(5 200 95)" />
        <ellipse cx="342" cy="105" rx="12" ry="7" fill="currentColor" transform="rotate(5 342 105)" />
        <ellipse cx="312" cy="95" rx="9" ry="5" fill="currentColor" transform="rotate(-5 312 95)" />
        
        {/* Bird in upper right */}
        <path
          d="M340 75 Q355 70 365 80 Q355 78 350 82 Q345 78 340 75"
          fill="currentColor"
        />
      </g>
    </svg>
  )
}

export default ArborLogo
