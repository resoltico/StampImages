#!/usr/bin/env bash
#
# Which face a copy is stamped in.
#
# pango answers every name: asked for one it cannot place it draws in a default
# face and says nothing. So a name nobody checked is a stamp in a face nobody
# chose. Every name is checked against the machine's own font catalog -- the
# one the renderer draws through -- before a run starts, and a typed name goes
# through exactly the same door a configuration file does. Only the second half
# can be exercised without a person.
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
GRAY="#6e6e6e"

stamp() {
    osascript -l JavaScript "$SCRIPT" -- --headless "$@"
}

# named <file> <face>
named() {
    settings_file "$1" "Riga"
    sed -i '' "s/\"font\": \"[^\"]*\"/\"font\": \"$2\"/" "$1"
}

# drawn_with <face> -- how many pixels the stamp covers, drawn in that face
drawn_with() {
    named "$WORK/case.json" "$1"
    rm -f "$WORK/photo_stamped.jpg"
    stamp "$WORK/case.json" "$WORK/photo.jpg" > /dev/null
    stamped_pixels "$WORK/photo_stamped.jpg" 380 440 520 160 "$BACKGROUND"
}

# refused <face> -- the run's complaint, or a failure if it was accepted
refused() {
    named "$WORK/case.json" "$1"
    rm -f "$WORK/photo_stamped.jpg"

    if stamp "$WORK/case.json" "$WORK/photo.jpg" > /dev/null 2> "$WORK/err.txt"; then
        fail "a configuration naming \"$1\" was accepted"
    fi

    test ! -f "$WORK/photo_stamped.jpg" ||
        fail "a copy was stamped in a face nobody asked for"
    cat "$WORK/err.txt"
}

solid "$WORK/photo.jpg" 900 600 "$GRAY"

# ---------------------------------------------------------------------------
# A family this Mac has is stamped, and the copy carries it.
# ---------------------------------------------------------------------------

DRAWN=$(drawn_with "Menlo")
test "$DRAWN" -gt 100 || fail "nothing was drawn in a family this Mac has: $DRAWN"

# ---------------------------------------------------------------------------
# A name no face answers to is refused, and nothing is published.
# ---------------------------------------------------------------------------

assert_contains "$(refused "Definitely Not A Font 12345")" \
    'has no typeface called "Definitely Not A Font 12345"' \
    "the refusal names what was asked for"

# ---------------------------------------------------------------------------
# A family the machine has, asked for in a style it has not, is told which
# styles it does come in. A sentence only a real catalog can write.
# ---------------------------------------------------------------------------

SAID=$(refused "Georgia Ultrablack")

assert_contains "$SAID" 'Georgia has no style called "Ultrablack"' \
    "the refusal separates a wrong style from an unknown family"
assert_contains "$SAID" "Bold Italic" "and says what the family comes in"

# ---------------------------------------------------------------------------
# A family whose own name ends in a style word is asked for by that name.
#
# The description used to be "Family Size", and pango reads the words before
# the size as style instructions -- so "Times New Roman 40" asked for the
# family "Times New" and this face appeared to be missing. A comma ends the
# family, and the style goes after it.
# ---------------------------------------------------------------------------

DRAWN=$(drawn_with "Times New Roman")
test "$DRAWN" -gt 100 || fail "Times New Roman did not draw: $DRAWN"

# ---------------------------------------------------------------------------
# A style reaches the renderer as a style rather than as part of the family
# name: bold is heavier, so it covers more pixels than regular.
# ---------------------------------------------------------------------------

REGULAR=$(drawn_with "Georgia")
BOLD=$(drawn_with "Georgia Bold")

test "$BOLD" -gt "$REGULAR" ||
    fail "bold covered no more than regular: $BOLD against $REGULAR"

# ---------------------------------------------------------------------------
# And a style no weight menu could have offered. Avenir comes in Book, Light,
# Medium, Heavy and Black -- a Regular-or-Bold setting reaches none of them,
# which is why the typeface is one name rather than a family and a weight.
#
# Asserted as two copies that differ rather than as one covering more pixels
# than the other: the count is of pixels that are not the background, and an
# outline two pixels wide puts a halo round every glyph, so a heavier face
# barely moves it. Measured: Avenir Light and Avenir Black come out within 7
# pixels of each other and are plainly different drawings.
# ---------------------------------------------------------------------------

LIGHT=$(drawn_with "Avenir Light")
test "$LIGHT" -gt 100 || fail "Avenir Light did not draw: $LIGHT"
mv "$WORK/photo_stamped.jpg" "$WORK/light.jpg"

BLACK=$(drawn_with "Avenir Black")
test "$BLACK" -gt 100 || fail "Avenir Black did not draw: $BLACK"

cmp -s "$WORK/light.jpg" "$WORK/photo_stamped.jpg" &&
    fail "Avenir Light and Avenir Black drew the same picture"

# A right-to-left caption must not reorder the date above it. Field
# regression: drawn in one layout with a Hebrew caption, "2026-09-09 14:30"
# came out "14:30 2026-09-09". The first line is compared pixel for pixel
# with the same photograph stamped without a caption; at top-left both start
# at the margin, so only a reordering can make them differ. The crop stops
# above the caption line.
solid "$WORK/bidi.png" 900 600 "$GRAY"
taken_at "$WORK/bidi.png" "2026:09:09 14:30:05"
cp "$WORK/bidi.png" "$WORK/bidi-plain.png"
settings_file "$WORK/rtl.json" "שלום עולם" top-left iso-minutes none
settings_file "$WORK/ltr.json" "" top-left iso-minutes none
stamp "$WORK/rtl.json" "$WORK/bidi.png" > /dev/null
stamp "$WORK/ltr.json" "$WORK/bidi-plain.png" > /dev/null
vips crop "$WORK/bidi_stamped.png" "$WORK/rtl-line.v" 0 0 450 50
vips crop "$WORK/bidi-plain_stamped.png" "$WORK/ltr-line.v" 0 0 450 50
vips subtract "$WORK/rtl-line.v" "$WORK/ltr-line.v" "$WORK/line-diff.v"
vips abs "$WORK/line-diff.v" "$WORK/line-abs.v"
test "$(vips max "$WORK/line-abs.v" | cut -d. -f1)" -le 1 ||
    fail "a right-to-left caption changed how the date line is drawn"

printf 'macOS typeface integration passed\n'
