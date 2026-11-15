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
# Only the final private produced PNG is changed; setup and source probes stay real.
if [ "\$1" = '-a' ]; then
    case "\$2" in
        */staged-*.png)
            case "\${STAMP_MEASUREMENT_CASE:-}" in
                wrong-staged-width|wrong-staged-bands|ambiguous-staged)
                    printf '%s\\n' "\$STAMP_MEASUREMENT_CASE" >> '$WORK/fast-reached'
                    dump=\$('$REAL_HEADER' "\$@") || exit "\$?"
                    case "\$STAMP_MEASUREMENT_CASE" in
                        wrong-staged-width) printf '%s\\n' "\$dump" | sed 's/^width:.*/width: 901/' ;;
                        wrong-staged-bands) printf '%s\\n' "\$dump" | sed 's/^bands:.*/bands: 5/' ;;
                        ambiguous-staged) printf '%s\\nwidth: 901\\n' "\$dump" ;;
                    esac
                    exit 0 ;;
            esac ;;
    esac
fi
if [ "\$1" = '-f' ]; then
    case "\${STAMP_MEASUREMENT_CASE:-}:\$3" in
        wrong-staged-width:*/staged-*.png|wrong-staged-bands:*/staged-*.png|ambiguous-staged:*/staged-*.png)
            printf '%s\\n' "\$2" >> '$WORK/scalar-reached' ;;
    esac
fi
case "\${STAMP_MEASUREMENT_CASE:-}:\$2" in
    bad-pages:n-pages) printf '2junk\\n'; exit 0 ;;
    failed-pages:n-pages) printf 'Injected page-count read failure\\n' >&2; exit 1 ;;
    bad-bands:bands) printf '4junk\\n'; exit 0 ;;
    bad-size:width)
        # Target image measurement, not setup's valid built-in PNG probe.
        if [ "\$3" = '$WORK/alpha.png' ]; then printf '900.5\\n'; exit 0; fi ;;
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
# These valid-positive wrong facts reach ONLY the new produced-file -a path.
# The wrapper exits zero: fidelity checks, not process failure, must refuse them.
for scenario in wrong-staged-width wrong-staged-bands; do
    rm -f "$WORK/fast-reached" "$WORK/scalar-reached"
    if STAMP_MEASUREMENT_CASE="$scenario" STAMP_IMAGES_VIPSHEADER="$WORK/header" \
        osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/settings.json" \
        "$WORK/alpha.png" > "$WORK/fast-receipt.json" 2> "$WORK/fast-error"; then
        fail "$scenario published a copy based on wrong produced-file facts"
    fi
    assert_contains "$(cat "$WORK/fast-reached")" "$scenario" "new fast validation path was reached"
    test ! -e "$WORK/scalar-reached" || fail "$scenario unexpectedly used scalar fallback"
    test ! -e "$WORK/alpha_stamped.png"
    assert_contains "$(cat "$WORK/fast-receipt.json")" '"code":"operation"' "wrong produced-file facts are ordinary refusals"
    assert_not_contains "$(cat "$WORK/fast-receipt.json")" '"code":"fault"' "validation is not bypassed or mislabeled"
    if [ "$scenario" = wrong-staged-width ]; then
        assert_contains "$(cat "$WORK/fast-receipt.json")" 'is 901 by 600 pixels where 900 by 600 were expected' 'actual geometry check refuses the copy'
    else
        assert_contains "$(cat "$WORK/fast-receipt.json")" 'color representation could not be confirmed' 'actual band/model check refuses the copy'
    fi
done
# Duplicate dump fields opt out; the independent real scalar facts must succeed.
rm -f "$WORK/fast-reached" "$WORK/scalar-reached"
STAMP_MEASUREMENT_CASE=ambiguous-staged STAMP_IMAGES_VIPSHEADER="$WORK/header" \
    osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/settings.json" "$WORK/alpha.png" \
    > "$WORK/fallback-receipt.json" 2> "$WORK/fallback-error"
assert_contains "$(cat "$WORK/fast-reached")" 'ambiguous-staged' 'ambiguous new path reached'
for field in width height bands interpretation; do
    grep -qx "$field" "$WORK/scalar-reached" || fail "scalar fallback did not read $field"
done
test -f "$WORK/alpha_stamped.png"
test "$(vipsheader -f bands "$WORK/alpha_stamped.png")" = 4
assert_contains "$(cat "$WORK/fallback-receipt.json")" '"state":"complete"' 'real scalar fallback succeeds'
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

node "$ROOT/tests/integration/layout.cjs" "$SCRIPT" "$WORK/layout" "$WORK/one.png" "$WORK/settings.json"
printf 'macOS measurement integrity integration passed\n'
