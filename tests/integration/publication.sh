#!/usr/bin/env bash
#
# How the finished copy gets from the workspace to the name a person will see,
# against real filesystems: an ordinary folder, a name that is already
# something, a folder that cannot be written to at all, and one that refuses a
# new file for a reason that has nothing to do with what the disk can do.
#
# None of it can be reached by a fake. What a volume of its own adds is
# volumes.sh, and what a camera card's format can and cannot do is cards.sh.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-publication)

cleanup() {
    chmod -R u+rwx "$WORK" 2>/dev/null || true
    rm -rf "$WORK"
}
trap cleanup EXIT

# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"

require_tools
test -f "$SCRIPT" || fail "no built artifact at $SCRIPT"

settings_file "$WORK/config.json" "Riga"
solid "$WORK/photo.jpg" 600 400 "#3080c0"

# A run that is expected to be refused as often as it is expected to succeed,
# so the status is never the assertion here: what is on disk afterwards is.
stamp() {
    osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/config.json" "$@" \
        >"$WORK/receipt" 2>"$WORK/error.txt" || true
}

# Where a copy that could not be published was put, as the message names it.
#
# Out of the receipt rather than the standard error: a photograph that failed
# is a record in the receipt, and the run's own error says only how much of
# the request went unhonoured. The message is JSON, so its newlines are two
# characters and have to be made into one before a line can be read.
said() {
    awk '{ gsub(/\\n/, "\n"); print }' "$WORK/receipt"
}

kept_copy() {
    said | sed -n 's|^\(/[^"]*StampImages-recovered[^"]*\)".*|\1|p' | head -1
}

in_folder() {
    mkdir -p "$WORK/$1"
    cp "$WORK/photo.jpg" "$WORK/$1/photo.jpg"
}

# ---------------------------------------------------------------------------
# The ordinary case: the copy is published and none of the machinery is left
# in the folder.
# ---------------------------------------------------------------------------

in_folder plain
stamp "$WORK/plain/photo.jpg"

PLAIN="$WORK/plain/photo_stamped.jpg"
test -f "$PLAIN" || fail "the copy was not published: $(cat "$WORK/error.txt")"
assert_nothing_left_behind "$WORK/plain"
test "$(stat -f%l "$PLAIN")" = 1 ||
    fail "the published copy still has a second name: $(stat -f%l "$PLAIN") links"

# ---------------------------------------------------------------------------
# A link whose target is gone, standing at the name the copy was going to have.
#
# -e follows the link and reports on its target, so the name reads as free
# while something is plainly there -- and a rename replaces it without
# complaint. The entry is what an output name is about.
# ---------------------------------------------------------------------------

in_folder link
ln -s /nowhere/gone.jpg "$WORK/link/photo_stamped.jpg"
stamp "$WORK/link/photo.jpg"

test -L "$WORK/link/photo_stamped.jpg" ||
    fail "the link was replaced instead of stepped around"
test -f "$WORK/link/photo_stamped_2.jpg" || fail "the copy was not published beside it"
assert_nothing_left_behind "$WORK/link"

# ---------------------------------------------------------------------------
# An output folder that cannot be written to. Every way of getting the copy in
# there is refused, so the finished copy is set aside -- and the message has
# to name somewhere it actually is.
# ---------------------------------------------------------------------------

in_folder readonly
chmod 555 "$WORK/readonly"
stamp "$WORK/readonly/photo.jpg"

KEPT=$(kept_copy)
test -n "$KEPT" || fail "no recovery path was named: $(cat "$WORK/receipt")"
test -f "$KEPT" || fail "the copy is not where the message says it is: $KEPT"
test "$(vipsheader -f width "$KEPT")" = 600 || fail "what was kept is not the copy"
rm -rf "$(dirname "$KEPT")"
assert_nothing_left_behind "$WORK/readonly"
test -z "$(find "$WORK/readonly" -name '*_stamped*')" ||
    fail "something was left at the output path"

# ---------------------------------------------------------------------------
# A folder that refuses a new file on a disk that can do everything.
#
# The ACL denies add_file and allows add_subdirectory, so the place beside the
# destination is made and copied into, and both ways of creating the name are
# refused -- for a reason that is nothing to do with what the disk can do.
# What is said has to be what was established: this is the boot disk, which
# makes hard links and exclusive renames both.
# ---------------------------------------------------------------------------

in_folder denied
chmod +a "$(id -un) deny add_file" "$WORK/denied"
stamp "$WORK/denied/photo.jpg"

REFUSAL=$(said)
assert_contains "$REFUSAL" "Permission denied" "the system's own words are carried"
assert_contains "$REFUSAL" "could not be created in one step" "and the plain ones first"
assert_not_contains "$REFUSAL" "drive" "no cause nobody established"
assert_not_contains "$REFUSAL" "volume" "no cause nobody established"
test -z "$(find "$WORK/denied" -name '*_stamped*')" ||
    fail "something was left at the output path"
assert_nothing_left_behind "$WORK/denied"

DENIED_KEPT=$(kept_copy)
test -n "$DENIED_KEPT" || fail "no recovery path was named: $(cat "$WORK/receipt")"
test -f "$DENIED_KEPT" || fail "the copy is not where the message says it is"
rm -rf "$(dirname "$DENIED_KEPT")"
chmod -a# 0 "$WORK/denied"

printf 'macOS publication integration passed\n'
