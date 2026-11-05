#!/usr/bin/env bash
# Supported still-image encoders, animation rejection and actual decoded formats.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-formats)
trap 'rm -rf "$WORK"' EXIT
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"
# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
require_tools
settings_file "$WORK/settings.json" 'Format caption'
solid "$WORK/source.png" 600 400 '#6e6e6e'
for format in jpg jpeg png tif tiff webp heic heif avif; do
    vips copy "$WORK/source.png" "$WORK/photo.$format"
    BEFORE=$(shasum -a 256 < "$WORK/photo.$format")
    osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/settings.json" "$WORK/photo.$format" > "$WORK/receipt" 2> "$WORK/error"
    test -f "$WORK/photo_stamped.$format"
    test "$(vipsheader -f width "$WORK/photo_stamped.$format")" = 600
    test "$(vipsheader -f vips-loader "$WORK/photo_stamped.$format")" = "$(vipsheader -f vips-loader "$WORK/photo.$format")"
    test "$BEFORE" = "$(shasum -a 256 < "$WORK/photo.$format")"
    test "$(stamped_pixels "$WORK/photo_stamped.$format" 200 270 400 130 110)" -gt 100 || fail "$format drew no caption"
done
cp "$WORK/photo.avif" "$WORK/misnamed.heic"
osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/settings.json" "$WORK/misnamed.heic" > "$WORK/receipt" 2> "$WORK/error"
test -f "$WORK/misnamed_stamped.avif"
test "$(vipsheader -f heif-compression "$WORK/misnamed_stamped.avif")" = av1
vips colourspace "$WORK/source.png" "$WORK/cmyk.v" cmyk
vips copy "$WORK/cmyk.v" "$WORK/cmyk.jpg"
CMYK_BEFORE=$(shasum -a 256 < "$WORK/cmyk.jpg")
if osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/settings.json" "$WORK/cmyk.jpg" > "$WORK/receipt" 2> "$WORK/error"; then
    fail 'unsupported CMYK input was published'
fi
assert_contains "$(cat "$WORK/receipt")" 'unsupported-colour' 'the actual colour-model refusal is classified'
assert_contains "$(cat "$WORK/receipt")" 'RGB or greyscale' 'the operator gets the appropriate conversion instruction'
test "$CMYK_BEFORE" = "$(shasum -a 256 < "$WORK/cmyk.jpg")"
node "$ROOT/tests/integration/animated-png.mjs" "$WORK/animated.png"
solid "$WORK/second.png" 600 400 '#dedede'
vips join "$WORK/source.png" "$WORK/second.png" "$WORK/frames.v" vertical
vips webpsave "$WORK/frames.v" "$WORK/animated.webp" --page-height 400
vips tiffsave "$WORK/frames.v" "$WORK/multiple.tif" --page-height 400
for file in animated.png animated.webp multiple.tif; do
    if osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/settings.json" "$WORK/$file" > "$WORK/receipt" 2> "$WORK/error"; then
        fail "$file was silently reduced to its first frame"
    fi
    assert_contains "$(cat "$WORK/receipt")" 'multiple-images' 'multi-image content is refused'
    test ! -e "$WORK/${file%.*}_stamped.${file##*.}"
done
printf 'macOS format and animation integration passed\n'
