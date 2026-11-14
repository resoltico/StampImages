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
4. A progress panel shows the current image. **Stop** takes effect at the next
   safe point and keeps every copy already saved.
5. Completion lists what was saved, where, and anything to know about each copy.
   **Show in Finder** reveals the copies; **Details** shows technical
   diagnostics and **Back** returns to the summary.

Appearance settings, including the GPS choice, are remembered for the next run
in the preferences domain `com.resoltico.StampImages`; custom text is not. To
reset them:

```sh
defaults delete com.resoltico.StampImages
```

## Settings

| Field | Setting | Values | Default |
| --- | --- | --- | --- |
| `dateFormat` | Date/time format | `iso-minutes` (2026-09-09 14:30), `iso-date` (2026-09-09), `long-date` (September 9, 2026), `none` | `iso-minutes` |
| `coordinateFormat` | Coordinate format | `none`, `decimal` (56.9496, 24.1052), `sexagesimal` (56°56'58.6"N 24°6'18.7"E) | `none` |
| `customText` | Custom text | Up to 500 UTF-16 code units; may span lines | empty |
| `font` | Typeface | An installed face, named as in Font Book: `Georgia`, `Georgia Bold`, `Avenir Black` | Helvetica Neue |
| `size` | Text size | 8–400 pt, at the image's own scale | 36 |
| `textColor` | Text color | `#RRGGBB` | `#FFFFFF` |
| `outlineWidth` | Outline | 0–20 px; 0 for none | 2 |
| `outlineColor` | Outline color | `#RRGGBB` | `#202020` |
| `position` | Position | `bottom-right`, `bottom-left`, `top-right`, `top-left`, `bottom-center`, `top-center` | `bottom-right` |
| `margin` | Margin | 0–2000 px from the edges the position names | 24 |

The stamp says at least one thing: a date, coordinates or custom text. The date
comes from the image's `DateTimeOriginal`, or `CreateDate` when that is absent,
never from the file's modification time; coordinates come from its GPS tags.
Both describe what the camera recorded, not an independently verified time or
place. An image that lacks a requested field is still stamped with what it has,
and completion says which field was missing or recorded but not valid. An image
with nothing to stamp gets no copy.

Every character uses the chosen text color, including emoji, which are drawn as
silhouettes. Characters the typeface lacks are drawn in another face, and the copy
says so. Each line keeps its own writing direction, so a right-to-left caption
does not reorder the date or coordinates. A stamp larger than an image is refused
for that image; a margin larger than the room available places the stamp against
the opposite edge, and the copy says so.

## Images and copies

Supported formats are JPEG, PNG, HEIC/HEIF, TIFF, WebP and AVIF, in RGB or
grayscale, with a matching filename extension. Convert other color models, such as
CMYK, before stamping. Animated and multi-image files, GIF, vectors, documents and
camera RAW are refused, as are files whose content turns out to be damaged.
Ultra HDR JPEG photos are stamped as standard-range JPEG copies, without gain maps.

Selected folders are searched recursively. The search skips hidden entries,
packages, links and earlier stamped copies, and reports entries it cannot read.
Overlapping selections and hard links are stamped once.

A copy of an image found in a selected folder is saved in that selected folder; a
copy of an image selected directly is saved beside it. Copies are named
`holiday_stamped.jpg`, then `holiday_stamped 2.jpg` and so on; nothing is ever
overwritten. Selecting a stamped copy directly stamps it again.

A copy keeps its source's format, chosen from the image content rather than its
extension: a PNG named `photo.jpg` becomes `photo_stamped.png`. PNG and TIFF are
saved losslessly; JPEG, HEIC, WebP and AVIF are re-encoded at quality 90, which can
change pixels. EXIF orientation is applied, so the stamp sits along the edge you
see. A colored stamp on a grayscale image makes the copy RGB, and the copy says so.

## Privacy and safety

**Turning GPS off does not remove location data.** Copies retain capture
metadata, including coordinates, and color profiles. HDR copies omit their gain
maps. This is not an anonymization tool.

Stamp Images reads only the images you select, works in a private temporary
folder, and never opens an original for writing. Nothing is sent over the
network. If a copy cannot be saved where it belongs, it is saved to Downloads
under its intended name, or failing that to a checked temporary copy, and
completion shows where. [SECURITY.md](SECURITY.md) describes the file-safety rules
in full.

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
