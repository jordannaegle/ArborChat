#!/usr/bin/env python3
"""
Prepare complete iconset from existing icons and generate themed variants.
"""

from PIL import Image
import os
import subprocess
import shutil

BASE_DIR = '/Users/cory.naegle/ArborChat/build'
ICONSET_DIR = os.path.join(BASE_DIR, 'icon.iconset')

# Required icon sizes for macOS .icns
REQUIRED_SIZES = [
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

def prepare_iconset():
    """Generate all required icon sizes from the largest available."""
    print("=" * 60)
    print("Preparing Complete Iconset")
    print("=" * 60)
    
    # Find the largest available icon to use as source
    source_img = None
    source_size = 0
    
    for filename, size in sorted(REQUIRED_SIZES, key=lambda x: -x[1]):
        path = os.path.join(ICONSET_DIR, filename)
        if os.path.exists(path):
            img = Image.open(path)
            if img.size[0] >= source_size:
                source_img = img.convert('RGBA')
                source_size = img.size[0]
                print(f"Using source: {filename} ({source_size}x{source_size})")
                break
    
    if source_img is None:
        print("ERROR: No source icon found!")
        return False
    
    # Generate all required sizes
    print("\nGenerating icons:")
    for filename, size in REQUIRED_SIZES:
        target_path = os.path.join(ICONSET_DIR, filename)
        
        if size <= source_size:
            # Downscale with high quality
            resized = source_img.resize((size, size), Image.Resampling.LANCZOS)
        else:
            # Upscale (not ideal but necessary)
            resized = source_img.resize((size, size), Image.Resampling.LANCZOS)
            print(f"  WARNING: Upscaling to {size}px from {source_size}px")
        
        resized.save(target_path, 'PNG')
        print(f"  Created: {filename} ({size}x{size})")
    
    return True

def main():
    if prepare_iconset():
        print("\n✅ Iconset prepared successfully!")
        print("\nNow running themed icon generator...")
        
        # Run the themed icon generator
        os.chdir(BASE_DIR)
        result = subprocess.run(['python3', 'generate_themed_icons.py'], 
                              capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
    else:
        print("\n❌ Failed to prepare iconset")

if __name__ == '__main__':
    main()
