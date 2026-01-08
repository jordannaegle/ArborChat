// src/renderer/src/components/backgrounds/JellyfishBackground.tsx
// Animated jellyfish background for the Abyssal theme
// Creates sharp, randomly-moving bioluminescent jellyfish

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

interface Jellyfish {
  id: number
  x: number
  y: number
  size: number
  // Movement state
  targetX: number
  targetY: number
  // Visual properties
  hue: number // 170 = cyan, 200 = blue, 330 = magenta
  opacity: number
  // Animation phase
  pulsePhase: number
  pulseSpeed: number
  // Drift properties
  driftSpeed: number
  wobbleOffset: number
}

const JELLYFISH_COUNT = 6
const PULSE_CYCLE = 3000 // ms for one full pulse

function createJellyfish(id: number, canvasWidth: number, canvasHeight: number): Jellyfish {
  const hues = [170, 175, 180, 200, 210, 330] // cyan variants, blue, magenta
  const size = 30 + Math.random() * 50 // 30-80px
  const x = Math.random() * canvasWidth
  const y = Math.random() * canvasHeight
  
  return {
    id,
    x,
    y,
    size,
    targetX: x,
    targetY: y,
    hue: hues[Math.floor(Math.random() * hues.length)],
    opacity: 0.4 + Math.random() * 0.4, // 0.4-0.8
    pulsePhase: Math.random() * Math.PI * 2, // Random start phase
    pulseSpeed: 0.8 + Math.random() * 0.4, // Slightly varied pulse speeds
    driftSpeed: 0.3 + Math.random() * 0.5, // How fast they move to target
    wobbleOffset: Math.random() * 1000,
  }
}

