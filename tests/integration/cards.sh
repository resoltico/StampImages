#!/usr/bin/env bash
#
# Publishing to a camera card.
#
# A card is formatted FAT32 or exFAT, and the two differ in what they can do
# with a name. FAT32 has no hard links and takes an exclusive rename; exFAT
# takes neither, where publication stops and has to stop well. Neither path is
# hypothetical -- a stamped copy goes back beside the photograph, which for
# somebody working off a card is on the card -- and neither can be reached by
# a fake.
#
# Exercised against real volumes attached for the test, and skipped, loudly,
# where one cannot be attached: whether that is possible is the machine's
# decision rather than the code's.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-cards)
# A FAT label is eleven characters at most; a longer one is dropped and the
# volume mounts as NO NAME.
FAT_NAME=SIMGFAT
FAT_VOLUME="/Volumes/$FAT_NAME"
EXFAT_NAME=SIMGEXF
EXFAT_VOLUME="/Volumes/$EXFAT_NAME"

cleanup() {
    detach_test_volume "$FAT_VOLUME" 2>/dev/null || true
    detach_test_volume "$EXFAT_VOLUME" 2>/dev/null || true
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

# The refusal, with its newlines made into newlines: a photograph that failed
# is a record in the receipt, and the receipt is JSON.
said() {
    awk '{ gsub(/\\n/, "\n"); print }' "$WORK/receipt"
}

# ---------------------------------------------------------------------------
# A volume that cannot make hard links.
#
# Which is what a camera card is. MS-DOS cannot link, but it can rename
# exclusively -- one operation that moves the copy onto the name and refuses a
# name that is taken -- so that is what publishes there.
# ---------------------------------------------------------------------------

if attach_test_volume "MS-DOS FAT32" "$FAT_NAME"; then
    cp "$WORK/photo.jpg" "$FAT_VOLUME/"
    stamp "$FAT_VOLUME/photo.jpg"

    printf 'primitive control' > "$FAT_VOLUME/primitive-from"
    node "$ROOT/tools/build-probe.mjs" tests/integration/rename-probe.js "$WORK/rename.jxa"
    PRIMITIVE=$(osascript -l JavaScript "$WORK/rename.jxa" "$FAT_VOLUME/primitive-from" "$FAT_VOLUME/primitive-to")
    if [ "$PRIMITIVE" = 0 ]; then
        test -f "$FAT_VOLUME/photo_stamped.jpg" ||
            fail "the copy was not published: $(said)"
        test "$(vipsheader -f width "$FAT_VOLUME/photo_stamped.jpg")" = 600 ||
            fail "what was published is not the copy"
        assert_nothing_left_behind "$FAT_VOLUME"

        # A name already held by something else is stepped around, not taken.
        printf 'someone elses photograph' > "$FAT_VOLUME/photo_stamped 2.jpg"
        stamp "$FAT_VOLUME/photo.jpg"

        test "$(cat "$FAT_VOLUME/photo_stamped 2.jpg")" = "someone elses photograph" ||
            fail "a file that was already there was overwritten"
        test -f "$FAT_VOLUME/photo_stamped 3.jpg" || fail "the copy was not published beside it"
        assert_nothing_left_behind "$FAT_VOLUME"
    else
        test ! -e "$FAT_VOLUME/photo_stamped.jpg" || fail "unsupported primitive exposed an output"
        KEPT=$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(r.images.find(i=>i.state==="recovered")?.recovery??"")' "$WORK/receipt")
        test -n "$KEPT" && test -f "$KEPT" || fail "unsupported FAT32 primitive lost recovery"
        test "$(vipsheader -f width "$KEPT")" = 600 || fail "FAT32 recovery is not the finished image"
        rm -f "$KEPT"
        assert_nothing_left_behind "$FAT_VOLUME"
        printf 'FAT32 native exclusive rename unavailable; confirmed recovery passed\n'
    fi
    detach_test_volume "$FAT_VOLUME"
else
    printf 'link-free publication skipped: no MS-DOS volume could be attached\n'
fi

# ---------------------------------------------------------------------------
# And a volume that can do neither.
#
# exFAT, measurably: no hard links, and the exclusive rename is not
# implemented there. There is no operation left that takes a name and carries
# contents, so publication stops -- and stopping has to be worth as much as
# publishing. Nothing of the run may reach the card, the message has to carry
# what the system said rather than a cause this code invented, and the
# finished copy has to be somewhere the message names.
# ---------------------------------------------------------------------------

if attach_test_volume "ExFAT" "$EXFAT_NAME"; then
    cp "$WORK/photo.jpg" "$EXFAT_VOLUME/"
    stamp "$EXFAT_VOLUME/photo.jpg"

    test ! -e "$EXFAT_VOLUME/photo_stamped.jpg" ||
        fail "a name was created on a volume that cannot take one whole"
    test -z "$(find "$EXFAT_VOLUME" -maxdepth 1 -name '*_stamped*')" ||
        fail "something of the run reached the card: $(ls -a "$EXFAT_VOLUME")"
    assert_nothing_left_behind "$EXFAT_VOLUME"

    REFUSAL=$(said)
    assert_contains "$REFUSAL" '"code":"publication"' "what failed is classified"
    # What the system said about the operation it actually refused. Measured
    # on exFAT: ln reports "unsupported" from beside the
    # destination, which is the capability statement, made by the kernel
    # rather than guessed at here.
    assert_contains "$REFUSAL" "unsupported" "in the system's own words"

    # The whole point of stopping is that the work survives it.
    KEPT=$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(r.images.find(i=>i.state==="recovered")?.recovery??"")' "$WORK/receipt")
    test -n "$KEPT" || fail "no recovery path was named: $REFUSAL"
    test "$(vipsheader -f width "$KEPT")" = 600 || fail "what was kept is not the copy"
    rm -f "$KEPT"

    detach_test_volume "$EXFAT_VOLUME"
else
    printf 'exFAT publication skipped: no exFAT volume could be attached\n'
fi

printf 'macOS camera card integration passed\n'
