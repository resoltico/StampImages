#!/usr/bin/env bash
# Reader failures must not permit first-page-only or transparency-losing copies.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-measurements)
trap 'rm -rf "$WORK"' EXIT
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"
# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
require_tools

solid "$WORK/first.tif" 900 600 '#6e6e6e'
solid "$WORK/second.tif" 900 600 '#dedede'
vips join "$WORK/first.tif" "$WORK/second.tif" "$WORK/pages.v" vertical
vips tiffsave "$WORK/pages.v" "$WORK/two-pages.tif" --page-height 600
test "$(vipsheader -f n-pages "$WORK/two-pages.tif")" = 2
settings_file "$WORK/settings.json" 'Audit caption'

REAL_HEADER=$(command -v vipsheader)
cat > "$WORK/header" <<SCRIPT
#!/bin/sh
case "\${STAMP_MEASUREMENT_CASE:-}:\$2" in
    bad-pages:n-pages) printf '2junk\\n'; exit 0 ;;
    failed-pages:n-pages) printf 'Injected page-count read failure\\n' >&2; exit 1 ;;
    bad-bands:bands) printf '4junk\\n'; exit 0 ;;
    bad-size:width) printf '900.5\\n'; exit 0 ;;
esac
if [ "\$1" = '-a' ]; then
    case "\${STAMP_MEASUREMENT_CASE:-}" in
        bad-bands|bad-size) printf 'force scalar fallback\\n' >&2; exit 1 ;;
    esac
fi
exec '$REAL_HEADER' "\$@"
SCRIPT
chmod +x "$WORK/header"

# An ordinary single-image format still succeeds with the genuinely absent field.
solid "$WORK/one.png" 900 600 '#6e6e6e'
STAMP_IMAGES_VIPSHEADER="$WORK/header" osascript -l JavaScript "$SCRIPT" \
    -- --headless "$WORK/settings.json" "$WORK/one.png" > /dev/null
test -f "$WORK/one_stamped.png"

for scenario in bad-pages failed-pages; do
    if STAMP_MEASUREMENT_CASE="$scenario" STAMP_IMAGES_VIPSHEADER="$WORK/header" \
        osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/settings.json" \
        "$WORK/two-pages.tif" > "$WORK/receipt.json" 2> "$WORK/error"; then
        fail "$scenario allowed a first-page-only copy"
    fi
    test ! -e "$WORK/two-pages_stamped.tif"
    if [ "$scenario" = bad-pages ]; then
        assert_contains "$(cat "$WORK/receipt.json")" '"code":"damaged"' "malformed count is refused"
    else
        assert_contains "$(cat "$WORK/receipt.json")" "Injected page-count read failure" "reader failure is preserved"
    fi
done

vips black "$WORK/alpha.v" 900 600 --bands 4
vips linear "$WORK/alpha.v" "$WORK/alpha.png" '1 1 1 1' '110 110 110 0' --uchar
test "$(vipsheader -f bands "$WORK/alpha.png")" = 4
BEFORE=$(shasum -a 256 < "$WORK/alpha.png")
for scenario in bad-bands bad-size; do
    if STAMP_MEASUREMENT_CASE="$scenario" STAMP_IMAGES_VIPSHEADER="$WORK/header" \
        osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/settings.json" \
        "$WORK/alpha.png" > "$WORK/receipt.json" 2> "$WORK/error"; then
        fail "$scenario permitted a copy based on invalid measurements"
    fi
    test ! -e "$WORK/alpha_stamped.png"
    assert_contains "$(cat "$WORK/receipt.json")" '"code":"damaged"' "the measurement is refused"
done
test "$BEFORE" = "$(shasum -a 256 < "$WORK/alpha.png")"
# A photograph too small for its stamp is refused on its own; the photographs
# after it are still stamped. Field regression: the refusal was classed as a
# software fault, which stops a run, and 61 of 63 photographs were not started.
mkdir -p "$WORK/mixed"
solid "$WORK/mixed/a-small.png" 40 30 '#6e6e6e'
solid "$WORK/mixed/b-large.png" 900 600 '#6e6e6e'
solid "$WORK/mixed/c-large.png" 900 600 '#6e6e6e'
if osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/settings.json" "$WORK/mixed" \
    > "$WORK/mixed.json" 2> /dev/null; then
    fail "a photograph too small for its stamp was reported as complete"
fi
MIXED=$(cat "$WORK/mixed.json")
assert_contains "$MIXED" '"code":"operation"' "too small is an ordinary refusal"
assert_not_contains "$MIXED" '"code":"fault"' "not a fault in the program"
assert_not_contains "$MIXED" '"not-started"' "and it stops nothing after it"
test -f "$WORK/mixed/b-large_stamped.png" && test -f "$WORK/mixed/c-large_stamped.png" ||
    fail "the photographs after a small one were not stamped"

printf 'macOS measurement integrity integration passed\n'
