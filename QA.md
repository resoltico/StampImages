# Verification contract

## Scope and limits

The target is macOS 12.3 or later, using JavaScriptCore through osascript or
Shortcuts. Source syntax is ES2022; esbuild targets Safari 15.4. A separate
built-in check rejects features unavailable at that floor. These checks do not
establish native interaction on every supported macOS release.

Unit tests establish portable rules, application sequencing and adapter calls.
Native suites establish behavior for the actual generated artifact and host used.
Offscreen form captures do not prove keyboard interaction, real Shortcuts helper
permissions, live fallback on a host lacking form capability, or the macOS 12.3
floor. Those require live acceptance; do not infer them from CLI success.

## Automated gates

```sh
npm run quality
npm run test:integration:macos
```

`quality` checks syntax, executable registry, import boundaries, toolchain and
metadata consistency, document links, ShellCheck/actionlint when available,
ESLint, unit/repository tests, coverage, mutation and distribution bytes. It never
rebuilds first: stale committed output must fail. Use `npm run build` to regenerate
intentionally. Inspect discovered tests and all skips.

Core, application and pure backend contracts require 100% line, branch and function
coverage and a mutation score of at least 96. Host adapters are checked through
focused unit tests and native production-artifact scenarios; a mocked bridge is
not evidence that macOS rendered or published anything. ESLint rules and deliberate
exceptions are recorded in `tools/eslint/rules.mjs`. Dependency and toolchain pins
live in package.json, package-lock.json, .node-version and mise.toml; clean restores use
`npm ci --ignore-scripts` with the declared npm version.

## Required native checks

The integration scripts under `tests/integration/` exercise real stamp pixels,
placement, supported formats, source hashes, date/GPS content, alpha, profiles,
grayscale color expansion, fonts, damaged/multi-image refusal, selection,
publication collisions, cross-volume/card behavior, measurement failures and
native form geometry/accessibility in both appearances. `resources.sh` checks
confirmed temporary recovery and dead/live/retained/unreadable workspace ownership;
`concurrency.sh` checks 12 two-process publication rounds. CLI and lifecycle probes
also cover strict settings, statuses, source capture, recovery and cancellation.

Probe entrypoints import production modules and are built by
`tools/build-probe.mjs` using the production scoped bundler. Ordinary end-to-end tests invoke
`dist/Stamp-Images.jxa` itself. Use independent source bytes, expected pixels and
positive controls for every fault injection.

Required lifecycle cases include changes before/during/after source capture;
refusal of disguised vectors and animated/multi-image sources; content-driven
encoding for mislabeled still rasters and mixed-extension hard-link aliases; exact source/output
mapping; ordinary failures continuing while faults stop remaining work; saved
outputs surviving Stop and reporting faults; occupied files/directories/pipes/links
remaining untouched; confirmed Downloads recovery and temporary fallback; retained
unconfirmed candidates; cleanup failures; concurrent publication; stale-owner
reclamation without deleting retained, unreadable or live workspaces. Required
filesystem results include APFS, HFS+, FAT32 and exFAT; FAT32 drivers that
refuse exclusive rename must confirm recovery against an independent primitive
probe rather than expose a partial final name; inability to attach an image
is a skipped environment check, never a passing filesystem result.

Volume cleanup resolves the owned image's backing partition-map device through
DiskImages, including when its mount path is gone. It verifies detachment after
bounded retries and a forced attempt; unreadable state or a still-attached image
fails the suite and preserves its working directory. The card suite exercises
an unmounted exFAT image and repeated cleanup after detachment.

Set `STAMP_FORM_PREVIEWS` to an external directory to retain native captures.
Inspect normal/correction, long-path, multiple-destination and large-detail states
in Aqua and Dark Aqua. Controls and actions must fit within 744 points; complete
variable detail must be selectable and scrollable.

## Live Shortcuts acceptance

Use an isolated test Shortcut containing the complete current artifact and
synthetic inputs. Preserve the production Shortcut and restore only preferences
changed by the test. Check Finder selection, all ten settings, keyboard navigation including Tab out
of the custom text, multiple simultaneous validation errors, corrected draft
retention, the form note opening at its first line, Create/Cancel, remembered
appearance without custom text, visible progress/Stop, selectable details,
Details then Back, and Show in Finder. Confirm no text-result files are returned to Shortcuts.

Force an unwritable destination inside the actual Shortcuts helper and independently
inspect the reported recovery bytes. Test fallback where native form capability is
truly unavailable; coding faults must be diagnosed. Remove disposable test
Shortcuts, or retain a clearly named harness with its inputs for repeatable retesting.
Record artifact hash, host, commands, statuses, full failures and skips outside
operational documentation. Passing evidence applies only to its actual inputs and
artifact; a changed build needs new evidence.
