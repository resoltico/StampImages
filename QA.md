# Verification contract

## Scope and limits

The target is macOS 12.3 or later, using JavaScriptCore through osascript or
Shortcuts. Source syntax is ES2022; esbuild targets Safari 15.4. A separate
built-in check rejects features unavailable at that floor. These checks do not
establish native interaction on every supported macOS release. Automated native
CI runs on macOS 26.

Unit tests establish portable rules, application sequencing and adapter calls.
Native suites establish behavior for the actual generated artifact and host used.
Compare recursive listings of `~/Downloads` before and after native runs; confirmed
recovery checks must remove their own outputs and leave no test artifacts there.
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
intentionally. Inspect discovered tests and all skips. Unit files follow their
outermost imported production layer; the repository placement check rejects misplaced files.
Command-line graph checks forbid quick-action dependencies and permit AppKit only
in the shared native font catalog. Both cross-front-end import directions are
rejected by boundary tests. Constructor-field and raw-cancellation tests cover
the scripting adapters and both top-level front-end catches.

Core, application, pure backend contracts and `src/host/invocation-syntax.js` require
100% line, branch and function coverage. The combined mutation score for those
gated files must be at least 96. The invocation parser remains explicitly
included in both gates. Other host adapters are checked through
focused unit tests and native production-artifact scenarios; a mocked bridge is
not evidence that macOS rendered or published anything. ESLint rules and deliberate
exceptions are recorded in `tools/eslint/rules.mjs`. Dependency and toolchain pins
live in package.json, package-lock.json, .node-version and mise.toml; clean restores use
`npm ci --ignore-scripts` with the declared npm version.

## Required native checks

The integration scripts under `tests/integration/` exercise real stamp pixels,
placement, supported formats, source hashes, date/GPS content, alpha, profiles,
grayscale color expansion, fonts, damaged/multi-image refusal (including JPEG decoder warnings), selection,
publication collisions, cross-volume/card behavior, measurement failures and
native form geometry/accessibility in both appearances. Stop exposes an actual
accessibility button, acknowledges its action with disabled feedback and fits its
full title; a toggle control is the negative control. Invalid controls are checked
with native pixels against the same controls with only their error tint removed. Actual modal checks verify
first-line initialization and later user scrolling for details, notes and multiline
captions; caption documents use clip-local coordinates. Callback tests guard
registration, teardown and reentrant native visibility getters. `resources.sh` checks
confirmed temporary recovery and dead/live/retained/unreadable workspace ownership;
`concurrency.sh` checks 12 two-process publication rounds. Copy naming checks
compare receipt basename buffers to raw directory entries for NFC/NFD, case and
normalization collisions, hidden/legal stem spelling, matching extension case,
long byte-budget names, and accented recovery names. Folder checks verify copies
beside each original, per-folder collisions and exclusions on repeated runs.
Ownership controls cover name-readback refusal, workspace-copy replacement during
copy and after name lookup, explicit no-recovery faults and confirmed-output retention. CLI and lifecycle probes
also cover strict settings, statuses, source capture, recovery and cancellation.
Signal controller unit checks cover native adapter ownership and complete saved
signal actions. Actual command-line SIGINT/SIGTERM/repeat runs must produce canceled
receipts with exit 1 and preserve confirmed output/source integrity. Separate native
controller probes establish explicit-close restoration; real command-line exit
reclaims process-owned monitoring resources instead of returning through JS finally.
Content checks generate blank/all-zero, year-zero and impossible calendar dates,
verify distinct absence/invalid notes, and compare actual stamp pixels with
caption-only or valid-secondary controls while keeping every source unchanged.
Prior-workspace notes must exclude unrelated and temporary-root scan diagnostics.
The color suite also checks neutral/active/inactive-outline palettes against gray8,
non8bit-derived gray16, alpha and tagged profiles. It compares every channel outside
an independent stamp region with the source or explicit ICC reference and verifies
actual chromatic stamp pixels, saved bit depth/profile and reported expansion.
CLI transport checks include a genuinely closed descriptor and FIFO readers closed
before child exec for deterministic EPIPE on stdout/stderr. Source bytes and every
published image are independently checked; working stderr gets exactly one plain
stdout-failure line, and broken stderr still allows the single receipt attempt.
An unavailable typeface combined with a missing tool and unavailable source must
report `invalid` with exit 2 before source admission.
`hdr.sh` checks synthetic Ultra HDR admission, visible stamped SDR JPEGs with no
gain map/MPF or stale HDR XMP declarations, retained EXIF/GPS, ICC, XMP and IPTC,
orientations 6/8, damaged HDR
and unmapped-loader diagnostics. A metadata-write failure must publish no copy. `formats.sh` also checks EXIF/GPS
and ICC across six encoder families, upright 6/8 JPEG/TIFF pixels and EXIF/XMP
dimensions, opaque alpha and an independent unmarked-source caption control.

