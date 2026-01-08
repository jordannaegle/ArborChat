#!/usr/bin/env python3
"""
Generate themed ArborChat icons from the base icon.
Each theme gets its own icon with the appropriate background color.
The tree stays white in all variants.
"""

from PIL import Image
import numpy as np
import os
import shutil
import subprocess

# Define theme colors (primary/button colors from each theme)
THEMES = {
    'midnight': '#5865f2',
    'aurora-glass': '#8b5cf6',
    'linear-minimal': '#3b82f6',
    'forest-deep': '#22c55e',
    'neon-cyber': '#f472b6',
    'golden-hour': '#d4a574',      # Amber gold - matches primary button color
    'abyssal': '#00d4aa',
    'celestial': '#ff6eb4',
    'ember': '#ff6b35'
}

# Icon sizes required for macOS .icns
ICON_SIZES = [
    ('icon_16x16.png', 16),
    ('icon_16x16@2x.png', 32),
    ('icon_32x32.png', 32),
    ('icon_32x32@2x.png', 64),
    ('icon_128x128.png', 128),
    ('icon_128x128@2x.png', 256),
    ('icon_256x256.png', 256),
    ('icon_256x256@2x.png', 512),
    ('icon_512x512.png', 512),
    ('icon_512x512@2x.png', 1024),
]

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def recolor_icon(source_path, target_path, new_bg_color):
    """
    Recolor an icon by replacing the background color with a new color.
    Keeps the white tree unchanged.
    """
    # Load image
    img = Image.open(source_path).convert('RGBA')
    data = np.array(img)
    
    # Extract channels
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    
    # The original background is approximately #5865f2 (blue-purple)
    # We need to detect pixels that are NOT white/near-white (the tree)
    # and replace them with the new background color
    
    # White/near-white threshold (the tree is white)
    white_threshold = 200
    is_white = (r > white_threshold) & (g > white_threshold) & (b > white_threshold)
    
    # Also consider transparent pixels (corners due to rounded rect)
    is_transparent = a < 128
    
    # Everything that's not white and not transparent is background
    is_background = ~is_white & ~is_transparent
    
    # Get new color
    new_r, new_g, new_b = hex_to_rgb(new_bg_color)
    
    # Apply new background color
    data[is_background, 0] = new_r
    data[is_background, 1] = new_g
    data[is_background, 2] = new_b
    
    # Save result
    result = Image.fromarray(data, 'RGBA')
    result.save(target_path)
    return True

def create_themed_iconset(theme_name, theme_color, base_iconset_path, output_dir):
    """Create a complete iconset for a theme."""
    iconset_name = f'icon-{theme_name}.iconset'
    iconset_path = os.path.join(output_dir, iconset_name)
    
    # Create iconset directory
    os.makedirs(iconset_path, exist_ok=True)
    
    # Process each icon size
    for filename, expected_size in ICON_SIZES:
        source_path = os.path.join(base_iconset_path, filename)
        target_path = os.path.join(iconset_path, filename)
        
        if os.path.exists(source_path):
            recolor_icon(source_path, target_path, theme_color)
            print(f"  Created {filename}")
        else:
            print(f"  WARNING: {filename} not found in source")
    
    return iconset_path

def convert_iconset_to_icns(iconset_path):
    """Convert an iconset to .icns using iconutil."""
    icns_path = iconset_path.replace('.iconset', '.icns')
    try:
        subprocess.run(['iconutil', '-c', 'icns', iconset_path], check=True)
        print(f"  Created {os.path.basename(icns_path)}")
        return icns_path
    except subprocess.CalledProcessError as e:
        print(f"  ERROR: Failed to create icns: {e}")
        return None

def main():
    base_path = '/Users/cory.naegle/ArborChat/build'
    base_iconset = os.path.join(base_path, 'icon.iconset')
    output_dir = os.path.join(base_path, 'themed-icons')
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    print("=" * 60)
    print("ArborChat Themed Icon Generator")
    print("=" * 60)
    print()
    
    for theme_name, theme_color in THEMES.items():
        print(f"\n[{theme_name}] Background: {theme_color}")
        print("-" * 40)
        
        # Create iconset
        iconset_path = create_themed_iconset(
            theme_name, 
            theme_color, 
            base_iconset, 
            output_dir
        )
        
        # Convert to .icns
        convert_iconset_to_icns(iconset_path)
    
    print()
    print("=" * 60)
    print("Done! All themed icons created in:")
    print(f"  {output_dir}")
    print("=" * 60)

if __name__ == '__main__':
    main()
