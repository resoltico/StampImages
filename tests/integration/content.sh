#!/usr/bin/env bash
# Stamp inclusion tested through the shipped JXA and real image pixels.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-content)
trap 'rm -rf "$WORK"' EXIT
# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"
require_tools

stamp() {
    osascript -l JavaScript "$SCRIPT" -- --headless "$@"
}

pixel_difference() {
    vips subtract "$1" "$2" "$WORK/difference.v"
    vips abs "$WORK/difference.v" "$WORK/absolute.v"
    vips max "$WORK/absolute.v" | awk '{print $1}'
}

solid "$WORK/photo.png" 900 600 "#6e6e6e"
taken_at "$WORK/photo.png" "2024:07:14 18:32:05" 56.9496 24.1052
BEFORE=$(shasum -a 256 < "$WORK/photo.png")
settings_file "$WORK/off.json" "" "bottom-right" "iso-minutes" "none"
sed '/"coordinateFormat":/d' "$WORK/off.json" > "$WORK/default.json"
settings_file "$WORK/on.json" "" "bottom-right" "iso-minutes" "decimal"
settings_file "$WORK/dms.json" "" "bottom-right" "iso-minutes" "sexagesimal"

# A configuration is the whole of what a headless run is told: leaving the
# coordinate field out is refused, not read as Off, and nothing is written.
if stamp "$WORK/default.json" "$WORK/photo.png" > /dev/null 2> "$WORK/error"; then
    fail "a configuration without coordinateFormat was accepted"
fi
assert_contains "$(cat "$WORK/error")" "coordinate format" "the refusal names the missing setting"
test ! -e "$WORK/photo_stamped.png" || fail "a refused configuration wrote a copy"

OFF=$(stamp "$WORK/off.json" "$WORK/photo.png")
assert_contains "$OFF" '"missingMetadata":[]' "explicit Off is complete"
test "$(stamped_pixels "$WORK/photo_stamped.png" 380 440 520 160 110)" -gt 300 ||
    fail "date-only stamp drew no date"

stamp "$WORK/on.json" "$WORK/photo.png" > /dev/null
stamp "$WORK/dms.json" "$WORK/photo.png" > /dev/null
test "$(pixel_difference "$WORK/photo_stamped.png" "$WORK/photo_stamped_2.png")" != 0 ||
    fail "enabling coordinates did not change the stamp"
test "$(pixel_difference "$WORK/photo_stamped_2.png" "$WORK/photo_stamped_3.png")" != 0 ||
    fail "decimal and degrees/minutes/seconds drew the same stamp"
test "$BEFORE" = "$(shasum -a 256 < "$WORK/photo.png")" || fail "the original changed"

# Off is not redaction: do not let a later implementation silently imply that it is.
assert_contains "$(exiftool -s3 -n -GPSLatitude "$WORK/photo_stamped.png")" \
    "56.9496" "the copy can retain embedded GPS even when the visible stamp is off"

# A missing disabled field is not an omission; a requested missing field is.
solid "$WORK/no-gps.png" 900 600 "#6e6e6e"
taken_at "$WORK/no-gps.png" "2024:07:14 18:32:05"
stamp "$WORK/off.json" "$WORK/no-gps.png" > /dev/null
if stamp "$WORK/on.json" "$WORK/no-gps.png" > "$WORK/partial.json" 2> "$WORK/error"; then
    fail "missing requested coordinates must not be complete headless success"
fi
assert_contains "$(cat "$WORK/partial.json")" '"fields":["GPS coordinates"]' "missing GPS is reported"
assert_contains "$(cat "$WORK/error")" "1 copy missing requested metadata" "incomplete status explains why"
test -f "$WORK/no-gps_stamped_2.png" || fail "the date-only partial copy was lost"

solid "$WORK/no-date.png" 900 600 "#6e6e6e"
settings_file "$WORK/caption-and-date.json" "caption" "bottom-right" "iso-minutes" "none"
if stamp "$WORK/caption-and-date.json" "$WORK/no-date.png" > "$WORK/partial.json" 2> "$WORK/error"; then
    fail "a caption must not hide a missing requested date"
fi
assert_contains "$(cat "$WORK/partial.json")" '"fields":["date/time"]' "missing date is reported"
test -f "$WORK/no-date_stamped.png" || fail "the caption-only partial copy was lost"
printf 'macOS stamp content integration passed\n'
