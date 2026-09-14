#!/usr/bin/env bash
#
# What a run makes of the selection it was handed, when macOS is the one
# handing it over.
#
# Every file that was asked for ends in exactly one of two places: a copy that
# exists, or a reason it does not. A run that reported neither for a file
# would be a run that lost it quietly, and that is what these scenarios watch
# for -- through osascript, because the selection arrives from the host.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-selection)

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

GREY="#6e6e6e"

stamp() {
    osascript -l JavaScript "$SCRIPT" -- --headless "$@"
}

solid "$WORK/first.png" 300 200 "$GREY"
solid "$WORK/second.jpg" 300 200 "$GREY"
mkdir -p "$WORK/folder"
solid "$WORK/folder/inside.png" 300 200 "$GREY"
printf 'not a photograph' > "$WORK/notes.txt"
settings_file "$WORK/settings.json" "Riga"

# ---------------------------------------------------------------------------
# Files, a folder walked for what is in it, and something that is not a
# photograph at all.
# ---------------------------------------------------------------------------

set +e
RECEIPT=$(stamp "$WORK/settings.json" \
    "$WORK/first.png" "$WORK/second.jpg" "$WORK/folder" "$WORK/notes.txt" 2>&1)
STATUS=$?
set -e

test "$STATUS" -ne 0 || fail "a run that could not honour everything must fail"

assert_contains "$RECEIPT" "first_stamped.png" "the file that was selected"
assert_contains "$RECEIPT" "second_stamped.jpg" "and the other one"
assert_contains "$RECEIPT" "inside_stamped.png" "and the one inside the folder"
assert_contains "$RECEIPT" "notes.txt" "what could not be used is named"
assert_contains "$RECEIPT" "not a supported format" "with the reason"
assert_contains "$RECEIPT" '"requested":4' "and everything asked for is counted"

for copy in first_stamped.png second_stamped.jpg folder/inside_stamped.png; do
    test -f "$WORK/$copy" || fail "no copy at $copy"
done

# ---------------------------------------------------------------------------
# Nothing to stamp is an answer, not a silence -- and it says which of the two
# it is: nothing selected, or nothing usable.
# ---------------------------------------------------------------------------

if stamp "$WORK/settings.json" "$WORK/notes.txt" \
    > "$WORK/out.txt" 2> "$WORK/err.txt"; then
    fail "a selection with no photographs should not succeed"
fi

grep -q "Nothing to stamp" "$WORK/err.txt" ||
    fail "the refusal does not say why: $(cat "$WORK/err.txt")"
grep -q "notes.txt" "$WORK/err.txt" ||
    fail "and does not say which file it is about"

# ---------------------------------------------------------------------------
# A configuration that would draw nothing is refused before any photograph is
# read, because it is a fact about the request rather than about any file.
# ---------------------------------------------------------------------------

settings_file "$WORK/blank.json" "" "bottom-right" "none" "none"

if stamp "$WORK/blank.json" "$WORK/first.png" \
    > "$WORK/out.txt" 2> "$WORK/err.txt"; then
    fail "a request that stamps nothing should not succeed"
fi

grep -q "would stamp nothing" "$WORK/err.txt" ||
    fail "the refusal does not say what is wrong: $(cat "$WORK/err.txt")"

# ---------------------------------------------------------------------------
# A second run over the same folder stamps the photographs again and leaves
# the first run's copies alone, saying which ones it left.
# ---------------------------------------------------------------------------

mkdir -p "$WORK/album"
solid "$WORK/album/holiday.png" 300 200 "$GREY"
stamp "$WORK/settings.json" "$WORK/album" > /dev/null
test -f "$WORK/album/holiday_stamped.png" || fail "the first run stamped nothing"

set +e
AGAIN=$(stamp "$WORK/settings.json" "$WORK/album" 2>&1)
set -e

assert_contains "$AGAIN" "holiday_stamped_2.png" "the photograph is stamped again"
assert_contains "$AGAIN" "already a stamped copy" "and the copy is named, not passed over"
test ! -f "$WORK/album/holiday_stamped_stamped.png" ||
    fail "a copy was stamped a second time"

printf 'macOS selection passed\n'
