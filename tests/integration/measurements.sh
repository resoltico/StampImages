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
        assert_contains "$(cat "$WORK/receipt.json")" "n-pages" "the bad field is named"
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
    assert_contains "$(cat "$WORK/receipt.json")" "positive whole number" "the measurement is refused"
done
test "$BEFORE" = "$(shasum -a 256 < "$WORK/alpha.png")"
printf 'macOS measurement integrity integration passed\n'
