# Contributing

## Working on this

Use the Node and npm versions declared by mise.toml (also checked against
.node-version and package.json). Run `mise install` and `mise exec -- npm ci --ignore-scripts`
from a clean checkout, or install those exact versions with your own version manager.

```sh
brew install exiftool vips shellcheck actionlint
npm ci --ignore-scripts
npm run release
```

`npm run release` regenerates `dist/` and runs the full gate. `npm run quality`
runs the gate without regenerating, which is what CI does, so that a stale
committed artifact fails instead of shipping.

The macOS integration gate needs the real tools and is run separately:

```sh
brew update
brew install exiftool vips shellcheck actionlint
npm run test:integration:macos
```

## What the gate enforces

`QA.md` is the contract. It specifies every check, its threshold, and why the
guard exists — coverage, ESLint mode, the language target, mutation
score, and the facts that must agree across files.

This file does not restate those rules, so that there is one place to change
when they move.

Two things worth knowing before you write code, because they shape where things
go rather than merely passing or failing:

- **A test belongs in `tests/unit/` if it takes its world by parameter, and in
  `tests/repo/` if it inspects the real repository.** Only the former is
  meaningful under mutation, where the tree is deliberately altered.
- **Rules that are switched off are listed with their reasons** in
  `tools/eslint/rules.mjs`. Add to that list only with a reason, never in bulk.

## Source layout

`src/core/` owns portable stamp rules, typed settings, geometry, source policy,
outcomes and artifact/workspace lifecycle rules. `src/application/` owns inspection
and run/per-image sequencing through explicit ports. `src/backend/` owns pure
vips/exiftool command and response contracts. `src/host/` adapts those contracts to
macOS, shell execution, fonts, files, CLI and AppKit. `src/entry.js` exposes the
production run entry. `tools/lint/boundaries.mjs` enforces these dependencies.

Keep UI answer conversion and wording in the host. Validate typed settings through
`src/core/settings.js`; do not add a competing CLI or preferences validator.
`src/core/inscription.js` decides what each image can say before rendering.
Inspect originals before consent, then capture and independently inspect private
bytes before metadata/profile extraction and decoding. Keep original paths for
reporting. Application outcomes own source mappings and state; presenters derive
counts and text without changing saved work.

The CLI and receipt contract is in [HEADLESS.md](HEADLESS.md). Keep it strict;
do not add migrations or compatibility aliases.

## Interface wording

