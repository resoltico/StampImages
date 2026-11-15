#!/usr/bin/env bash
# Native controls, invalid tint, accessibility, geometry and actual modal scroll lifecycle.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
WORK=$(mktemp -d -t StampImages-form)
trap 'rm -rf "$WORK"' EXIT
PREVIEWS=${STAMP_FORM_PREVIEWS:-"$WORK/previews"}
mkdir -p "$PREVIEWS"
node "$ROOT/tools/build-probe.mjs" tests/integration/form-probe.js "$WORK/form.jxa"
osascript -l JavaScript "$WORK/form.jxa" "$PREVIEWS"
