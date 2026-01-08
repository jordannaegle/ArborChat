#!/usr/bin/env python3
"""
Generate ArborChat app icons using PIL.
Creates a stylized tree on a themed background.
"""

from PIL import Image, ImageDraw
import math
import os
import subprocess
from pathlib import Path

# Midnight theme primary color
THEME_COLOR = (88, 101, 242)  # #5865f2 in RGB

def draw_ellipse_rotated(draw, center, rx, ry, angle, fill):
    """Draw a rotated ellipse by creating points and drawing a polygon."""
    cx, cy = center
    points = []
    for i in range(36):
        t = 2 * math.pi * i / 36
        x = rx * math.cos(t)
        y = ry * math.sin(t)
        # Rotate
        rad = math.radians(angle)
        x_rot = x * math.cos(rad) - y * math.sin(rad)
        y_rot = x * math.sin(rad) + y * math.cos(rad)
        points.append((cx + x_rot, cy + y_rot))
    draw.polygon(points, fill=fill)

def draw_bezier_branch(draw, points, width, fill):
    """Draw a curved branch using line segments approximating a bezier."""
    # Simple quadratic bezier approximation
    if len(points) >= 3:
        p0, p1, p2 = points[0], points[1], points[2]
        segments = 20
        prev = p0
        for i in range(1, segments + 1):
            t = i / segments
            # Quadratic bezier
            x = (1-t)**2 * p0[0] + 2*(1-t)*t * p1[0] + t**2 * p2[0]
            y = (1-t)**2 * p0[1] + 2*(1-t)*t * p1[1] + t**2 * p2[1]
            draw.line([prev, (x, y)], fill=fill, width=width)
            prev = (x, y)

