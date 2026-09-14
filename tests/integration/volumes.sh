#!/usr/bin/env bash
#
# Publishing to a volume of its own.
#
# The case a fake cannot reach: the finished copy and the folder it belongs in
# are not on the same filesystem, so the name cannot be claimed from the
# workspace and the copy has to be taken to the destination first. What a
# card's format can and cannot do is cards.sh.
#
# Exercised against a real volume attached for the test, and skipped, loudly,
# where one cannot be attached: whether that is possible is the machine's
# decision rather than the code's.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-volumes)
VOLUME_NAME=StampImages-test-volume
VOLUME="/Volumes/$VOLUME_NAME"

cleanup() {
    hdiutil detach -quiet "$VOLUME" 2>/dev/null || true
    rm -rf "$WORK"
}
trap cleanup EXIT

# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"
# shellcheck source=tests/integration/lib/volume.sh
source "$ROOT/tests/integration/lib/volume.sh"

require_tools
test -f "$SCRIPT" || fail "no built artifact at $SCRIPT"

settings_file "$WORK/config.json" "Riga"
solid "$WORK/photo.jpg" 600 400 "#3080c0"

stamp() {
    osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/config.json" "$@" \
        >"$WORK/receipt" 2>"$WORK/error.txt" || true
}

if ! attach_test_volume "HFS+" "$VOLUME_NAME"; then
    printf 'cross-volume publication skipped: no volume could be attached\n'
    exit 0
fi

# ---------------------------------------------------------------------------
# The workspace is on the boot disk and the photograph is not, so the copy
# travels: into a place this run makes beside the destination, and onto the
# name from there. What must not survive it is that place.
# ---------------------------------------------------------------------------

cp "$WORK/photo.jpg" "$VOLUME/"
stamp "$VOLUME/photo.jpg"

PUBLISHED="$VOLUME/photo_stamped.jpg"
test -f "$PUBLISHED" || fail "the copy was not published: $(cat "$WORK/receipt")"
test "$(vipsheader -f width "$PUBLISHED")" = 600 || fail "what was published is not the copy"
assert_nothing_left_behind "$VOLUME"

# It is the file itself at the name, not a link to something in a place that
# is about to be swept away.
test "$(stat -f%l "$PUBLISHED")" = 1 ||
    fail "the published copy still has a second name: $(stat -f%l "$PUBLISHED") links"

# ---------------------------------------------------------------------------
# And a second run does not overwrite the first, across volumes either.
# ---------------------------------------------------------------------------

stamp "$VOLUME/photo.jpg"

test -f "$VOLUME/photo_stamped_2.jpg" || fail "the second copy was not published beside it"
assert_nothing_left_behind "$VOLUME"

detach_test_volume "$VOLUME"

printf 'macOS cross-volume integration passed\n'