`formats.sh` runs [capture-copy-regressions.cjs](tests/integration/capture-copy-regressions.cjs)
with literal, generated IIM packets and Nikon external Scan directories. Checks
preserve packet bytes and timezone absence in two timezones, exercise joint
producer repairs, and compare source hashes, pixels, profiles and raw vendor facts.
Conflicting target facts and unavailable input facts must refuse. Malformed ICC
has its own accepted/unconverted positive. Cached pre-repair wrapper diagnostics may be
resolved; fresh post-repair wrapper warnings and same-text excluded-group probe
diagnostics must refuse. Process-success
write, readback and late-reader failure controls must publish no copy.

`measurements.sh` checks source/page/scalar guards and exercises the live
staged-file `-a` path with positive-but-wrong width and band facts: each must refuse
without publication. Duplicate dumps must use all four independent scalar fields
and preserve alpha. These checks establish fidelity, not batch throughput.

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
filesystem results include APFS, HFS+, FAT32 and exFAT. FAT32 exclusive rename
is probed independently with free and occupied destinations: supported drivers
must pass publication and collision checks; unsupported drivers must expose no
final name and produce a confirmed recovery; unexpected probe errors fail the
suite. Passing checks remove only the recovered file they confirmed. Inability
to attach an image is a skipped environment check, never a passing filesystem
result.

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

Localized-font checks compare Japanese full-name, style and bare-family outputs
to canonical Hiragino Sans pixels, verify distinct W3/W6 native font identities, and refuse unknown,
hidden and PostScript names without publishing a copy.

Mixed-direction layout checks compare complete RTL punctuation/number rasters with
single-line controls for LF and Unicode paragraph separators, while checking left
alignment. Oversized-margin checks compare actual stamp pixel bounds with native
mask geometry at all six positions, including whole-pixel selected-half limits.

Raw-GPS regressions generate thirteen malformed/valid cases in all six supported
formats without Python, downloads or field fixtures. Independent native Raw/Rational
and physical TIFF tag checks verify the inputs and unchanged decoded pixels. Actual
copy builders retain raw values or refuse unsupported wire structures; product
copies omit invalid visible coordinates while retaining known input classifications.
Live native setter/readback failures and missing/wrong target echoes publish nothing.

The receipt schema checks actual serialized native ledgers alongside existing pixel,
source, ownership and exit checks. It distinguishes issue `message` from entry
`reason`, known input omissions from finished-copy booleans, and rejects nested
stack keys. GPS-retention tests include disabled coordinates, caption-only copies,
invalid-but-retained GPS, metadata-free copies and unbuilt failures.

Invalid-control styling is checked on the actual composed parent region with only
the native tint view removed as the negative control. Every control keeps its
geometry, native content, mouse target, focus and accessibility; the long invalid
caption is checked again after scrolling its real clip.

Stored-name prerequisites rename an owned Node-created ASCII file through ordinary
C rename, then check source-backed readback against independent raw Buffer names,
dev/inode/size and payload. They run on local, HFS+, FAT32 and exFAT even when a
provider lacks exclusive claims. Real-image, collision and recovery assertions
cover the same publication paths. Required close-only and primary-plus-close
failures stop later images while preserving causes, validated workspace copies,
claimed entries and every cleanup issue.
