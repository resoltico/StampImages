#!/usr/bin/env bash
#
# What colour the caption actually is.
#
# The stamp's colour is moved into the photograph's own space before it is
# painted, because numbers with no profile mean something different from the
# same numbers read through one. A space that cannot hold the colour is the
# case that taught this: moving #FF3B30 into a grey profile leaves one number,
# so the caption came out grey and the run reported the colour as handled.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-colour)
trap 'rm -rf "$WORK"' EXIT

# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"

require_tools
test -f "$SCRIPT" || fail "no built artifact at $SCRIPT"

GREY_PROFILE="/System/Library/ColorSync/Profiles/Generic Gray Gamma 2.2 Profile.icc"
RED="#FF3B30"

stamp() {
    osascript -l JavaScript "$SCRIPT" -- --headless "$@"
}

# A photograph that stores only greys, and says so with a profile of its own.
vips black "$WORK/flat.v" 900 600 --bands 1
vips linear "$WORK/flat.v" "$WORK/grey.v" 0 200
vips copy "$WORK/grey.v" "$WORK/grey.jpg[Q=90]"
exiftool -overwrite_original -q "-icc_profile<=$GREY_PROFILE" "$WORK/grey.jpg"

test "$(vipsheader -f bands "$WORK/grey.jpg")" = 1 ||
    fail "the fixture is not a grey photograph"

# ---------------------------------------------------------------------------
# A grey caption on it stays grey, and so does the copy. The defaults are
# greys, so this is the ordinary run and nothing about it should change.
# ---------------------------------------------------------------------------

settings_file "$WORK/white.json" "Riga"
stamp "$WORK/white.json" "$WORK/grey.jpg" > "$WORK/receipt.json"

test "$(vipsheader -f bands "$WORK/grey_stamped.jpg")" = 1 ||
    fail "a grey caption on a grey photograph made the copy colour"

# ---------------------------------------------------------------------------
# A caption the photograph's space cannot hold: the copy is read into sRGB so
# the colour survives, and the run says how many it did that to.
# ---------------------------------------------------------------------------

settings_file "$WORK/red.json" "HHHH"
sed -i '' -e "s/\"textColour\": \"[^\"]*\"/\"textColour\": \"$RED\"/" \
    -e 's/"size": [0-9]*/"size": 90/' \
    -e 's/"outlineWidth": [0-9]*/"outlineWidth": 0/' \
    -e 's/"position": "[^"]*"/"position": "top-left"/' "$WORK/red.json"

rm -f "$WORK/grey_stamped.jpg"
stamp "$WORK/red.json" "$WORK/grey.jpg" > "$WORK/receipt.json"

test "$(vipsheader -f bands "$WORK/grey_stamped.jpg")" = 3 ||
    fail "the copy is still grey, so the caption cannot be the colour that was chosen"

assert_contains "$(cat "$WORK/receipt.json")" '"expanded":1' "and the run counted it"

# The caption is red where it was drawn: inside the first stroke, measured
# rather than guessed, and red means the channels do not agree.
# shellcheck disable=SC2086
read -r R G B <<< "$(vips getpoint "$WORK/grey_stamped.jpg" 30 60 | tr -d "[]," | tr -s " ")"

test "$R" -gt 150 || fail "the caption is not red: $R $G $B"
test "$G" -lt 120 || fail "the caption is not red: $R $G $B"
test "$R" -ne "$G" || fail "the caption came out grey: $R $G $B"

# ---------------------------------------------------------------------------
# And the photograph itself is untouched by the reading: a grey of 200 comes
# back as 200, 200, 200.
# ---------------------------------------------------------------------------

# shellcheck disable=SC2086
read -r PR PG PB <<< "$(vips getpoint "$WORK/grey_stamped.jpg" 800 500 | tr -d "[]," | tr -s " ")"

test "$PR" = "$PG" && test "$PG" = "$PB" ||
    fail "the picture itself was changed: $PR $PG $PB"
test "$PR" -ge 195 && test "$PR" -le 205 ||
    fail "the picture's greys did not survive the reading: $PR"

printf 'macOS colour integration passed\n'
