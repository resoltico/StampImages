#!/usr/bin/env bash
# Production CLI contracts, private source bytes, and lifecycle boundaries.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-cli)
trap 'rm -rf "$WORK"' EXIT
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"
# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
require_tools
settings_file "$WORK/settings.json" 'Riga'
solid "$WORK/source.png" 600 400 '#6e6e6e'
BEFORE=$(shasum -a 256 < "$WORK/source.png")
expect_status() {
    local expected=$1 status=0
    shift
    osascript -l JavaScript "$SCRIPT" -- "$@" > "$WORK/receipt" 2> "$WORK/error" || status=$?
    test "$status" = "$expected" || fail "expected $expected, got $status: $(cat "$WORK/receipt" "$WORK/error")"
}
expect_status 0 --help
assert_contains "$(cat "$WORK/receipt")" 'all 10 required' 'help describes current settings'
expect_status 0 --version
STAMP_IMAGES_VIPS="$WORK/missing-vips" expect_status 3 --headless "$WORK/settings.json" "$WORK/source.png"
node -e 'const fs=require("fs");const value=JSON.parse(fs.readFileSync(process.argv[1]));value.font="StampImages Nonexistent Typeface";fs.writeFileSync(process.argv[2],JSON.stringify(value));' "$WORK/settings.json" "$WORK/missing-font.json"
expect_status 2 --headless "$WORK/missing-font.json" "$WORK/source.png"
# Invalid settings win even if tools and sources are unavailable.
STAMP_IMAGES_VIPS="$WORK/missing-vips" expect_status 2 --headless "$WORK/missing-font.json" "$WORK/unavailable-source.png"
node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1]));if(r.state!=="invalid"||r.images.length!==0||r.rejected.length!==0||r.issues[0].code!=="typeface"||r.issues[0].stage!=="settings")throw Error("typeface refusal must precede tools and admission");' "$WORK/receipt"

for caption in nul surrogate; do
    node -e 'const fs=require("fs");const value=JSON.parse(fs.readFileSync(process.argv[1]));value.customText=process.argv[3]==="nul"?"before\u0000after":"before\ud800after";fs.writeFileSync(process.argv[2],JSON.stringify(value));' "$WORK/settings.json" "$WORK/$caption.json" "$caption"
    expect_status 2 --headless "$WORK/$caption.json" "$WORK/source.png"
    assert_contains "$(cat "$WORK/receipt")" '"field":"customText"' 'unrenderable caption is rejected before image work'
done
expect_status 2 --unknown
expect_status 2 "$WORK/source.png"
expect_status 2 --headless "$WORK/missing.json" "$WORK/source.png"
printf '\377' > "$WORK/invalid.json"
expect_status 2 --headless "$WORK/invalid.json" "$WORK/source.png"
assert_contains "$(cat "$WORK/receipt")" 'not UTF-8' 'native reader rejects malformed encoding'
printf '\357\273\277{}' > "$WORK/bom.json"
expect_status 2 --headless "$WORK/bom.json" "$WORK/source.png"
assert_contains "$(cat "$WORK/receipt")" 'byte-order mark' 'BOM is rejected'
node -e 'const fs=require("fs");const p=process.argv[1];let s=JSON.parse(fs.readFileSync(p));s.size="36";s.margin=-1;s.unknown=true;fs.writeFileSync(process.argv[2],JSON.stringify(s));' "$WORK/settings.json" "$WORK/bad.json"
expect_status 2 --headless "$WORK/bad.json" "$WORK/source.png"
node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1]));if(r.state!=="invalid"||r.issues.length!==3)throw Error("all invalid fields must be reported");' "$WORK/receipt"
(cd "$WORK"; osascript -l JavaScript "$SCRIPT" -- --headless settings.json source.png > receipt 2> error)
node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1]));if(r.state!=="complete"||r.images[0].state!=="saved"||!r.images[0].source.endsWith("/source.png"))throw Error("source mapping");' "$WORK/receipt"
test "$BEFORE" = "$(shasum -a 256 < "$WORK/source.png")"
# Exact content policy, independent of the filename extension.
printf '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"/>' > "$WORK/disguised.png"
expect_status 1 --headless "$WORK/settings.json" "$WORK/disguised.png"
assert_contains "$(cat "$WORK/receipt")" 'not-an-image' 'disguised vector is refused'
cp "$WORK/source.png" "$WORK/mismatch.jpg"
expect_status 0 --headless "$WORK/settings.json" "$WORK/mismatch.jpg"
test -f "$WORK/mismatch_stamped.png"
test "$(vipsheader -f vips-loader "$WORK/mismatch_stamped.png")" = pngload
ln "$WORK/mismatch.jpg" "$WORK/correct-alias.png"
expect_status 0 --headless "$WORK/settings.json" "$WORK/mismatch.jpg" "$WORK/correct-alias.png"
node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1]));if(r.images.length!==1||r.images[0].state!=="saved")throw Error("valid content alias was suppressed");' "$WORK/receipt"
node "$ROOT/tools/build-probe.mjs" tests/integration/lifecycle-probe.js "$WORK/lifecycle.jxa"
solid "$WORK/replacement.png" 600 400 '#dedede'
for scenario in changed-after-capture changed-before-capture stop-after-commit; do
    cp "$WORK/source.png" "$WORK/$scenario.png"
    osascript -l JavaScript "$WORK/lifecycle.jxa" "$scenario" "$WORK/replacement.png" --headless "$WORK/settings.json" "$WORK/$scenario.png" > "$WORK/probe.json"
    node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1]));if(r.injected!==1)throw Error("injection did not run");const i=r.images[0];if(process.argv[2]==="changed-before-capture"){if(i.state!=="failed"||!i.issues.some(x=>x.message.includes("changed")))throw Error("changed source accepted");}else if(i.state!=="saved")throw Error("committed output lost");' "$WORK/probe.json" "$scenario"
