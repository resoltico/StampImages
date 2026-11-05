#!/usr/bin/env bash
# Recovery fallback and conservative stale-workspace reclamation on the real host.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-resources)
DEAD=$(mktemp -d -t StampImages)
LIVE=$(mktemp -d -t StampImages)
RETAINED=$(mktemp -d -t StampImages)
UNKNOWN=$(mktemp -d -t StampImages)
RECOVERY=''
cleanup() {
    chmod -R u+rwx "$WORK" 2>/dev/null || true
    rm -rf "$WORK" "$DEAD" "$LIVE" "$RETAINED" "$UNKNOWN"
    if [ -n "$RECOVERY" ]; then
        rm -f "$RECOVERY"
        rmdir "$(dirname "$RECOVERY")" 2>/dev/null || true
    fi
}
trap cleanup EXIT
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"
# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
require_tools
settings_file "$WORK/settings.json" 'Recovery caption'
solid "$WORK/source.png" 600 400 '#6e6e6e'
printf '{"pid":2147483647,"started":"dead"}' > "$DEAD/owner.json"
printf '{"pid":2147483647,"started":"dead"}' > "$RETAINED/owner.json"
printf 'validated' > "$RETAINED/retain"
printf 'unreadable owner' > "$UNKNOWN/owner.json"
STARTED=$(LC_ALL=C TZ=UTC ps -p $$ -o lstart= | sed 's/^ *//;s/ *$//')
node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({pid:Number(process.argv[2]),started:process.argv[3]}))' "$LIVE/owner.json" $$ "$STARTED"
osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/settings.json" "$WORK/source.png" > "$WORK/receipt" 2> "$WORK/error"
test ! -e "$DEAD" || fail 'dead unretained workspace was not reclaimed'
test -d "$LIVE" && test -d "$RETAINED" && test -d "$UNKNOWN" || fail 'active or retained/unreadable work was removed'
mkdir "$WORK/denied" "$WORK/no-downloads"
cp "$WORK/source.png" "$WORK/denied/source.png"
chmod 555 "$WORK/denied" "$WORK/no-downloads"
node "$ROOT/tools/build-probe.mjs" tests/integration/resources-probe.js "$WORK/resources.jxa"
osascript -l JavaScript "$WORK/resources.jxa" "$WORK/no-downloads/" --headless "$WORK/settings.json" "$WORK/denied/source.png" > "$WORK/recovery.json"
RECOVERY=$(node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1]));if(r.attemptedDownloads<1||r.images[0].state!=="recovered")throw Error("recovery injection failed");process.stdout.write(r.images[0].recovery)' "$WORK/recovery.json")
case "$RECOVERY" in
    */StampImages-recovered.*/source_stamped.png) : ;;
    *) RECOVERY=''; fail 'temporary fallback was not confirmed under its intended name' ;;
esac
test -f "$RECOVERY" && test "$(vipsheader -f width "$RECOVERY")" = 600 || fail 'reported fallback is not the validated copy'
assert_contains "$(cat "$WORK/recovery.json")" 'could not be recovered to Downloads' 'failed Downloads route is recorded'
test ! -e "$WORK/denied/source_stamped.png"
printf 'macOS recovery and workspace resources passed\n'
