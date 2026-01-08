import React from 'react'
import { useTheme } from '../../contexts/ThemeContext'

// Import all themed icons
import iconMidnight from '../../../../../resources/icons/icon-midnight.png'
import iconAuroraGlass from '../../../../../resources/icons/icon-aurora-glass.png'
import iconLinearMinimal from '../../../../../resources/icons/icon-linear-minimal.png'
import iconForestDeep from '../../../../../resources/icons/icon-forest-deep.png'
import iconNeonCyber from '../../../../../resources/icons/icon-neon-cyber.png'
import iconGoldenHour from '../../../../../resources/icons/icon-golden-hour.png'
import iconAbyssal from '../../../../../resources/icons/icon-abyssal.png'
import iconCelestial from '../../../../../resources/icons/icon-celestial.png'
import iconEmber from '../../../../../resources/icons/icon-ember.png'

// Map theme IDs to icon imports
const themeIcons: Record<string, string> = {
  'midnight': iconMidnight,
  'aurora-glass': iconAuroraGlass,
  'linear-minimal': iconLinearMinimal,
  'forest-deep': iconForestDeep,
  'neon-cyber': iconNeonCyber,
  'golden-hour': iconGoldenHour,
  'abyssal': iconAbyssal,
  'celestial': iconCelestial,
  'ember': iconEmber,
}

interface ArborLogoProps {
  size?: number
  className?: string
}

/**
 * ArborChat Logo Component
 * Displays the themed app icon that matches the dock icon exactly.
 * Automatically switches based on current theme.
 */
export const ArborLogo: React.FC<ArborLogoProps> = ({ size = 32, className = '' }) => {
  const { themeId } = useTheme()
  
  // iOS-style corner radius is ~22% of size
  const borderRadius = Math.round(size * 0.22)
  
  // Get the icon for current theme, fallback to midnight
  const iconSrc = themeIcons[themeId] || themeIcons['midnight']

  return (
    <img
      src={iconSrc}
      width={size}
      height={size}
      alt="ArborChat"
      className={className}
      style={{ 
        borderRadius,
        display: 'block',
      }}
      draggable={false}
    />
  )
}

export default ArborLogo
