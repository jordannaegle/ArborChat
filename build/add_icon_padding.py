#!/usr/bin/env python3
"""
Add internal padding to icons to match macOS HIG.
macOS app icons should have ~8% padding on each side, making the 
actual icon content ~84% of the total canvas size.
"""

from PIL import Image
import os

BASE_DIR = '/Users/cory.naegle/ArborChat/build'
ICONSET_DIR = os.path.join(BASE_DIR, 'icon.iconset')

# macOS HIG: Icon content should be ~84% of canvas (8% padding each side)
CONTENT_RATIO = 0.84

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

def add_padding_to_icon(source_path, target_path, canvas_size):
    """
    Add transparent padding around an icon.
    The icon content will be scaled to 84% and centered.
    """
    # Load the original icon
    img = Image.open(source_path).convert('RGBA')
    
    # Calculate the new content size (84% of canvas)
    content_size = int(canvas_size * CONTENT_RATIO)
    
    # Resize the icon to the content size with high quality
    resized = img.resize((content_size, content_size), Image.Resampling.LANCZOS)
    
    # Create a new transparent canvas
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    
    # Calculate position to center the icon
    offset = (canvas_size - content_size) // 2
    
    # Paste the resized icon onto the canvas
    canvas.paste(resized, (offset, offset), resized)
    
    # Save the result
    canvas.save(target_path, 'PNG')
    return True

def main():
    print("=" * 60)
    print("Adding macOS HIG Padding to Icons")
    print(f"Content ratio: {CONTENT_RATIO * 100}% (8% padding each side)")
    print("=" * 60)
    print()
    
    # Backup original iconset
    backup_dir = os.path.join(BASE_DIR, 'icon.iconset.original')
    if not os.path.exists(backup_dir):
        import shutil
        shutil.copytree(ICONSET_DIR, backup_dir)
        print(f"Backed up original icons to: {backup_dir}")
    
    for filename, size in ICON_SIZES:
        source_path = os.path.join(ICONSET_DIR, filename)
        
        if os.path.exists(source_path):
            add_padding_to_icon(source_path, source_path, size)
            print(f"  ✓ {filename} ({size}x{size})")
        else:
            print(f"  ✗ {filename} not found")
    
    print()
    print("=" * 60)
    print("Done! Icons now have macOS HIG-compliant padding.")
    print("Run generate_themed_icons.py to regenerate themed variants.")
    print("=" * 60)

if __name__ == '__main__':
    main()