function JellyfishSVG({ 
  jelly, 
  pulseProgress 
}: { 
  jelly: Jellyfish
  pulseProgress: number 
}) {
  // Pulse creates contraction (squash horizontally, stretch vertically)
  // then expansion (stretch horizontally, squash vertically)
  const pulse = Math.sin(pulseProgress * Math.PI * 2 * jelly.pulseSpeed + jelly.pulsePhase)
  const scaleX = 1 + pulse * 0.15
  const scaleY = 1 - pulse * 0.12
  
  // Bell dimensions
  const bellWidth = jelly.size * scaleX
  const bellHeight = jelly.size * 0.7 * scaleY
  
  // Colors based on hue
  const mainColor = `hsla(${jelly.hue}, 80%, 60%, ${jelly.opacity})`
  const glowColor = `hsla(${jelly.hue}, 90%, 70%, ${jelly.opacity * 0.6})`
  const innerColor = `hsla(${jelly.hue}, 70%, 50%, ${jelly.opacity * 0.8})`
  const tentacleColor = `hsla(${jelly.hue}, 75%, 55%, ${jelly.opacity * 0.5})`

  // Tentacle wave based on pulse
  const tentacleWave = pulse * 5

  return (
    <g 
      transform={`translate(${jelly.x}, ${jelly.y})`}
      style={{ 
        filter: `drop-shadow(0 0 ${6 + pulse * 3}px ${glowColor})`,
      }}
    >
      {/* Outer glow */}
      <ellipse
        cx={0}
        cy={0}
        rx={bellWidth * 0.6}
        ry={bellHeight * 0.5}
        fill={`hsla(${jelly.hue}, 90%, 70%, ${jelly.opacity * 0.12})`}
      />
      
      {/* Main bell (dome) */}
      <ellipse
        cx={0}
        cy={0}
        rx={bellWidth * 0.5}
        ry={bellHeight * 0.5}
        fill={mainColor}
        stroke={`hsla(${jelly.hue}, 85%, 65%, ${jelly.opacity * 0.6})`}
        strokeWidth={1}
      />
      
      {/* Inner bell pattern */}
      <ellipse
        cx={0}
        cy={bellHeight * 0.05}
        rx={bellWidth * 0.35}
        ry={bellHeight * 0.35}
        fill={innerColor}
      />
      
      {/* Center bright spot */}
      <ellipse
        cx={0}
        cy={bellHeight * 0.1}
        rx={bellWidth * 0.15}
        ry={bellHeight * 0.12}
        fill={`hsla(${jelly.hue}, 70%, 75%, ${jelly.opacity * 0.6})`}
      />
      
      {/* Highlight */}
      <ellipse
        cx={-bellWidth * 0.15}
        cy={-bellHeight * 0.15}
        rx={bellWidth * 0.1}
        ry={bellHeight * 0.08}
        fill={`hsla(${jelly.hue}, 50%, 90%, ${jelly.opacity * 0.5})`}
      />
      
      {/* Main tentacles */}
      {[-0.3, -0.1, 0.1, 0.3].map((offset, i) => {
        const tentacleX = bellWidth * offset
        const length = jelly.size * (0.8 + (i % 2) * 0.3)
        const wave = Math.sin((i * 0.8) + pulseProgress * Math.PI * 2 * jelly.pulseSpeed) * tentacleWave
        
        return (
          <path
            key={i}
            d={`M ${tentacleX} ${bellHeight * 0.3} 
                Q ${tentacleX + wave} ${bellHeight * 0.3 + length * 0.5} 
                  ${tentacleX + wave * 0.5} ${bellHeight * 0.3 + length}`}
            stroke={tentacleColor}
            strokeWidth={2 + jelly.size * 0.025}
            fill="none"
            strokeLinecap="round"
          />
        )
      })}
      
      {/* Thin trailing tentacles */}
      {[-0.2, 0, 0.2].map((offset, i) => {
        const tentacleX = bellWidth * offset
        const length = jelly.size * (1.0 + (i % 2) * 0.4)
        const wave1 = Math.sin((i * 1.2) + pulseProgress * Math.PI * 2 * jelly.pulseSpeed) * (tentacleWave * 1.5)
        const wave2 = Math.sin((i * 0.7) + pulseProgress * Math.PI * 2 * jelly.pulseSpeed + 1) * (tentacleWave * 0.8)
        
        return (
          <path
            key={`thin-${i}`}
            d={`M ${tentacleX} ${bellHeight * 0.35} 
                Q ${tentacleX + wave1} ${bellHeight * 0.35 + length * 0.4}
                  ${tentacleX + wave2} ${bellHeight * 0.35 + length}`}
            stroke={`hsla(${jelly.hue}, 70%, 60%, ${jelly.opacity * 0.35})`}
            strokeWidth={1}
            fill="none"
            strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}

export function JellyfishBackground() {
  const { themeId } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [jellyfish, setJellyfish] = useState<Jellyfish[]>([])
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [pulseProgress, setPulseProgress] = useState(0)
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  // Initialize jellyfish when dimensions are known
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0 && jellyfish.length === 0) {
      const newJellyfish = Array.from({ length: JELLYFISH_COUNT }, (_, i) => 
        createJellyfish(i, dimensions.width, dimensions.height)
      )
      setJellyfish(newJellyfish)
    }
  }, [dimensions.width, dimensions.height, jellyfish.length])

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Pick new random target for a jellyfish
  const pickNewTarget = useCallback((jelly: Jellyfish): Jellyfish => {
    // Jellyfish tend to drift upward, then sink slowly
    const currentY = jelly.y
    const moveUp = Math.random() > 0.3 // 70% chance to move up
    
    const newTargetX = Math.max(80, Math.min(dimensions.width - 80, 
      jelly.x + (Math.random() - 0.5) * 250
    ))
    const newTargetY = moveUp
      ? Math.max(80, currentY - 80 - Math.random() * 180) // Move up
      : Math.min(dimensions.height - 80, currentY + 40 + Math.random() * 100) // Sink down
    
    return {
      ...jelly,
      targetX: newTargetX,
      targetY: newTargetY,
      driftSpeed: 0.15 + Math.random() * 0.35,
    }
  }, [dimensions.width, dimensions.height])

  // Animation loop
  useEffect(() => {
    if (themeId !== 'abyssal' || jellyfish.length === 0) return

    const animate = (currentTime: number) => {
      const deltaTime = lastTimeRef.current ? currentTime - lastTimeRef.current : 16
      lastTimeRef.current = currentTime
      
      // Update pulse progress
      setPulseProgress(prev => (prev + deltaTime / PULSE_CYCLE) % 1)

      setJellyfish(prevJellyfish => 
        prevJellyfish.map(jelly => {
          // Move toward target
          const dx = jelly.targetX - jelly.x
          const dy = jelly.targetY - jelly.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          // Add wobble for organic movement
          const wobbleX = Math.sin(currentTime * 0.001 + jelly.wobbleOffset) * 0.3
          const wobbleY = Math.cos(currentTime * 0.0015 + jelly.wobbleOffset) * 0.2
          
          let newX = jelly.x
          let newY = jelly.y
          let newJelly = jelly

          if (distance > 8) {
            // Move toward target with easing
            const speed = jelly.driftSpeed * (deltaTime / 16)
            newX = jelly.x + (dx / distance) * speed + wobbleX
            newY = jelly.y + (dy / distance) * speed + wobbleY
          } else {
            // Reached target, pick new one
            newJelly = pickNewTarget(jelly)
            newX = jelly.x + wobbleX
            newY = jelly.y + wobbleY
          }

          // Keep in bounds with padding
          newX = Math.max(60, Math.min(dimensions.width - 60, newX))
          newY = Math.max(60, Math.min(dimensions.height - 60, newY))

          return {
            ...newJelly,
            x: newX,
            y: newY,
          }
        })
      )

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [themeId, jellyfish.length, pickNewTarget, dimensions])

  // Reset jellyfish when theme changes away and back
  useEffect(() => {
    if (themeId !== 'abyssal') {
      setJellyfish([])
    }
  }, [themeId])

  // Only render for abyssal theme
  if (themeId !== 'abyssal') return null

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 3 }}
      aria-hidden="true"
    >
      <svg 
        width="100%" 
        height="100%" 
        className="absolute inset-0"
      >
        {jellyfish.map(jelly => (
          <JellyfishSVG 
            key={jelly.id} 
            jelly={jelly} 
            pulseProgress={pulseProgress}
          />
        ))}
      </svg>
    </div>
  )
}

export default JellyfishBackground
