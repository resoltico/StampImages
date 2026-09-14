#!/usr/bin/env bash
#
# What the generated artifact does when macOS actually runs it.
#
# A fake proves that the modules agree with each other. Only osascript proves
# that the file pasted into a Shortcut runs at all: that the bundle has a
# global run(), that the JXA runtime accepts every construct in it, and that
# the tools it reaches for behave the way the fake says they do.
#
# And only real pixels prove that a stamp was drawn. Every scenario here ends
# by counting the pixels that are not the background, in the part of the
# photograph the settings said to draw on.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-macos)

cleanup() {
    rm -rf "$WORK"
}
trap cleanup EXIT

# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"

require_tools
test -f "$SCRIPT" || fail "no built artifact at $SCRIPT"

# The photographs are one flat grey, so any pixel that is not 110 is a pixel
# this program drew.
BACKGROUND=110
GREY="#6e6e6e"

stamp() {
    osascript -l JavaScript "$SCRIPT" -- --headless "$@"
}

# ---------------------------------------------------------------------------
# One photograph with a date and a place: the copy exists beside it, the
# original is untouched, and the stamp is where the settings said.
# ---------------------------------------------------------------------------

solid "$WORK/holiday.jpg" 900 600 "$GREY"
taken_at "$WORK/holiday.jpg" "2024:07:14 18:32:05" 56.9496 24.1052
BEFORE=$(shasum -a 256 < "$WORK/holiday.jpg")
settings_file "$WORK/settings.json" "Riga"

RECEIPT=$(stamp "$WORK/settings.json" "$WORK/holiday.jpg")

assert_contains "$RECEIPT" "holiday_stamped.jpg" "the copy is named in the receipt"
test -f "$WORK/holiday_stamped.jpg" || fail "no copy was written"
test "$BEFORE" = "$(shasum -a 256 < "$WORK/holiday.jpg")" ||
    fail "the original was modified"

test "$(vipsheader -f width "$WORK/holiday_stamped.jpg")" = "900" ||
    fail "the copy is not the size of the photograph"

DRAWN=$(stamped_pixels "$WORK/holiday_stamped.jpg" 380 440 520 160 "$BACKGROUND")
test "$DRAWN" -gt 500 || fail "nothing was drawn in the bottom right: $DRAWN"

EMPTY=$(stamped_pixels "$WORK/holiday_stamped.jpg" 0 0 400 300 "$BACKGROUND")
test "$EMPTY" -eq 0 || fail "something was drawn in the top left: $EMPTY"

# ---------------------------------------------------------------------------
# The position is obeyed: the same photograph, stamped in the other corner.
# ---------------------------------------------------------------------------

solid "$WORK/corner.jpg" 900 600 "$GREY"
taken_at "$WORK/corner.jpg" "2024:07:14 18:32:05" 56.9496 24.1052
settings_file "$WORK/top-left.json" "Riga" "top-left"

stamp "$WORK/top-left.json" "$WORK/corner.jpg" > /dev/null

TOP=$(stamped_pixels "$WORK/corner_stamped.jpg" 0 0 500 160 "$BACKGROUND")
BOTTOM=$(stamped_pixels "$WORK/corner_stamped.jpg" 400 440 500 160 "$BACKGROUND")
test "$TOP" -gt 500 || fail "nothing was drawn in the top left: $TOP"
test "$BOTTOM" -eq 0 || fail "something was drawn in the bottom right: $BOTTOM"

# ---------------------------------------------------------------------------
# A photograph that knows nothing about itself still gets the text somebody
# typed, and nothing standing in for what is missing.
# ---------------------------------------------------------------------------

solid "$WORK/anonymous.png" 600 400 "$GREY"
settings_file "$WORK/text-only.json" "Riga"

stamp "$WORK/text-only.json" "$WORK/anonymous.png" > /dev/null

ANONYMOUS=$(stamped_pixels "$WORK/anonymous_stamped.png" 200 280 400 120 "$BACKGROUND")
test "$ANONYMOUS" -gt 200 || fail "the typed text was not drawn: $ANONYMOUS"

# ---------------------------------------------------------------------------
# The copy is the kind of file the photograph was, and a second run does not
# overwrite the first.
# ---------------------------------------------------------------------------

stamp "$WORK/text-only.json" "$WORK/anonymous.png" > /dev/null
test -f "$WORK/anonymous_stamped_2.png" || fail "the second run overwrote the first"
test "$(vipsheader -f vips-loader "$WORK/anonymous_stamped.png")" = "pngload" ||
    fail "a PNG came back as something else"

printf 'macOS integration passed\n'