def create_arbor_icon(size, output_path):
    """Create an ArborChat icon at the specified size."""
    # Create image with theme color background
    img = Image.new('RGBA', (size, size), THEME_COLOR + (255,))
    draw = ImageDraw.Draw(img)
    
    # Calculate iOS-style rounded corners (~22%)
    corner_radius = int(size * 0.22)
    
    # Create rounded rectangle mask
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (size-1, size-1)], corner_radius, fill=255)
    
    # Create a new image with the background and apply the mask
    bg = Image.new('RGBA', (size, size), THEME_COLOR + (255,))
    
    # Scale factor for drawing (base design is 512x512)
    scale = size / 512
    
    # Draw tree elements (white)
    white = (255, 255, 255, 255)
    
    # Offset to center the tree (scaled from transform translate)
    def s(val):
        """Scale a value from 512 base to current size with centering offset."""
        # The original SVG has: translate(256, 256) scale(0.75) translate(-256, -256)
        # This means the tree is centered and scaled to 75%
        centered = (val - 256) * 0.75 + 256
        return int(centered * scale)
    
    def sw(val):
        """Scale a width value."""
        return max(1, int(val * 0.75 * scale))
    
    # Main trunk
    trunk_points = [(s(248), s(480)), (s(248), s(320)), (s(264), s(320)), (s(264), s(480))]
    draw.polygon(trunk_points, fill=white)
    
    # Root flare left
    draw.polygon([(s(230), s(480)), (s(248), s(450)), (s(248), s(480))], fill=white)
    # Root flare right
    draw.polygon([(s(264), s(480)), (s(264), s(450)), (s(282), s(480))], fill=white)
    
    # Lower trunk widening (simplified)
    draw.polygon([
        (s(244), s(380)), (s(244), s(320)), (s(256), s(300)), 
        (s(268), s(320)), (s(268), s(380)), (s(256), s(395))
    ], fill=white)
    
    # Draw branches (simplified curved lines)
    branch_levels = [
        # (y_center, x_spread, droop, width)
        (340, 96, 20, 8),   # Level 1
        (300, 116, 10, 7),  # Level 2
        (260, 136, 0, 6),   # Level 3
        (220, 126, -10, 5), # Level 4
        (180, 106, -25, 4), # Level 5
        (140, 86, -30, 3),  # Level 6
    ]
    
    for y, spread, droop, width in branch_levels:
        # Left branch
        draw.line([
            (s(256), s(y)), 
            (s(256 - spread//2), s(y - 20 + droop)),
            (s(256 - spread), s(y + droop))
        ], fill=white, width=sw(width))
        # Right branch
        draw.line([
            (s(256), s(y)),
            (s(256 + spread//2), s(y - 20 + droop)),
            (s(256 + spread), s(y + droop))
        ], fill=white, width=sw(width))
    
    # Crown/Top
    draw.ellipse([
        (s(246), s(55)), (s(266), s(105))
    ], fill=white)
    
    # Draw leaves at various levels
    leaf_data = [
        # (cx, cy, rx, ry, angle)
        (160, 355, 12, 8, -30), (180, 340, 10, 6, -20),
        (352, 355, 12, 8, 30), (332, 340, 10, 6, 20),
        (140, 305, 14, 9, -25), (165, 290, 11, 7, -15),
        (372, 305, 14, 9, 25), (347, 290, 11, 7, 15),
        (120, 255, 15, 10, -20), (150, 242, 12, 8, -10),
        (392, 255, 15, 10, 20), (362, 242, 12, 8, 10),
        (130, 205, 14, 9, -15), (160, 192, 11, 7, -5),
        (382, 205, 14, 9, 15), (352, 192, 11, 7, 5),
        (150, 150, 13, 8, -10), (180, 155, 10, 6, 0),
        (362, 150, 13, 8, 10), (332, 155, 10, 6, 0),
        (170, 105, 12, 7, -5), (200, 95, 9, 5, 5),
        (342, 105, 12, 7, 5), (312, 95, 9, 5, -5),
    ]
    
    for cx, cy, rx, ry, angle in leaf_data:
        draw_ellipse_rotated(draw, (s(cx), s(cy)), sw(rx*2), sw(ry*2), angle, white)
    
    # Apply rounded corner mask
    final = Image.composite(img, Image.new('RGBA', (size, size), (0, 0, 0, 0)), mask)
    
    # Save
    final.save(output_path, 'PNG')
    print(f"Created: {output_path}")
    return final

def main():
    project_root = Path(__file__).parent.parent
    build_dir = project_root / "build"
    iconset_dir = build_dir / "icon.iconset"
    
    # Create directories
    build_dir.mkdir(exist_ok=True)
    iconset_dir.mkdir(exist_ok=True)
    
    # Required sizes for macOS iconset
    icon_specs = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png"),
    ]
    
    # Generate all sizes
    for size, filename in icon_specs:
        output_path = iconset_dir / filename
        create_arbor_icon(size, output_path)
    
    # Convert iconset to icns
    icns_path = build_dir / "icon.icns"
    result = subprocess.run([
        "iconutil", "-c", "icns", str(iconset_dir), "-o", str(icns_path)
    ], capture_output=True, text=True)
    
    if result.returncode == 0:
        print(f"\n✅ Successfully created: {icns_path}")
    else:
        print(f"❌ iconutil error: {result.stderr}")
    
    # Also create main icon.png (512x512)
    png_path = build_dir / "icon.png"
    create_arbor_icon(512, png_path)
    
    # Create ICO for Windows (multiple sizes in one file)
    try:
        ico_sizes = [16, 32, 48, 64, 128, 256]
        ico_images = []
        for size in ico_sizes:
            temp_path = build_dir / f"temp_ico_{size}.png"
            img = create_arbor_icon(size, temp_path)
            ico_images.append(Image.open(temp_path))
        
        ico_path = build_dir / "icon.ico"
        ico_images[0].save(ico_path, format='ICO', sizes=[(s, s) for s in ico_sizes])
        print(f"✅ Created: {ico_path}")
        
        # Cleanup temp files
        for size in ico_sizes:
            temp_path = build_dir / f"temp_ico_{size}.png"
            temp_path.unlink(missing_ok=True)
    except Exception as e:
        print(f"⚠️ Could not create ICO: {e}")
    
    print("\n🎉 Icon generation complete!")

if __name__ == "__main__":
    main()