done
# Processing must use the captured dark pixels even though the original is now bright.
test "$(getpoint "$WORK/changed-after-capture_stamped.png" 0 0 | awk '{print $1}')" = 110
cp "$WORK/source.png" "$WORK/cleanup-fault.png"
cp "$WORK/source.png" "$WORK/zz-after-cleanup.png"
osascript -l JavaScript "$WORK/lifecycle.jxa" cleanup-fault "$WORK/replacement.png" --headless "$WORK/settings.json" "$WORK/cleanup-fault.png" "$WORK/zz-after-cleanup.png" > "$WORK/cleanup.json"
node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1]));if(r.injected!==1||r.images[0].state!=="saved"||r.images[0].issues.filter(i=>i.code==="cleanup").length!==1||r.images[1].state!=="not-started")throw Error("cleanup lost accounting or continued work");' "$WORK/cleanup.json"
cp "$WORK/source.png" "$WORK/stop-before-publication.png"
osascript -l JavaScript "$WORK/lifecycle.jxa" stop-before-publication "$WORK/replacement.png" --headless "$WORK/settings.json" "$WORK/stop-before-publication.png" > "$WORK/stopped.json"
node - "$WORK/stopped.json" <<'JS'
const fs = require('node:fs'); const path = require('node:path');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const record = result.images[0];
if (result.injected !== 1 || result.publicationAttempts !== 0 || record.state !== 'recovered' || !fs.existsSync(record.recovery)) throw Error('Stop started new publication or lost finished work');
const workspace = path.dirname(record.recovery);
if (!/\/StampImages\.[A-Za-z0-9]{10}$/u.test(workspace)) throw Error('unexpected retained workspace');
fs.rmSync(workspace, { recursive: true });
JS
mkdir "$WORK/recovery-target"
cp "$WORK/source.png" "$WORK/recovery-target/photo.png"
chmod 555 "$WORK/recovery-target"
osascript -l JavaScript "$WORK/lifecycle.jxa" stop-before-recovery "$WORK/replacement.png" --headless "$WORK/settings.json" "$WORK/recovery-target/photo.png" > "$WORK/pending-stop.json"
chmod 755 "$WORK/recovery-target"
node - "$WORK/pending-stop.json" <<'JS'
const fs = require('node:fs'); const path = require('node:path');
const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const record = result.images[0];
if (result.injected !== 1 || result.publicationAttempts !== 1 || record.state !== 'recovered' || !fs.existsSync(record.recovery)) throw Error('pending Stop started recovery access or lost work');
const workspace = path.dirname(record.recovery); if (!/\/StampImages\.[A-Za-z0-9]{10}$/u.test(workspace)) throw Error('unexpected retained workspace');
fs.rmSync(workspace, { recursive: true });
JS
for scenario in fault-after-commit false-refusal; do
    cp "$WORK/source.png" "$WORK/$scenario.png"
    osascript -l JavaScript "$WORK/lifecycle.jxa" "$scenario" "$WORK/replacement.png" --headless "$WORK/settings.json" "$WORK/$scenario.png" > "$WORK/$scenario.json"
    node - "$WORK/$scenario.json" "$scenario" <<'JS'
const fs = require('node:fs'); const result = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const record = result.images[0];
if (result.injected !== 1 || result.publicationAttempts !== 1 || record.state !== 'saved' || !fs.existsSync(record.output)) throw Error('actual native commit was not accounted for');
if (process.argv[3] === 'fault-after-commit' && !record.issues.some(issue => issue.code === 'fault')) throw Error('post-commit fault diagnostic was lost');
JS
done
printf 'macOS CLI and capture lifecycle integration passed\n'
