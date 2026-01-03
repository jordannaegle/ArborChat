// src/renderer/src/components/backgrounds/AbyssalBackground.tsx
// Enhanced Abyssal theme background with jellyfish, particles, light rays, bubbles
// Performance optimized with reduced motion support

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

interface Jellyfish {
  id: number
  x: number
  y: number
  size: number
  targetX: number
  targetY: number
  hue: number
  opacity: number
  pulsePhase: number
  pulseSpeed: number
  driftSpeed: number
  wobbleOffset: number
  depth: number // 0-1, affects blur and size
}

interface Particle {
  id: number
  x: number
  y: number
  size: number
  opacity: number
  speedX: number
  speedY: number
  type: 'plankton' | 'debris' | 'bioluminescent'
  hue?: number
  phase: number
}

interface Bubble {
  id: number
  x: number
  y: number
  size: number
  speed: number
  wobblePhase: number
  wobbleAmplitude: number
  opacity: number
}

interface BioFlash {
  id: number
  x: number
  y: number
  size: number
  hue: number
  startTime: number
  duration: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION - All timing values are 1.5x slower (50% reduction)
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Jellyfish (60% smaller = 0.4x, 30% more transparent)
  JELLYFISH_COUNT: 5,
  JELLYFISH_SIZE_MIN: 12, // Was 30, now 12 (40%)
  JELLYFISH_SIZE_MAX: 32, // Was 80, now 32 (40%)
  JELLYFISH_OPACITY_MIN: 0.28, // Was 0.4, reduced by 30%
  JELLYFISH_OPACITY_MAX: 0.56, // Was 0.8, reduced by 30%
  JELLYFISH_PULSE_CYCLE: 4500, // Was 3000ms, now 4500ms (1.5x slower)
  
  // Particles
  PLANKTON_COUNT: 25,
  DEBRIS_COUNT: 15,
  BIOLUMINESCENT_COUNT: 8,
  
  // Bubbles
  BUBBLE_COUNT: 12,
  BUBBLE_SPAWN_INTERVAL: 3000, // ms between bubble spawns (was 2000)
  
  // Bio flashes
  FLASH_INTERVAL_MIN: 4500, // Was 3000
  FLASH_INTERVAL_MAX: 12000, // Was 8000
  FLASH_DURATION: 1500, // Was 1000
  
  // Light rays
  LIGHT_RAY_COUNT: 5,
  
