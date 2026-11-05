#!/usr/bin/env bash
# Concurrent exact-path publication must preserve both finished outputs and originals.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SCRIPT="$ROOT/dist/Stamp-Images.jxa"
WORK=$(mktemp -d -t StampImages-concurrency)
trap 'rm -rf "$WORK"' EXIT
# shellcheck source=tests/integration/lib/fixtures.sh
source "$ROOT/tests/integration/lib/fixtures.sh"
# shellcheck source=tests/integration/lib/assert.sh
source "$ROOT/tests/integration/lib/assert.sh"
require_tools
settings_file "$WORK/settings.json" 'Concurrent caption'
solid "$WORK/source.png" 600 400 '#6e6e6e'
BEFORE=$(shasum -a 256 < "$WORK/source.png")
for round in 1 2 3 4 5 6 7 8 9 10 11 12; do
    mkdir "$WORK/$round"
    cp "$WORK/source.png" "$WORK/$round/photo.png"
    osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/settings.json" "$WORK/$round/photo.png" > "$WORK/$round/a.json" 2> "$WORK/$round/a.err" &
    FIRST=$!
    osascript -l JavaScript "$SCRIPT" -- --headless "$WORK/settings.json" "$WORK/$round/photo.png" > "$WORK/$round/b.json" 2> "$WORK/$round/b.err" &
    SECOND=$!
    FIRST_STATUS=0 SECOND_STATUS=0
    wait "$FIRST" || FIRST_STATUS=$?
    wait "$SECOND" || SECOND_STATUS=$?
    test "$FIRST_STATUS:$SECOND_STATUS" = 0:0 || fail "concurrent publication failed in round $round"
    node - "$WORK/$round/a.json" "$WORK/$round/b.json" <<'JS'
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const results = process.argv.slice(2).map(path => JSON.parse(fs.readFileSync(path)));
if (results.some(result => result.state !== 'complete' || result.images.length !== 1)) throw Error('incomplete concurrent result');
const paths = results.map(result => result.images[0].output);
if (new Set(paths).size !== 2) throw Error('both claims reported the same output');
for (const path of paths) {
    if (execFileSync('vipsheader', ['-f', 'width', path], { encoding: 'utf8' }).trim() !== '600') throw Error('invalid concurrent output');
}
JS
    test "$BEFORE" = "$(shasum -a 256 < "$WORK/$round/photo.png")" || fail 'concurrent run changed its original'
    assert_nothing_left_behind "$WORK/$round"
done
printf 'macOS concurrent publication passed: 12 two-process rounds\n'
