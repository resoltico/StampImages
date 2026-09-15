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
    "Nothing draws with the typeface" "the refusal says what was wrong"
test ! -f "$WORK/photo_stamped_2.jpg" ||
    fail "a copy was stamped in a face nobody asked for"

# ---------------------------------------------------------------------------
# And a face Font Book lists as installed, which pango answers with the
# fallback all the same. The question is not whether it is installed.
# ---------------------------------------------------------------------------

named "$WORK/roman.json" "Times New Roman"

if stamp "$WORK/roman.json" "$WORK/photo.jpg" > /dev/null 2> "$WORK/err.txt"; then
    fail "a name that draws as the fallback was accepted"
fi

assert_contains "$(cat "$WORK/err.txt")" \
    "Font Book" "and says where the confusion will be"
test ! -f "$WORK/photo_stamped_2.jpg" || fail "a copy was published anyway"

printf 'macOS typeface integration passed\n'
