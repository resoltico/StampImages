#!/usr/bin/env bash
#
# What color the caption actually is.
#
# The stamp's color is moved into the photograph's own space before it is
# painted, because numbers with no profile mean something different from the
# same numbers read through one. A space that cannot hold the color is the
# case that taught this: moving #FF3B30 into a gray profile leaves one number,
# so the caption came out gray and the run reported the color as handled.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-color)
trap 'rm -rf "$WORK"' EXIT

# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"

require_tools
test -f "$SCRIPT" || fail "no built artifact at $SCRIPT"

GRAY_PROFILE="/System/Library/ColorSync/Profiles/Generic Gray Gamma 2.2 Profile.icc"
RED="#FF3B30"

stamp() {
    osascript -l JavaScript "$SCRIPT" -- --headless "$@"
}

# A photograph that stores only grays, and says so with a profile of its own.
vips black "$WORK/flat.v" 900 600 --bands 1
vips linear "$WORK/flat.v" "$WORK/gray.v" 0 200
vips copy "$WORK/gray.v" "$WORK/gray.jpg[Q=90]"
exiftool -overwrite_original -q "-icc_profile<=$GRAY_PROFILE" "$WORK/gray.jpg"

test "$(vipsheader -f bands "$WORK/gray.jpg")" = 1 ||
    fail "the fixture is not a gray photograph"

# ---------------------------------------------------------------------------
# A gray caption on it stays gray, and so does the copy. The defaults are
# grays, so this is the ordinary run and nothing about it should change.
# ---------------------------------------------------------------------------

settings_file "$WORK/white.json" "Riga"
stamp "$WORK/white.json" "$WORK/gray.jpg" > "$WORK/receipt.json"

test "$(vipsheader -f bands "$WORK/gray_stamped.jpg")" = 1 ||
    fail "a gray caption on a gray photograph made the copy color"

# ---------------------------------------------------------------------------
# A caption the photograph's space cannot hold: the copy is read into sRGB so
# the color survives, and the run says how many it did that to.
# ---------------------------------------------------------------------------

settings_file "$WORK/red.json" "HHHH"
sed -i '' -e "s/\"textColor\": \"[^\"]*\"/\"textColor\": \"$RED\"/" \
    -e 's/"size": [0-9]*/"size": 90/' \
    -e 's/"outlineWidth": [0-9]*/"outlineWidth": 0/' \
    -e 's/"position": "[^"]*"/"position": "top-left"/' "$WORK/red.json"

rm -f "$WORK/gray_stamped.jpg"
stamp "$WORK/red.json" "$WORK/gray.jpg" > "$WORK/receipt.json"

test "$(vipsheader -f bands "$WORK/gray_stamped.jpg")" = 3 ||
    fail "the copy is still gray, so the caption cannot be the color that was chosen"

assert_contains "$(cat "$WORK/receipt.json")" '"expanded":true' "and the run counted it"

# The caption is red where it was drawn: inside the first stroke, measured
# rather than guessed, and red means the channels do not agree.
# shellcheck disable=SC2086
read -r R G B <<< "$(vips getpoint "$WORK/gray_stamped.jpg" 30 60 | tr -d "[]," | tr -s " ")"

test "$R" -gt 150 || fail "the caption is not red: $R $G $B"
test "$G" -lt 120 || fail "the caption is not red: $R $G $B"
test "$R" -ne "$G" || fail "the caption came out gray: $R $G $B"

# ---------------------------------------------------------------------------
# And the photograph itself is untouched by the reading: a gray of 200 comes
# back as 200, 200, 200.
# ---------------------------------------------------------------------------

# shellcheck disable=SC2086
read -r PR PG PB <<< "$(vips getpoint "$WORK/gray_stamped.jpg" 800 500 | tr -d "[]," | tr -s " ")"

test "$PR" = "$PG" && test "$PG" = "$PB" ||
    fail "the picture itself was changed: $PR $PG $PB"
test "$PR" -ge 195 && test "$PR" -le 205 ||
    fail "the picture's grays did not survive the reading: $PR"

printf 'macOS color integration passed\n'