Stamp Images and its sibling [Image Files to PDF](https://github.com/resoltico/ImageFilesToPDF)
are Finder Quick Actions on the same stack, used by the same people, so they share
one set of interface conventions and one document layout. Mirror a change here in
the sibling repository.

- US English everywhere: UI text, receipt tokens and messages, documents, comments
  and identifiers.
- Selected files are *images*; outputs are *stamped copies* (*PDFs* in the sibling).
  Buttons are `Create`, `Cancel`, `Continue`, `Stop`, `OK`, `Show in Finder`,
  `Details` and `Back`.
- Settings form: the message line is `Choose the stamp settings, then Create.`; the
  note opens with `<N images> → <outputs>, saved in <place>` and `Save locations:`.
  Corrections say `Correct the highlighted setting, listed below.` and the note lists
  them first. Range hints use an en dash and a unit (`8–400 pt`); color presets add
  `or type #RRGGBB`.
- Selection review: `<N items> in your selection cannot be included.`, then
  `Not included:` with `<name>: <reason sentence>` and `in <folder>`, ending
  `Continue with <N images>?`.
- Completion: `Created …` or `No … was created.`, prefixed `Finished with issues.`
  or `Stopped.`; copies saved elsewhere are counted in the headline, and refusals
  agreed to in the review do not add `Finished with issues.`. The detail lists the
  non-zero counts, `Saved to:`, notes, failures, recoveries, `Not started`,
  `Not included from your selection:`, `Elapsed:` and, in the dialog only, the
  version. `Show in Finder` reveals every saved or recovered copy; `Details` shows
  `key: value` lines and `Back` returns to the summary.
- Command line: the same commands and exit statuses; usage errors name the problem
  and print only the run line; `--help` lists `field — Name: values; default X`;
  stderr sections are separated by one blank line; receipts share the state and
  issue-code vocabulary in [HEADLESS.md](HEADLESS.md).
- Documents: README (users), INSTALL.txt (release asset), HEADLESS.md (command
  line), SECURITY.md (trust and file safety), QA.md (verification) and this file,
  with matching section order in both repositories. Documents describe the current
  state only; history belongs in `CHANGELOG.md`.

HDR admission records a boolean gain-map fact and compares it after capture.
JPEG output policy uses that fact to omit gain maps while retaining EXIF, ICC,
XMP and IPTC metadata, so stamped pixels are not boosted by the original map.
The native HDR suite checks the decoded loader, metadata, stamp pixels and source
bytes through the production artifact.

## The released artifact

Do not edit `dist/Stamp-Images.jxa` directly. `tools/scoped-bundle.mjs` uses pinned
esbuild with module scopes and a Safari 15.4 target. `tools/release.mjs` verifies
that every production module is reachable and emits the banner and checksum.
The artifact needs no Node or external JavaScript modules at runtime.

`tools/build-probe.mjs` builds explicit native test entrypoints with the same
bundler options. End-to-end tests must also invoke the actual production artifact.
First-party contributions use MPL 2.0; preserve notices and third-party licenses.
Edit sources, run `npm run release`, and review sources plus generated output.
`INSTALL.txt` remains plain text because it ships as a downloadable release asset.

## Releasing

Release only with authorization. Prepare the version declarations and dated
CHANGELOG section, rebuild and verify the committed artifact, then push
`v<version>`. The release workflow qualifies the tagged source on macOS, rebuilds the artifact on a clean runner,
and publishes it with a build attestation.

Three things are checked that a local build cannot check:

- **The tag names the version the repository already agrees on.**
  `tools/check-tag.mjs` compares it against the value the consistency gate
  derives from all six declarations of it, so tagging cannot paper over a
  disagreement.
- **The build is reproducible.** CI runs `npm run check-dist` first, so the
  committed artifact is proven to match `src/` while it is still untouched,
  then rebuilds and requires `git diff --exit-code -- dist/` to be clean. What
  is attested is therefore both built on GitHub and identical to what was
  reviewed here.
- **The tag still points at the commit being built.** A tag can be moved after
  it is pushed; the publish job re-resolves it and `gh release create
  --verify-tag` refuses one that has since changed.

Release notes come from `CHANGELOG.md` rather than a per-tag file, because a
second copy of the same prose is a second thing to keep in agreement.

`npm run release` builds and gates locally; it does not publish or create a tag.
Review and commit the generated `dist/` alongside its sources.

## Updating dependencies and toolchains

Use vendor release information to choose updates. Pin development dependencies in
`package.json` and restore them through `package-lock.json`. Declare Node in
`.node-version`, `mise.toml` and `package.json` engines, and npm in `mise.toml`,
`packageManager` and engines. The consistency gate checks these declarations.
Keep workflow action references pinned to reviewed vendor commit hashes.

The minimatch and glob overrides keep development tools off releases affected by
GHSA-g3hv-75wg-m249 and GHSA-3g3m-2fjr-6pw4.
They move together: glob 13 expects RegExp pattern parts, while minimatch 11
returns Matcher objects supported by glob 14. Remove these overrides when
all upstream ESLint and Stryker dependency ranges exclude every affected version.
The qs override fixes GHSA-6pq8-jhm2-2vcw in typed-rest-client, whose pinned
qs 6.15.1 is affected; remove it when its range excludes affected versions.

The Homebrew tools are not pinned at all — CI installs the current ones on
every run, so a breaking change there surfaces as a failing integration job
rather than as a silent drift.
