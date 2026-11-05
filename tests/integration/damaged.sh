#!/usr/bin/env bash
#
# A damaged photograph must be refused rather than half-stamped.
#
# libvips is permissive by default: a JPEG cut off inside its image data is
# salvaged into a partial picture, vips exits zero, and every check after it
# passes -- the copy exists, it is an image, it is the size the photograph
# said it was. Half a photograph was published as a finished copy, and nothing
# in the unit suite can see it because none of it reaches vips.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-damaged)
trap 'rm -rf "$WORK"' EXIT

# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"

require_tools
test -f "$SCRIPT" || fail "no built artifact at $SCRIPT"

# Returns the exit status rather than failing the script: a refusal is the
# expected outcome here, so the status is the assertion.
stamp() {
    osascript -l JavaScript "$SCRIPT" -- --headless "$@" \
        >"$WORK/receipt" 2>"$WORK/stderr"
}

# cut_short <source> <destination> <percent>
cut_short() {
    local bytes
    bytes=$(stat -f%z "$1")
    dd if="$1" of="$2" bs=1 count=$((bytes * $3 / 100)) 2>/dev/null
}

settings_file "$WORK/config.json" "Riga"
solid "$WORK/whole.jpg" 900 600 "#235789"
solid "$WORK/whole.png" 900 600 "#235789"
cut_short "$WORK/whole.jpg" "$WORK/cut.jpg" 55
cut_short "$WORK/whole.png" "$WORK/cut.png" 55

# A truncated file must still look whole to everything that only reads the
# header, or this proves nothing about the decoding policy: the refusal has to
# come from reading the pixels.
test "$(vipsheader -f width "$WORK/cut.jpg")" = 900 ||
    fail "the truncated JPEG no longer has a readable header"
test "$(vipsheader -f width "$WORK/cut.png")" = 900 ||
    fail "the truncated PNG no longer has a readable header"

# ---------------------------------------------------------------------------
# The damaged photographs are refused by name, and the whole ones are stamped.
# ---------------------------------------------------------------------------

if stamp "$WORK/config.json" \
    "$WORK/whole.jpg" "$WORK/cut.jpg" "$WORK/whole.png" "$WORK/cut.png"; then
    fail "a run that could not stamp everything reported complete success"
fi

RECEIPT=$(cat "$WORK/receipt")

for damaged in cut.jpg cut.png; do
    assert_contains "$RECEIPT" "/$damaged\"" "the receipt names $damaged"
    test ! -e "$WORK/${damaged%.*}_stamped.${damaged##*.}" ||
        fail "a copy was published from $damaged"
done

for whole in whole_stamped.jpg whole_stamped.png; do
    test -f "$WORK/$whole" || fail "$whole was not stamped"
    test "$(vipsheader -f width "$WORK/$whole")" = 900 ||
        fail "$whole is not the photograph it came from"
done

# Refused as damaged in inspection's own words; the decoder's words stay in
# the receipt's diagnostic for whoever investigates, not in what is read.
assert_contains "$RECEIPT" '"code":"damaged"' "a truncated file is refused as damaged"
assert_contains "$RECEIPT" "load error" "the tool's own words are kept as the diagnostic"
assert_contains "$(cat "$WORK/stderr")" "This image is damaged or incomplete." "and the reader is told plainly"
assert_not_contains "$(cat "$WORK/stderr")" "load error" "without the decoder's output"
assert_not_contains "$(cat "$WORK/stderr")" $'\r' "and without carriage returns"

# The name belongs to the record rather than to the message as well.
assert_not_contains "$RECEIPT" '"message":"cut.jpg:' "the file is named once"

printf 'macOS damaged-source integration passed\n'
