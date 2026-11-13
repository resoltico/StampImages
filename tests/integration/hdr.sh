#!/usr/bin/env bash
# HDR copies must contain stamped SDR pixels and no stale gain map.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
WORK=$(mktemp -d -t StampImages-hdr)
trap 'rm -rf "$WORK"' EXIT
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"
require_tools
ultra_hdr_jpeg "$WORK/photo.jpg"
taken_at "$WORK/photo.jpg" '2026:11:13 01:02:03' 10 20
exiftool -overwrite_original -XMP-dc:Title='Synthetic HDR' -IPTC:Caption-Abstract='Synthetic HDR' \
    -XMP-hdrgm:Version=1.0 -XMP-HDRGainMap:HDRGainMapVersion=1 -XMP-hdr:SceneReferred=True "$WORK/photo.jpg"
cp "$WORK/photo.jpg" "$WORK/no-icc.jpg"
exiftool -overwrite_original -icc_profile= "$WORK/no-icc.jpg"
cp "$WORK/photo.jpg" "$WORK/p3.jpg"
exiftool -overwrite_original '-icc_profile<=/System/Library/ColorSync/Profiles/Display P3.icc' "$WORK/p3.jpg"
for orientation in 6 8; do
    cp "$WORK/p3.jpg" "$WORK/rotated-$orientation.jpg"
    exiftool -overwrite_original "-Orientation#=$orientation" "-XMP-tiff:Orientation#=$orientation" "$WORK/rotated-$orientation.jpg"
done
for image in photo no-icc p3 rotated-6 rotated-8; do
    test "$(vipsheader -f vips-loader "$WORK/$image.jpg")" = uhdrload
    vipsheader -f gainmap-data "$WORK/$image.jpg" >/dev/null
done
head -c 400 "$WORK/photo.jpg" > "$WORK/damaged.jpg"
vips copy "$WORK/photo.jpg" "$WORK/unmapped.gif"
cp "$WORK/unmapped.gif" "$WORK/unmapped.png"
settings_file "$WORK/settings.json" HDR
node "$ROOT/tests/integration/hdr-contract.cjs" "$ROOT/dist/Stamp-Images.jxa" "$WORK"
