#!/usr/bin/env bash
#
# Photograph fixtures for the macOS integration scenarios.
#
# Everything here is generated. A photograph with real capture metadata is
# exactly what must not be committed to a public repository, so where a test
# needs metadata it is written onto a generated image rather than borrowed
# from somebody's camera.

# solid <path> <width> <height> <fill>
#
# A plain rectangle of one colour, saved as whatever the path's extension
# says. The colour is uniform on purpose: a stamped pixel is then any pixel
# that is not that colour.
solid() {
    cat > "$1.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="$2" height="$3">
  <rect width="$2" height="$3" fill="$4"/>
</svg>
SVG
    vips copy "$1.svg" "$1"
    rm -f "$1.svg"
}

# taken_at <path> <exif date> [latitude] [longitude]
#
# What a camera would have written. Both halves of a coordinate or neither,
# which is the rule the program reads them by.
taken_at() {
    local arguments=(-overwrite_original -q "-DateTimeOriginal=$2")

    if [ "$#" -gt 2 ]; then
        arguments+=(
            "-GPSLatitude=$3" "-GPSLatitudeRef=N"
            "-GPSLongitude=$4" "-GPSLongitudeRef=E"
        )
    fi

    exiftool "${arguments[@]}" "$1"
}

# settings_file <path> [customText] [position] [dateFormat] [coordinateFormat]
#
# A complete configuration, which is the whole of what a headless run is told.
# Every field is named rather than left out: a run that fell back to a default
# would be a test of the default.
settings_file() {
    cat > "$1" <<JSON
{
  "font": "Helvetica Neue Bold",
  "size": 28,
  "textColour": "#FFFFFF",
  "outlineColour": "#000000",
  "outlineWidth": 2,
  "position": "${3:-bottom-right}",
  "margin": 24,
  "dateFormat": "${4:-iso-minutes}",
  "coordinateFormat": "${5:-decimal}",
  "customText": "${2:-}"
}
JSON
}

# profiled <path> <profile name>
#
# A photograph whose numbers are read through a profile, which is what every
# recent iPhone photograph is.
profiled() {
    exiftool -overwrite_original -q \
        "-icc_profile<=/System/Library/ColorSync/Profiles/$2.icc" "$1"
}

require_tools() {
    local tool
    for tool in osascript vips vipsheader exiftool cmp; do
        command -v "$tool" >/dev/null
    done
}
