#!/usr/bin/env bash
#
# What a stamped copy is, and what this refuses to make one of.
#
# Every case here was a defect first. A caption with an ampersand failed the
# photograph outright; a photograph with nothing to stamp failed it with a
# message about a vips flag; a stamp too large for its photograph was cropped
# and reported as a success; and every copy was re-encoded at the encoder's
# own default quality, which is lower than any of them.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-copies)

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

BACKGROUND=110
GREY="#6e6e6e"

stamp() {
    osascript -l JavaScript "$SCRIPT" -- --headless "$@"
}

# ---------------------------------------------------------------------------
# A caption is text. vips reads pango markup, so an ampersand used to refuse
# the photograph and "<b>x</b>" used to come out bold.
# ---------------------------------------------------------------------------

solid "$WORK/family.jpg" 900 600 "$GREY"
taken_at "$WORK/family.jpg" "2024:07:14 18:32:05"
settings_file "$WORK/ampersand.json" "Mum & Dad <b>x</b>"

stamp "$WORK/ampersand.json" "$WORK/family.jpg" > /dev/null

DRAWN=$(stamped_pixels "$WORK/family_stamped.jpg" 380 440 520 160 "$BACKGROUND")
test "$DRAWN" -gt 500 || fail "the caption was not drawn: $DRAWN"

# ---------------------------------------------------------------------------
# A photograph the request does not apply to is neither a copy nor a failure.
# ---------------------------------------------------------------------------

solid "$WORK/scan.png" 600 400 "$GREY"
settings_file "$WORK/metadata-only.json" "" "bottom-right" "iso-minutes" "none"

if stamp "$WORK/metadata-only.json" "$WORK/scan.png" \
    > "$WORK/out.txt" 2> "$WORK/err.txt"; then
    fail "a run that stamped nothing should not report complete success"
fi

RECEIPT=$(cat "$WORK/out.txt")
assert_contains "$RECEIPT" '"nothing"' "the third column exists"
assert_contains "$RECEIPT" "does not say when it was taken" "in the product's words"
assert_not_contains "$RECEIPT" "no text to render" "not in the renderer's"
assert_contains "$(cat "$WORK/err.txt")" "1 with nothing to stamp" "and is counted"
test ! -f "$WORK/scan_stamped.png" || fail "a copy was published with nothing on it"

# ---------------------------------------------------------------------------
# A stamp that cannot fit is refused rather than cropped.
# ---------------------------------------------------------------------------

solid "$WORK/small.jpg" 120 80 "$GREY"
settings_file "$WORK/huge.json" "A very long caption indeed"
sed -i '' 's/"size": 28/"size": 90/' "$WORK/huge.json"

if stamp "$WORK/huge.json" "$WORK/small.jpg" \
    > "$WORK/out.txt" 2> "$WORK/err.txt"; then
    fail "a stamp that does not fit should not be published"
fi

assert_contains "$(cat "$WORK/out.txt")" "does not fit on this photograph" "said plainly"
assert_contains "$(cat "$WORK/out.txt")" "120 by 80 pixels" "with both sizes in it"
test ! -f "$WORK/small_stamped.jpg" || fail "a cropped stamp was published"

# ---------------------------------------------------------------------------
# The copy is a copy: the same picture, its metadata, and a quality nobody has
# to accept by default.
# ---------------------------------------------------------------------------

QUALITY=$(exiftool -q -S -n -JPEGQualityEstimate "$WORK/family_stamped.jpg" |
    awk '{ print $2 }')
test "$QUALITY" -ge 90 || fail "the copy was re-encoded at quality $QUALITY"

assert_contains \
    "$(exiftool -q -S -DateTimeOriginal "$WORK/family_stamped.jpg")" \
    "2024:07:14 18:32:05" \
    "the copy keeps what the photograph said about itself"

# ---------------------------------------------------------------------------
# The colour that was chosen is the colour that gets painted, whatever space
# the photograph's numbers are read in.
# ---------------------------------------------------------------------------

solid "$WORK/wide.jpg" 600 200 "#282828"
profiled "$WORK/wide.jpg" "Display P3"
solid "$WORK/plain.jpg" 600 200 "#282828"
settings_file "$WORK/red.json" "HHHH"
sed -i '' -e 's/"size": 28/"size": 90/' -e 's/"#FFFFFF"/"#FF3B30"/' \
    -e 's/"position": "bottom-right"/"position": "top-left"/' \
    -e 's/"outlineWidth": 2/"outlineWidth": 0/' "$WORK/red.json"

stamp "$WORK/red.json" "$WORK/wide.jpg" "$WORK/plain.jpg" > /dev/null

# The numbers differ, deliberately: the same red in two spaces is two sets of
# numbers. What has to match is what they render as.
# Inside the first stroke of the first letter, measured rather than guessed.
GLYPH="30 60"
# shellcheck disable=SC2086
WIDE=$(vips getpoint "$WORK/wide_stamped.jpg" $GLYPH | tr -d "[]," | tr -s " ")
# shellcheck disable=SC2086
PLAIN=$(vips getpoint "$WORK/plain_stamped.jpg" $GLYPH | tr -d "[]," | tr -s " ")
test "$WIDE" != "$PLAIN" ||
    fail "the colour was not moved into the photograph's space: $WIDE"

for file in wide plain; do
    vips icc_import "$WORK/${file}_stamped.jpg" "$WORK/$file.v" \
        --embedded --pcs lab 2> /dev/null ||
        vips colourspace "$WORK/${file}_stamped.jpg" "$WORK/$file.v" lab
done

# shellcheck disable=SC2086
read -r WIDE_L WIDE_A WIDE_B <<< "$(vips getpoint "$WORK/wide.v" $GLYPH | tr -d "[]," | tr -s " ")"
# shellcheck disable=SC2086
read -r PLAIN_L PLAIN_A PLAIN_B <<< "$(vips getpoint "$WORK/plain.v" $GLYPH | tr -d "[]," | tr -s " ")"

DIFFERENCE=$(awk -v l1="$WIDE_L" -v a1="$WIDE_A" -v b1="$WIDE_B" \
    -v l2="$PLAIN_L" -v a2="$PLAIN_A" -v b2="$PLAIN_B" \
    'BEGIN { printf "%d", sqrt((l1-l2)^2 + (a1-a2)^2 + (b1-b2)^2) }')

# A difference of 2 is visible. Painted as plain numbers this was about 19.
test "$DIFFERENCE" -le 2 ||
    fail "the caption is a different colour in the two copies: $DIFFERENCE"

printf 'macOS copies passed\n'
