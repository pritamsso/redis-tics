#!/bin/bash

# Icon generation script for Redis Tics
# This script converts the SVG icon to all required PNG formats

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ICONS_DIR="$PROJECT_ROOT/src-tauri/icons"
SVG_FILE="$ICONS_DIR/icon.svg"

echo "🎨 Generating icons for Redis Tics..."

# Check if rsvg-convert is available
if ! command -v rsvg-convert &> /dev/null; then
    echo "❌ rsvg-convert not found. Installing librsvg..."
    
    if command -v brew &> /dev/null; then
        brew install librsvg
    elif command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y librsvg2-bin
    else
        echo "❌ Please install librsvg manually:"
        echo "   macOS: brew install librsvg"
        echo "   Linux: sudo apt-get install librsvg2-bin"
        exit 1
    fi
fi

# Generate PNG icons at various sizes
echo "📦 Generating PNG files..."

rsvg-convert -w 32 -h 32 "$SVG_FILE" -o "$ICONS_DIR/32x32.png"
rsvg-convert -w 128 -h 128 "$SVG_FILE" -o "$ICONS_DIR/128x128.png"
rsvg-convert -w 256 -h 256 "$SVG_FILE" -o "$ICONS_DIR/128x128@2x.png"
rsvg-convert -w 512 -h 512 "$SVG_FILE" -o "$ICONS_DIR/icon.png"

# Windows Store logos
rsvg-convert -w 30 -h 30 "$SVG_FILE" -o "$ICONS_DIR/Square30x30Logo.png"
rsvg-convert -w 44 -h 44 "$SVG_FILE" -o "$ICONS_DIR/Square44x44Logo.png"
rsvg-convert -w 71 -h 71 "$SVG_FILE" -o "$ICONS_DIR/Square71x71Logo.png"
rsvg-convert -w 89 -h 89 "$SVG_FILE" -o "$ICONS_DIR/Square89x89Logo.png"
rsvg-convert -w 107 -h 107 "$SVG_FILE" -o "$ICONS_DIR/Square107x107Logo.png"
rsvg-convert -w 142 -h 142 "$SVG_FILE" -o "$ICONS_DIR/Square142x142Logo.png"
rsvg-convert -w 150 -h 150 "$SVG_FILE" -o "$ICONS_DIR/Square150x150Logo.png"
rsvg-convert -w 284 -h 284 "$SVG_FILE" -o "$ICONS_DIR/Square284x284Logo.png"
rsvg-convert -w 310 -h 310 "$SVG_FILE" -o "$ICONS_DIR/Square310x310Logo.png"
rsvg-convert -w 50 -h 50 "$SVG_FILE" -o "$ICONS_DIR/StoreLogo.png"

echo "✅ PNG icons generated successfully!"

# Generate .icns for macOS (requires iconutil on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Generating macOS .icns file..."
    
    ICONSET_DIR="$ICONS_DIR/icon.iconset"
    mkdir -p "$ICONSET_DIR"
    
    rsvg-convert -w 16 -h 16 "$SVG_FILE" -o "$ICONSET_DIR/icon_16x16.png"
    rsvg-convert -w 32 -h 32 "$SVG_FILE" -o "$ICONSET_DIR/icon_16x16@2x.png"
    rsvg-convert -w 32 -h 32 "$SVG_FILE" -o "$ICONSET_DIR/icon_32x32.png"
    rsvg-convert -w 64 -h 64 "$SVG_FILE" -o "$ICONSET_DIR/icon_32x32@2x.png"
    rsvg-convert -w 128 -h 128 "$SVG_FILE" -o "$ICONSET_DIR/icon_128x128.png"
    rsvg-convert -w 256 -h 256 "$SVG_FILE" -o "$ICONSET_DIR/icon_128x128@2x.png"
    rsvg-convert -w 256 -h 256 "$SVG_FILE" -o "$ICONSET_DIR/icon_256x256.png"
    rsvg-convert -w 512 -h 512 "$SVG_FILE" -o "$ICONSET_DIR/icon_256x256@2x.png"
    rsvg-convert -w 512 -h 512 "$SVG_FILE" -o "$ICONSET_DIR/icon_512x512.png"
    rsvg-convert -w 1024 -h 1024 "$SVG_FILE" -o "$ICONSET_DIR/icon_512x512@2x.png"
    
    iconutil -c icns "$ICONSET_DIR" -o "$ICONS_DIR/icon.icns"
    rm -rf "$ICONSET_DIR"
    
    echo "✅ macOS .icns generated successfully!"
fi

# Generate .ico for Windows (requires ImageMagick)
if command -v magick &> /dev/null; then
    echo "🪟 Generating Windows .ico file..."
    
    # Create temporary PNGs for .ico generation
    TMP_DIR=$(mktemp -d)
    rsvg-convert -w 256 -h 256 "$SVG_FILE" -o "$TMP_DIR/256.png"
    rsvg-convert -w 128 -h 128 "$SVG_FILE" -o "$TMP_DIR/128.png"
    rsvg-convert -w 96 -h 96 "$SVG_FILE" -o "$TMP_DIR/96.png"
    rsvg-convert -w 64 -h 64 "$SVG_FILE" -o "$TMP_DIR/64.png"
    rsvg-convert -w 48 -h 48 "$SVG_FILE" -o "$TMP_DIR/48.png"
    rsvg-convert -w 32 -h 32 "$SVG_FILE" -o "$TMP_DIR/32.png"
    rsvg-convert -w 16 -h 16 "$SVG_FILE" -o "$TMP_DIR/16.png"
    
    magick "$TMP_DIR/256.png" "$TMP_DIR/128.png" "$TMP_DIR/96.png" "$TMP_DIR/64.png" "$TMP_DIR/48.png" "$TMP_DIR/32.png" "$TMP_DIR/16.png" "$ICONS_DIR/icon.ico"
    
    rm -rf "$TMP_DIR"
    
    echo "✅ Windows .ico generated successfully!"
else
    echo "⚠️  ImageMagick not found. Skipping .ico generation."
    echo "   Install with: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)"
fi

echo ""
echo "🎉 All icons generated successfully!"
echo "📁 Icons location: $ICONS_DIR"