  // Performance
  TARGET_FPS: 30,
  FRAME_TIME: 1000 / 30,
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function createJellyfish(id: number, width: number, height: number): Jellyfish {
  const hues = [170, 175, 180, 200, 210, 330]
  const depth = 0.3 + Math.random() * 0.7
  const size = (CONFIG.JELLYFISH_SIZE_MIN + Math.random() * (CONFIG.JELLYFISH_SIZE_MAX - CONFIG.JELLYFISH_SIZE_MIN)) * depth
  const x = Math.random() * width
  const y = Math.random() * height
  
  return {
    id, x, y, size,
    targetX: x,
    targetY: y,
    hue: hues[Math.floor(Math.random() * hues.length)],
    opacity: (CONFIG.JELLYFISH_OPACITY_MIN + Math.random() * (CONFIG.JELLYFISH_OPACITY_MAX - CONFIG.JELLYFISH_OPACITY_MIN)) * depth,
    pulsePhase: Math.random() * Math.PI * 2,
    pulseSpeed: 0.5 + Math.random() * 0.3, // Slower pulse
    driftSpeed: 0.15 + Math.random() * 0.25, // Slower drift
    wobbleOffset: Math.random() * 1000,
    depth,
  }
}

function createParticle(id: number, width: number, height: number, type: Particle['type']): Particle {
  const baseParticle = {
    id,
    x: Math.random() * width,
    y: Math.random() * height,
    phase: Math.random() * Math.PI * 2,
  }
  
  switch (type) {
    case 'plankton':
      return {
        ...baseParticle,
        type,
        size: 0.5 + Math.random() * 1.5,
        opacity: 0.2 + Math.random() * 0.3,
        speedX: (Math.random() - 0.5) * 0.15, // Slower
        speedY: -0.05 - Math.random() * 0.1, // Slower upward drift
      }
    case 'debris':
      return {
        ...baseParticle,
        type,
        size: 1 + Math.random() * 2,
        opacity: 0.1 + Math.random() * 0.2,
        speedX: (Math.random() - 0.5) * 0.1,
        speedY: 0.02 + Math.random() * 0.05, // Slowly sinking
      }
    case 'bioluminescent':
      return {
        ...baseParticle,
        type,
        size: 1.5 + Math.random() * 2,
        opacity: 0.3 + Math.random() * 0.4,
        speedX: (Math.random() - 0.5) * 0.08,
        speedY: (Math.random() - 0.5) * 0.08,
        hue: 170 + Math.random() * 40,
      }
  }
}

function createBubble(id: number, width: number, height: number): Bubble {
  return {
    id,
    x: Math.random() * width,
    y: height + 20,
    size: 2 + Math.random() * 6,
    speed: 0.3 + Math.random() * 0.5, // Slower rise
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmplitude: 5 + Math.random() * 15,
    opacity: 0.15 + Math.random() * 0.25,
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// SVG COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function JellyfishSVG({ jelly, pulseProgress }: { jelly: Jellyfish; pulseProgress: number }) {
  const pulse = Math.sin(pulseProgress * Math.PI * 2 * jelly.pulseSpeed + jelly.pulsePhase)
  const scaleX = 1 + pulse * 0.12 // Slightly reduced pulse intensity
  const scaleY = 1 - pulse * 0.1
  
  const bellWidth = jelly.size * scaleX
  const bellHeight = jelly.size * 0.7 * scaleY
  
  const mainColor = `hsla(${jelly.hue}, 80%, 60%, ${jelly.opacity})`
  const glowColor = `hsla(${jelly.hue}, 90%, 70%, ${jelly.opacity * 0.5})`
  const innerColor = `hsla(${jelly.hue}, 70%, 50%, ${jelly.opacity * 0.7})`
  const tentacleColor = `hsla(${jelly.hue}, 75%, 55%, ${jelly.opacity * 0.4})`
  const tentacleWave = pulse * 4

  // Depth-based blur for distant jellyfish
  const blurAmount = (1 - jelly.depth) * 2

  return (
    <g 
      transform={`translate(${jelly.x}, ${jelly.y})`}
      style={{ 
        filter: `drop-shadow(0 0 ${4 + pulse * 2}px ${glowColor}) blur(${blurAmount}px)`,
      }}
    >
      {/* Outer glow */}
      <ellipse
        cx={0}
        cy={0}
        rx={bellWidth * 0.6}
        ry={bellHeight * 0.5}
        fill={`hsla(${jelly.hue}, 90%, 70%, ${jelly.opacity * 0.1})`}
      />
      
      {/* Main bell */}
      <ellipse
        cx={0}
        cy={0}
        rx={bellWidth * 0.5}
        ry={bellHeight * 0.5}
        fill={mainColor}
        stroke={`hsla(${jelly.hue}, 85%, 65%, ${jelly.opacity * 0.5})`}
        strokeWidth={0.5}
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
        fill={`hsla(${jelly.hue}, 70%, 75%, ${jelly.opacity * 0.5})`}
      />
      
      {/* Highlight */}
      <ellipse
        cx={-bellWidth * 0.15}
        cy={-bellHeight * 0.15}
        rx={bellWidth * 0.08}
        ry={bellHeight * 0.06}
        fill={`hsla(${jelly.hue}, 50%, 90%, ${jelly.opacity * 0.4})`}
      />
      
      {/* Main tentacles */}
      {[-0.3, -0.1, 0.1, 0.3].map((offset, i) => {
        const tentacleX = bellWidth * offset
        const length = jelly.size * (0.7 + (i % 2) * 0.25)
        const wave = Math.sin((i * 0.8) + pulseProgress * Math.PI * 2 * jelly.pulseSpeed) * tentacleWave
        
        return (
          <path
            key={i}
            d={`M ${tentacleX} ${bellHeight * 0.3} 
                Q ${tentacleX + wave} ${bellHeight * 0.3 + length * 0.5} 
                  ${tentacleX + wave * 0.5} ${bellHeight * 0.3 + length}`}
            stroke={tentacleColor}
            strokeWidth={1.5 + jelly.size * 0.02}
            fill="none"
            strokeLinecap="round"
          />
        )
      })}
      
      {/* Thin trailing tentacles */}
      {[-0.2, 0, 0.2].map((offset, i) => {
        const tentacleX = bellWidth * offset
        const length = jelly.size * (0.9 + (i % 2) * 0.35)
        const wave1 = Math.sin((i * 1.2) + pulseProgress * Math.PI * 2 * jelly.pulseSpeed) * (tentacleWave * 1.3)
        const wave2 = Math.sin((i * 0.7) + pulseProgress * Math.PI * 2 * jelly.pulseSpeed + 1) * (tentacleWave * 0.7)
        
        return (
          <path
            key={`thin-${i}`}
            d={`M ${tentacleX} ${bellHeight * 0.35} 
                Q ${tentacleX + wave1} ${bellHeight * 0.35 + length * 0.4}
                  ${tentacleX + wave2} ${bellHeight * 0.35 + length}`}
            stroke={`hsla(${jelly.hue}, 70%, 60%, ${jelly.opacity * 0.25})`}
            strokeWidth={0.75}
            fill="none"
            strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}

function LightRays({ width, height, time }: { width: number; height: number; time: number }) {
  const rays = useMemo(() => {
    return Array.from({ length: CONFIG.LIGHT_RAY_COUNT }, (_, i) => ({
      id: i,
      x: (width * (i + 0.5)) / CONFIG.LIGHT_RAY_COUNT,
      width: 30 + Math.random() * 60,
      opacity: 0.015 + Math.random() * 0.02,
      phase: Math.random() * Math.PI * 2,
      speed: 0.0003 + Math.random() * 0.0002, // Very slow
    }))
  }, [width])
  
  return (
    <g>
      <defs>
        <linearGradient id="lightRayGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(200, 230, 255, 0.08)" />
          <stop offset="30%" stopColor="rgba(150, 200, 230, 0.04)" />
          <stop offset="70%" stopColor="rgba(100, 180, 220, 0.02)" />
          <stop offset="100%" stopColor="rgba(50, 150, 200, 0)" />
        </linearGradient>
      </defs>
      {rays.map(ray => {
        const wobble = Math.sin(time * ray.speed + ray.phase) * 20
        const currentOpacity = ray.opacity * (0.7 + Math.sin(time * ray.speed * 0.5 + ray.phase) * 0.3)
        return (
          <polygon
            key={ray.id}
            points={`
              ${ray.x - ray.width / 4 + wobble},-50
              ${ray.x + ray.width / 4 + wobble},-50
              ${ray.x + ray.width + wobble * 2},${height + 50}
              ${ray.x - ray.width + wobble * 2},${height + 50}
            `}
            fill="url(#lightRayGradient)"
            opacity={currentOpacity}
          />
        )
      })}
    </g>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// DEPTH FOG / VIGNETTE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function DepthFog() {
  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at 50% 50%, transparent 30%, rgba(5, 8, 16, 0.3) 100%),
          linear-gradient(180deg, rgba(10, 20, 40, 0.15) 0%, transparent 20%, transparent 80%, rgba(5, 8, 16, 0.25) 100%)
        `,
      }}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function AbyssalBackground() {
  const { themeId } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [pulseProgress, setPulseProgress] = useState(0)
  const [animationTime, setAnimationTime] = useState(0)
  
  // State for all animated elements
  const [jellyfish, setJellyfish] = useState<Jellyfish[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [bioFlashes, setBioFlashes] = useState<BioFlash[]>([])
  
  // Refs for animation
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const lastBubbleSpawnRef = useRef<number>(0)
  const lastFlashRef = useRef<number>(0)
  const nextFlashIntervalRef = useRef<number>(CONFIG.FLASH_INTERVAL_MIN)
  
  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

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

  // Initialize all elements when dimensions are known
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0 && jellyfish.length === 0) {
      // Create jellyfish
      const newJellyfish = Array.from({ length: CONFIG.JELLYFISH_COUNT }, (_, i) => 
        createJellyfish(i, dimensions.width, dimensions.height)
      )
      setJellyfish(newJellyfish)
      
      // Create particles
      const newParticles: Particle[] = [
        ...Array.from({ length: CONFIG.PLANKTON_COUNT }, (_, i) => 
          createParticle(i, dimensions.width, dimensions.height, 'plankton')
        ),
        ...Array.from({ length: CONFIG.DEBRIS_COUNT }, (_, i) => 
          createParticle(CONFIG.PLANKTON_COUNT + i, dimensions.width, dimensions.height, 'debris')
        ),
        ...Array.from({ length: CONFIG.BIOLUMINESCENT_COUNT }, (_, i) => 
          createParticle(CONFIG.PLANKTON_COUNT + CONFIG.DEBRIS_COUNT + i, dimensions.width, dimensions.height, 'bioluminescent')
        ),
      ]
      setParticles(newParticles)
      
      // Create initial bubbles
      const newBubbles = Array.from({ length: Math.floor(CONFIG.BUBBLE_COUNT / 2) }, (_, i) => {
        const bubble = createBubble(i, dimensions.width, dimensions.height)
        bubble.y = Math.random() * dimensions.height // Spread across screen initially
        return bubble
      })
      setBubbles(newBubbles)
    }
  }, [dimensions.width, dimensions.height, jellyfish.length])

  // Pick new random target for a jellyfish
  const pickNewTarget = useCallback((jelly: Jellyfish): Jellyfish => {
    const moveUp = Math.random() > 0.3
    const newTargetX = Math.max(40, Math.min(dimensions.width - 40, 
      jelly.x + (Math.random() - 0.5) * 200
    ))
    const newTargetY = moveUp
      ? Math.max(40, jelly.y - 60 - Math.random() * 150)
      : Math.min(dimensions.height - 40, jelly.y + 30 + Math.random() * 80)
    
    return {
      ...jelly,
      targetX: newTargetX,
      targetY: newTargetY,
      driftSpeed: 0.1 + Math.random() * 0.2, // Slower drift
    }
  }, [dimensions.width, dimensions.height])

  // Main animation loop
  useEffect(() => {
    if (themeId !== 'abyssal' || jellyfish.length === 0 || prefersReducedMotion) return

    let frameCount = 0
    const animate = (currentTime: number) => {
      const deltaTime = lastTimeRef.current ? currentTime - lastTimeRef.current : 16
      lastTimeRef.current = currentTime
      
      // Throttle to target FPS for performance
      frameCount++
      if (frameCount % 2 !== 0) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }
      
      // Update animation time
      setAnimationTime(currentTime)
      
      // Update pulse progress (1.5x slower)
      setPulseProgress(prev => (prev + deltaTime / CONFIG.JELLYFISH_PULSE_CYCLE) % 1)

      // Update jellyfish positions
      setJellyfish(prev => prev.map(jelly => {
        const dx = jelly.targetX - jelly.x
        const dy = jelly.targetY - jelly.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        const wobbleX = Math.sin(currentTime * 0.0007 + jelly.wobbleOffset) * 0.2
        const wobbleY = Math.cos(currentTime * 0.001 + jelly.wobbleOffset) * 0.15
        
        let newX = jelly.x
        let newY = jelly.y
        let newJelly = jelly

        if (distance > 8) {
          const speed = jelly.driftSpeed * (deltaTime / 16)
          newX = jelly.x + (dx / distance) * speed + wobbleX
          newY = jelly.y + (dy / distance) * speed + wobbleY
        } else {
          newJelly = pickNewTarget(jelly)
          newX = jelly.x + wobbleX
          newY = jelly.y + wobbleY
        }

        newX = Math.max(30, Math.min(dimensions.width - 30, newX))
        newY = Math.max(30, Math.min(dimensions.height - 30, newY))

        return { ...newJelly, x: newX, y: newY }
      }))

      // Update particles
      setParticles(prev => prev.map(p => {
        let newX = p.x + p.speedX * (deltaTime / 16)
        let newY = p.y + p.speedY * (deltaTime / 16)
        
        // Add subtle oscillation
        if (p.type === 'bioluminescent') {
          newX += Math.sin(currentTime * 0.001 + p.phase) * 0.1
          newY += Math.cos(currentTime * 0.0012 + p.phase) * 0.1
        }
        
        // Wrap around screen
        if (newX < -10) newX = dimensions.width + 10
        if (newX > dimensions.width + 10) newX = -10
        if (newY < -10) newY = dimensions.height + 10
        if (newY > dimensions.height + 10) newY = -10
        
        // Pulse opacity for bioluminescent
        let newOpacity = p.opacity
        if (p.type === 'bioluminescent') {
          newOpacity = p.opacity * (0.6 + Math.sin(currentTime * 0.002 + p.phase) * 0.4)
        }
        
        return { ...p, x: newX, y: newY, opacity: newOpacity }
      }))

      // Update bubbles
      setBubbles(prev => prev.map(b => {
        let newY = b.y - b.speed * (deltaTime / 16)
        const wobbleX = Math.sin(currentTime * 0.002 + b.wobblePhase) * b.wobbleAmplitude * 0.02
        const newX = b.x + wobbleX
        
        // Shrink and fade as they rise
        const progress = 1 - (newY / dimensions.height)
        const newSize = b.size * (0.7 + progress * 0.3)
        const newOpacity = b.opacity * (0.3 + (1 - progress) * 0.7)
        
        // Reset if off screen
        if (newY < -20) {
          return createBubble(b.id, dimensions.width, dimensions.height)
        }
        
        return { ...b, x: newX, y: newY, size: newSize, opacity: newOpacity }
      }))
      
      // Spawn new bubbles periodically
      if (currentTime - lastBubbleSpawnRef.current > CONFIG.BUBBLE_SPAWN_INTERVAL) {
        lastBubbleSpawnRef.current = currentTime
        setBubbles(prev => {
          if (prev.length < CONFIG.BUBBLE_COUNT) {
            return [...prev, createBubble(Date.now(), dimensions.width, dimensions.height)]
          }
          return prev
        })
      }

      // Handle bio flashes
      if (currentTime - lastFlashRef.current > nextFlashIntervalRef.current) {
        lastFlashRef.current = currentTime
        nextFlashIntervalRef.current = CONFIG.FLASH_INTERVAL_MIN + 
          Math.random() * (CONFIG.FLASH_INTERVAL_MAX - CONFIG.FLASH_INTERVAL_MIN)
        
        const newFlash: BioFlash = {
          id: Date.now(),
          x: Math.random() * dimensions.width,
          y: Math.random() * dimensions.height,
          size: 30 + Math.random() * 60,
          hue: 170 + Math.random() * 40,
          startTime: currentTime,
          duration: CONFIG.FLASH_DURATION,
        }
        setBioFlashes(prev => [...prev, newFlash])
      }
      
      // Clean up expired flashes
      setBioFlashes(prev => prev.filter(f => currentTime - f.startTime < f.duration))

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [themeId, jellyfish.length, pickNewTarget, dimensions, prefersReducedMotion])

  // Reset on theme change
  useEffect(() => {
    if (themeId !== 'abyssal') {
      setJellyfish([])
      setParticles([])
      setBubbles([])
      setBioFlashes([])
    }
  }, [themeId])

  if (themeId !== 'abyssal') return null


  // Render with reduced motion fallback
  if (prefersReducedMotion) {
    return (
      <div 
        ref={containerRef}
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 3 }}
        aria-hidden="true"
      >
        <DepthFog />
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 3 }}
      aria-hidden="true"
    >
      {/* SVG Layer for jellyfish, bubbles, particles, light rays */}
      <svg 
        width="100%" 
        height="100%" 
        className="absolute inset-0"
        style={{ overflow: 'visible' }}
      >
        {/* Light rays from above */}
        <LightRays width={dimensions.width} height={dimensions.height} time={animationTime} />
        
        {/* Particles layer (behind jellyfish) */}
        <g>
          {particles.map(p => {
            if (p.type === 'bioluminescent') {
              return (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.y}
                  r={p.size}
                  fill={`hsla(${p.hue || 180}, 80%, 65%, ${p.opacity})`}
                  style={{ filter: `blur(0.5px) drop-shadow(0 0 ${p.size * 2}px hsla(${p.hue || 180}, 90%, 70%, ${p.opacity * 0.8}))` }}
                />
              )
            }
            return (
              <circle
                key={p.id}
                cx={p.x}
                cy={p.y}
                r={p.size}
                fill={p.type === 'plankton' 
                  ? `rgba(180, 200, 210, ${p.opacity})`
                  : `rgba(140, 160, 170, ${p.opacity})`
                }
              />
            )
          })}
        </g>
        
        {/* Bio flashes */}
        {bioFlashes.map(flash => {
          const progress = (animationTime - flash.startTime) / flash.duration
          const opacity = progress < 0.2 
            ? progress * 5 * 0.3 
            : progress > 0.7 
              ? (1 - progress) / 0.3 * 0.3 
              : 0.3
          const scale = 0.5 + progress * 0.5
          
          return (
            <circle
              key={flash.id}
              cx={flash.x}
              cy={flash.y}
              r={flash.size * scale}
              fill={`hsla(${flash.hue}, 80%, 60%, ${opacity * 0.3})`}
              style={{ 
                filter: `blur(${flash.size * 0.2}px)`,
                transition: 'none',
              }}
            />
          )
        })}
        
        {/* Jellyfish */}
        {jellyfish.map(jelly => (
          <JellyfishSVG 
            key={jelly.id} 
            jelly={jelly} 
            pulseProgress={pulseProgress}
          />
        ))}
        
        {/* Bubbles (in front) */}
        <defs>
          <radialGradient id="bubbleGradient" cx="30%" cy="30%">
            <stop offset="0%" stopColor="rgba(200, 230, 255, 0.4)" />
            <stop offset="50%" stopColor="rgba(150, 200, 230, 0.15)" />
            <stop offset="100%" stopColor="rgba(100, 180, 220, 0.05)" />
          </radialGradient>
        </defs>
        {bubbles.map(b => (
          <g key={b.id}>
            <circle
              cx={b.x}
              cy={b.y}
              r={b.size}
              fill="url(#bubbleGradient)"
              stroke={`rgba(200, 230, 255, ${b.opacity * 0.5})`}
              strokeWidth={0.5}
              opacity={b.opacity}
            />
            {/* Bubble highlight */}
            <ellipse
              cx={b.x - b.size * 0.25}
              cy={b.y - b.size * 0.25}
              rx={b.size * 0.2}
              ry={b.size * 0.15}
              fill={`rgba(255, 255, 255, ${b.opacity * 0.4})`}
            />
          </g>
        ))}
      </svg>
      
      {/* Depth fog overlay */}
      <DepthFog />
    </div>
  )
}

export default AbyssalBackground
