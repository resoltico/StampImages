#!/usr/bin/env bash
#
# Which face a copy is stamped in.
#
# pango answers every name: asked for one it cannot place it draws in a default
# face and says nothing. So a name nobody verified is a stamp in a face nobody
# chose -- and the form's list is verified by drawing with it, while a name
# typed there or written into a configuration is verified the same way before
# the run starts. Only the second half can be exercised without a person.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-typeface)
trap 'rm -rf "$WORK"' EXIT

# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"

require_tools
test -f "$SCRIPT" || fail "no built artifact at $SCRIPT"

BACKGROUND=110
GREY="#6e6e6e"

stamp() {
    osascript -l JavaScript "$SCRIPT" -- --headless "$@"
}

# named <file> <face>
named() {
    settings_file "$1" "Riga"
    sed -i '' "s/\"font\": \"[^\"]*\"/\"font\": \"$2\"/" "$1"
    sed -i '' 's/"weight": "[^"]*"/"weight": "regular"/' "$1"
}

solid "$WORK/photo.jpg" 900 600 "$GREY"

# ---------------------------------------------------------------------------
# A face this Mac draws with is stamped, and the copy carries it.
# ---------------------------------------------------------------------------

named "$WORK/menlo.json" "Menlo"
stamp "$WORK/menlo.json" "$WORK/photo.jpg" > /dev/null

DRAWN=$(stamped_pixels "$WORK/photo_stamped.jpg" 380 440 520 160 "$BACKGROUND")
test "$DRAWN" -gt 100 || fail "nothing was drawn in the face that resolves: $DRAWN"

# ---------------------------------------------------------------------------
# A name no face answers to is refused, and nothing is published.
# ---------------------------------------------------------------------------

named "$WORK/nosuch.json" "Definitely Not A Font 12345"

if stamp "$WORK/nosuch.json" "$WORK/photo.jpg" > /dev/null 2> "$WORK/err.txt"; then
    fail "a configuration naming a face this Mac has not was accepted"
fi

assert_contains "$(cat "$WORK/err.txt")" \
    "does not draw with the typeface" "the refusal says what was wrong"
test ! -f "$WORK/photo_stamped_2.jpg" ||
    fail "a copy was stamped in a face nobody asked for"

# ---------------------------------------------------------------------------
# A family fontconfig would quietly stand in for is refused, however well the
# substitute draws. "Noto Serif" is the case that taught this: macOS ships 190
# script-specific Noto families and not that one, so fontconfig answers with a
# different family -- and drawing with it produces something that is not the
# fallback, so a drawing alone called it available.
# ---------------------------------------------------------------------------

named "$WORK/substituted.json" "Noto Serif"

if stamp "$WORK/substituted.json" "$WORK/photo.jpg" > /dev/null 2> "$WORK/err.txt"; then
    fail "a family fontconfig substitutes was accepted"
fi

assert_contains "$(cat "$WORK/err.txt")" \
    "does not draw with the typeface" "the substitution was caught"

# ---------------------------------------------------------------------------
# And a family fontconfig keeps but the renderer cannot draw. Measured:
# Helvetica, Times, Hoefler Text and Iowan Old Style all keep their names and
# all draw as the fallback, because the files macOS keeps them in are not ones
# freetype will open. Neither question is enough on its own.
# ---------------------------------------------------------------------------

named "$WORK/unrasterisable.json" "Helvetica"

if stamp "$WORK/unrasterisable.json" "$WORK/photo.jpg" > /dev/null 2> "$WORK/err.txt"; then
    fail "a family that keeps its name but draws as the fallback was accepted"
fi

# ---------------------------------------------------------------------------
# A family whose own name ends in a style word is asked for by that name.
#
# The description used to be "Family Size", and pango reads the words before
# the size as style instructions -- so "Times New Roman 40" asked for the
# family "Times New" and this face appeared to be missing. A comma ends the
# family, and the weight is a setting of its own.
# ---------------------------------------------------------------------------

named "$WORK/roman.json" "Times New Roman"
rm -f "$WORK/photo_stamped.jpg"
stamp "$WORK/roman.json" "$WORK/photo.jpg" > /dev/null

DRAWN=$(stamped_pixels "$WORK/photo_stamped.jpg" 380 440 520 160 "$BACKGROUND")
test "$DRAWN" -gt 100 || fail "Times New Roman did not draw: $DRAWN"

# ---------------------------------------------------------------------------
# And the weight reaches the renderer as a weight rather than as part of the
# name: bold is heavier, so it covers more pixels than regular.
# ---------------------------------------------------------------------------

named "$WORK/regular.json" "Georgia"
rm -f "$WORK/photo_stamped.jpg"
stamp "$WORK/regular.json" "$WORK/photo.jpg" > /dev/null
REGULAR=$(stamped_pixels "$WORK/photo_stamped.jpg" 380 440 520 160 "$BACKGROUND")

named "$WORK/bold.json" "Georgia"
sed -i '' 's/"weight": "[^"]*"/"weight": "bold"/' "$WORK/bold.json"
rm -f "$WORK/photo_stamped.jpg"
stamp "$WORK/bold.json" "$WORK/photo.jpg" > /dev/null
BOLD=$(stamped_pixels "$WORK/photo_stamped.jpg" 380 440 520 160 "$BACKGROUND")

test "$BOLD" -gt "$REGULAR" ||
    fail "bold covered no more than regular: $BOLD against $REGULAR"

printf 'macOS typeface integration passed\n'
