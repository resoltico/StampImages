# Changelog

## [Unreleased]

- Licensed under AGPL-3.0-only instead of MPL-2.0; distributors must offer corresponding source. See [commercial licensing](LICENSE-COMMERCIAL.md).
- The `empty-stamp` issue now uses stage `settings` and field `customText`; update consumers matching the old request stage.
- Setup refusals use receipt state `invalid` and exit 3; invalid command-line settings/typefaces are checked first and exit 2.
- Canceled runs now always exit 1, including setup. SIGINT/SIGTERM and cancellation in filesystem, tool or workspace probes request the same cooperative stop.
- `elapsed` now counts image processing only, excluding setup, source inspection, settings and review dialogs.
- Receipts add `locationRetained` for validated finished copies and omit stack traces; selection entries are documented with `reason`, issues with `message`.
- Contributors need Node 26.13.1 and npm 12.2.2; restore development dependencies with `npm ci --ignore-scripts`.
- Contributions follow the [contribution terms](CONTRIBUTING.md#contribution-terms), which also permit commercial licensing by Ervins Strauhmanis.
- Older ExifTool builds may need upgrading; setup checks every tool and names unusable overrides and their values.
- Destination folders need read/search access to verify stored filename bytes; uncertain names retain validated originals without guessing paths or deleting claimed copies.
- Missing or replaced originals are not removed or claimed as recoveries; confirmed outputs survive cleanup faults while affected workspaces are retained.
- Prefix relative names that look like URI schemes, such as `photo:one.jpg`, with `./`. Local `file://` settings URLs work; remote or malformed URLs are refused.
- Folder runs save copies beside each original. Legal stems and matching extension case are kept; long names are shortened with room for collision numbers.
- Decoder warnings refuse damaged JPEGs and truncated HEIC. Unsupported content names its loader; missing paths precede format checks and folder special files are reported.
- All output formats retain standard capture metadata, GPS and profiles with upright dimensions; Ultra HDR JPEGs become standard-range JPEG copies without gain maps.
- 16-bit gray images work. Neutral stamps keep gray; colored stamps retain 16-bit precision, and expansion notes describe the actual saved representation.
- Invalid GPS references or components are reported and left off the stamp; copies preserve original GPS values without normalization or fail safely.
- Missing and invalid metadata have distinct notes and survive later failures. Blank/all-zero dates are missing; impossible/nonzero year-0000 dates are invalid, with first-valid capture-date fallback.
- Completion reminds you when embedded GPS remains, including caption-only copies and visible coordinates switched off; this does not assert that coordinates are valid.
- Invisible-only captions are refused; CRLF normalizes, and mixed-direction multiline text keeps its direction and left alignment. Excessive margins stay on the selected side.
- Text size hints explain image pixels and larger-photo sizing. Color emoji may appear as silhouettes, and some native weight names can render alike.
- Localized Font Book family and face names are accepted when they identify an installed catalog choice.
- The Quick Action uses Finder’s current selection when no input files are supplied.
- Forms mark every invalid control consistently in both appearances. Scrollable details and captions open at the top and preserve later user scrolling.
- Stop is a push button with disabled “Stopping…” feedback. Plain stops omit empty Details, and reports omit empty diagnostic values.
- Recovered copies have a “Saved elsewhere” section with their cause; failed-only headings and separate cleanup issues keep saved work clear.
- Command-line reports precede JSON; stdout failures, including help/version, exit 1 with one plain stderr line while confirmed copies stay saved.
- Command-line help offers complete settings JSON, caption limits and newline syntax; missing/wrong-type errors name JSON keys, and tool messages use a fixed locale.

## [2.0.0] - 2026-11-05

- Headless settings use US English names: `textColor`, `outlineColor`, `bottom-center` and `top-center`. All ten fields are required and typed; update settings files.
- Receipts are rebuilt around per-image records, `canceled`/`not-started` states, `elapsed` and stable issue codes; see [HEADLESS.md](HEADLESS.md). No migration is provided.
- The `long-date` format stamps US-style dates such as `September 9, 2026`.
- Remembered settings from 1.2.x open the defaults; the old `lastSettings.v1` entry is removed when settings are next remembered.
- Command-line runs never open dialogs; usage errors name the problem; `--help` lists values and defaults; exit statuses are 0, 1, 2 and 3.
- A right-to-left caption no longer reorders the stamped date or coordinates.
- One image too small for its stamp fails alone instead of stopping the rest of the run.
- Sources are inspected before settings and processed from a checked private copy; disguised, animated, multi-image and truncated files are refused.
- The copy's format follows the image content, so a PNG named `.jpg` becomes `_stamped.png`.
- Copies are never overwritten: collisions use `_stamped 2`, and a failed save is recovered to Downloads or a confirmed temporary copy.
- Copy names keep the original's Unicode form; pipes and devices are refused as such, and earlier numbered `_stamped_2` copies count as inputs.
- Each copy reports missing or invalid metadata, crowded placement, grayscale expansion, unread profiles and characters drawn in a fallback face.
- One progress panel with Stop; Stop keeps saved copies and retains a finished unsaved copy in its workspace.
- The form lists every problem at once, keeps your draft, and states how many copies will be made and where; Tab leaves the custom text.
- Completion counts copies kept elsewhere, groups copies by folder, and offers Show in Finder for every copy and Details with Back.
- PostScript typeface names are answered with their Font Book name; unavailable faces are refused before stamping.
- Wording, spelling and command-line conventions match Image Files to PDF, in US English.

## [1.2.1] - 2026-10-05

### Changed

- First-party project files are now licensed under Mozilla Public License 2.0
  (`MPL-2.0`). Earlier published versions remain under MIT; dependencies retain
  their own licenses. The standalone JXA preserves the MPL notice and links to
  its source, and the complete `LICENSE` is an attested release asset.

### Fixed

- Failed or malformed image page-count readings no longer bypass multi-image
  protection and publish a copy containing only the first image. Only an
  explicitly absent `n-pages` field is treated as a single-image file.
- Invalid image dimensions and band counts are refused before they can affect
  stamp placement or cause a copy to lose transparency. Decoded intermediates
  from failed reads or measurements are removed immediately.
- Setup finds Homebrew in its standard locations under Shortcuts' minimal PATH.

## [1.2.0] - 2026-09-27

### Added

- An **Include GPS coordinates** checkbox, with the coordinate format beside
  it. It is off by default and remembered from one run to the next like the
  other settings, so if you stamped coordinates before, it opens already on.
  The format can be chosen only while the checkbox is on.
- The settings window says how many images you selected, or how many were
  found in the folders you selected. It also says where the copies will be
  saved, that the date and place come from each photograph, and that leaving
  GPS off does not remove location data already in the image.
- Items in your selection that cannot be stamped are listed before the
  settings, and you can cancel there instead of finding out afterwards.
- Every setting in the settings window has an accessible name and description.

### Changed

- The settings window's button is now **Create**. When the stepwise dialogs
  stand in for the window, they end by asking you to confirm the settings, and
  they keep the answers you had already corrected in the window. Settings are
  remembered only once you confirm them.
- The completion message says where the copies were saved and lists each kind
  of shortfall under its own heading, including copies that lack a date or a
  place you asked for.
- For headless runs, a copy that lacks a requested date or place is now listed
  in the receipt under `missingMetadata`, and makes the run exit non-zero. The
  copy itself is kept.

### Fixed

- A run with no date, no coordinates and no text of your own is sent back for
  correction in the settings window. Previously it failed only after you had
  confirmed it.

## [1.1.0] - 2026-09-19

### Added

- You can now stamp with any typeface installed on your Mac, not only the ones
  the settings window suggests. The Typeface control is a list you can also
  type into: pick a suggestion, or write the name of another face.
- Styles other than regular and bold can be asked for by name. Write the
  family, then the style you want after it — `Avenir Black`, `Gill Sans
  Light`, `Helvetica Neue Condensed Bold`. Fonts switched on by a font manager
  and the named styles of a variable font, such as `Source Serif 4 Semibold`,
  are named the same way.
- A typeface your Mac does not have is refused, with the reason, before any
  photograph is touched. Ask a family for a style it does not come in, and the
  message says which styles it does come in.
- Instructions for removing the action. INSTALL.txt now ends with how to take
  it off your Mac and what it leaves there: one preferences entry, holding the
  appearance of your last run.

### Changed

- The settings window opens sooner. The typefaces it offers no longer have to
  be drawn out one by one before it can appear.

### Fixed

- A black-and-white photograph no longer turns a coloured caption grey. The
  copy is written in colour so the caption keeps the colour you chose, the
  picture itself is unchanged, and the report says how many photographs were
  treated that way. Grey, white and black captions were never affected.
- A colour profile that cannot be read is reported instead of being treated as
  a photograph that carries none — which had been counted as a run where
  everything went well, with the caption painted in the wrong colours.
  Photographs with very long names were the likeliest way to hit it.
- A Mac with none of the suggested typefaces available opens the settings
  window, so you can name one it does have. It used to refuse to run at all.
- Your remembered settings are kept when the typeface you last used is no
  longer on your Mac. They were all forgotten; now only the typeface has to be
  chosen again.
- A settings file that names a typeface your Mac does not have stops with the
  reason, instead of stamping every photograph in a stand-in face and
  reporting success.

### Internal

- Property-based tests for coordinates and dates, and a reorganised quality
  record.

## [1.0.0] - 2026-09-14

- First release.
