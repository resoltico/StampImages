# Stamp Images

A Finder Quick Action for macOS that stamps the date a photo was taken, where it
was taken and your own text onto copies of your images. Originals are never
modified. The same script also runs from the command line, with a JSON settings
file and a JSON receipt; see [HEADLESS.md](HEADLESS.md).

Source and releases: https://github.com/resoltico/StampImages

## Requirements

- macOS 12.3 or later, with Shortcuts.
- `exiftool` and `vips` (which includes `vipsheader`), installed with Homebrew:

```sh
brew install exiftool vips
```

The Quick Action is one standalone JavaScript for Automation (JXA) file. Node.js
and npm are needed only for development. Typefaces come from the macOS font
system, including faces activated by a font manager.

## Install in Shortcuts

1. Download `Stamp-Images.jxa` from a
   [release](https://github.com/resoltico/StampImages/releases), or use
   `dist/Stamp-Images.jxa` from a source checkout.
2. In Shortcuts, create a shortcut and enable **Use as Quick Action → Finder**
   in its details. Configure it to receive **Files** from Finder.
3. Add **Run JavaScript for Mac Automation** and replace its example code with
   the complete JXA file.
4. Name the shortcut **Stamp Images**.

To install a newer build, replace the entire pasted script.
[INSTALL.txt](INSTALL.txt) has plain-text steps for verifying a download,
installing and removing the action.

## Use it

1. Select images or folders in Finder and run **Stamp Images**.
2. If some selected items cannot be stamped, a review lists each one with its
   reason and folder; choose **Continue** or **Cancel**.
3. Choose the settings and click **Create**. The note above the controls says
   how many stamped copies will be made and where they will be saved. If a
   setting is wrong, every problem is listed at once and your draft is kept.
4. A progress panel shows the current image. **Stop** changes to disabled
   **Stopping…** feedback immediately, takes effect at the next safe point and
   keeps every copy already saved.
5. Completion lists what was saved, where, and anything to know about each copy.
   **Show in Finder** reveals the copies; **Details** shows technical
   diagnostics and **Back** returns to the summary.

Run without input files, for example from the Shortcuts menu bar, to use Finder’s
current selection.

Appearance settings, including the GPS choice, are remembered for the next run
in the preferences domain `com.resoltico.StampImages`; custom text is not. To
reset them:

```sh
defaults delete com.resoltico.StampImages
```

Stamped copies retain standard EXIF capture fields and GPS, writable XMP/IPTC,
and color profiles. Orientation and dimension metadata describe the upright copy.
Proprietary maker data already retained by the image backend is preserved; not every
vendor-specific field or embedded preview can be transferred.

## Settings

| Field | Setting | Values | Default |
| --- | --- | --- | --- |
| `dateFormat` | Date/time format | `iso-minutes` (2026-09-09 14:30), `iso-date` (2026-09-09), `long-date` (September 9, 2026), `none` | `iso-minutes` |
| `coordinateFormat` | Coordinate format | `none`, `decimal` (56.9496, 24.1052), `sexagesimal` (56°56'58.6"N 24°6'18.7"E) | `none` |
| `customText` | Custom text | Up to 500 UTF-16 code units after line-ending normalization; may span lines | empty |
| `font` | Typeface | An installed face, named as in Font Book: `Georgia`, `Georgia Bold`, `Avenir Black` | Helvetica Neue |
| `size` | Text size | 8–400 pt, at the image's own scale | 36 |
| `textColor` | Text color | `#RRGGBB` | `#FFFFFF` |
| `outlineWidth` | Outline | 0–20 px; 0 for none | 2 |
| `outlineColor` | Outline color | `#RRGGBB` | `#202020` |
| `position` | Position | `bottom-right`, `bottom-left`, `top-right`, `top-left`, `bottom-center`, `top-center` | `bottom-right` |
| `margin` | Margin | 0–2000 px from the edges the position names | 24 |

The form prefers Helvetica Neue when available, otherwise the first installed
suggestion. Settings files always require `font`; declared defaults do not fill
omitted fields. Localized Font Book family and face names are accepted when they
resolve uniquely to an installed catalog face; PostScript names remain refused.
Some catalog weight names, including Hiragino Sans W3/W6, can render at the same
weight in the text renderer even though macOS identifies distinct installed faces.
Command-line typefaces are checked before tools or image
inspection. See [HEADLESS.md](HEADLESS.md) for receipts and exit precedence.

The stamp says at least one thing: a date, coordinates or custom text. The date
uses the first valid `DateTimeOriginal` or `CreateDate`, in that order, never the
file's modification time; coordinates come from its GPS tags. Blank/all-zero dates
are absent; impossible recorded dates, including nonzero dates in year 0000, are
left off as invalid.
GPS requires complete coordinate pairs, explicit valid references and valid original
components. Invalid or incomplete EXIF coordinates are left off rather than replaced
with XMP; XMP coordinates carry their own hemisphere when no EXIF pair is recorded.
Copies retain original GPS values without normalization, or the copy is refused.
Both describe what the camera recorded, not an independently verified time or
place. An image that lacks a requested field is still stamped with what it has,
and completion says which field was missing or recorded but not valid. An image
with nothing to stamp gets no copy.

Every character uses the chosen text color. Color emoji become monochrome
coverage masks and can appear as solid silhouettes without their colored internal
detail; use plain symbols or text when that distinction matters. Characters the
typeface lacks are drawn in another face, and the copy says so. Each paragraph
keeps its own writing direction and physical left alignment, so mixed directions
do not reorder dates or coordinates. Hex color text accepts outer whitespace.
A stamp larger than an image is refused for that image. Excessive margins are
reduced at each selected edge to keep the stamp in the selected half of the image;
centered axes stay centered, and completion explains a reduced margin.

## Images and copies

Supported formats are JPEG, PNG, HEIC/HEIF, TIFF, WebP and AVIF, in RGB or
grayscale, with a matching filename extension. Convert other color models, such as
CMYK, before stamping. Animated and multi-image files, GIF, vectors, documents and
camera RAW are refused, as are files whose content turns out to be damaged.
Ultra HDR JPEG photos are stamped as standard-range JPEG copies, without gain maps.

Selected folders are searched recursively. The search skips hidden entries,
packages, links and earlier stamped copies, and reports unreadable entries and
visible special files such as pipes and sockets.
Overlapping selections and hard links are stamped once.

Every stamped copy is saved beside its original, including images found in selected
subfolders. Copies are named
`holiday_stamped.jpg`, then `holiday_stamped 2.jpg` and so on; nothing is ever
overwritten. Leading dots, underscores and legal stem spelling remain intact, as
does a matching extension’s case. Controls, line breaks and path separators become
underscores; long names are shortened to leave room for collision numbering.
Selecting a stamped copy directly stamps it again.

A copy keeps its source's format, chosen from the image content rather than its
extension: a PNG named `photo.jpg` becomes `photo_stamped.png`. PNG and TIFF are
saved losslessly; JPEG, HEIC, WebP and AVIF are re-encoded at quality 90, which can
change pixels. EXIF orientation is applied, so the stamp sits along the edge you
see. Gray originals stay gray with neutral text and outline colors. Active colored
text or an enabled colored outline makes the copy RGB while retaining 16-bit gray
precision. Readable profiles are retained or transformed for the copy’s space; the
receipt reports the actual saved representation.

## Privacy and safety

**Turning GPS off does not remove location data.** Completion reports verified
retained GPS metadata even for caption-only copies. The CLI receipt carries
`locationRetained`; it does not claim the coordinates are valid. Copies retain capture
metadata, including coordinates, and color profiles. HDR copies omit their gain
maps. This is not an anonymization tool.

Stamp Images reads only the images you select, works in a private temporary
folder, and never opens an original for writing. Nothing is sent over the
network. Recovery normally uses Downloads under the intended name, or a checked
temporary copy, and completion shows the actual stored name. If a created copy's
name cannot be verified, the original stays in its workspace when it can still be
verified; otherwise no recovery path is claimed. [SECURITY.md](SECURITY.md)
describes the file-safety rules in full.

## Command line

```sh
osascript -l JavaScript Stamp-Images.jxa -- --headless settings.json photo.jpg folder
```

Command-line runs open no dialogs and do not use remembered settings.
[HEADLESS.md](HEADLESS.md) specifies the settings file, the JSON receipt and the
exit statuses.

## Verify a download

Each release carries a checksum manifest and GitHub build attestations. From the
download folder, with GitHub CLI installed:

```sh
gh attestation verify Stamp-Images.jxa --repo resoltico/StampImages
shasum --check SHA256SUMS
```

The checksum verifies the downloaded file, not a copy pasted into Shortcuts. The
script's header and completion details state its version.

## Development and license

[CONTRIBUTING.md](CONTRIBUTING.md) covers setup, source layout and releases.
[QA.md](QA.md) defines the verification requirements and their limits.
[SECURITY.md](SECURITY.md) describes the trust boundaries and private reporting.

Stamp Images is licensed under the [GNU Affero General Public License, version 3
only](LICENSE) (`AGPL-3.0-only`). You may use it, including commercially, and copy,
modify and share it under those terms; it comes without any warranty. If you
distribute the script or a modified version, keep its notices and make the
corresponding source available as the license requires; the generated JXA names
the source for its version. Dependencies keep their own licenses. A separate
commercial licensing route is intended but not yet offered; see
[LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md).
