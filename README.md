# Stamp Images

Stamp capture dates, GPS coordinates and custom text into copies of photographs
with a macOS Finder Quick Action or a noninteractive command. Originals are never
opened for writing, moved or deleted. Nothing is sent over the network.

## Requirements and installation

Use macOS 12.3 or later and install the runtime tools with Homebrew:

```sh
brew install exiftool vips
```

Download `Stamp-Images.jxa` from the
[releases page](https://github.com/resoltico/StampImages/releases), then follow
[INSTALL.txt](INSTALL.txt) to verify the download and create the Finder Quick
Action in Shortcuts. Node is needed only for development.

## Using the Quick Action

Select image files or folders in Finder and run **Stamp Images**. Folders are
searched recursively. Copies of images discovered within a selected folder go
into that selected folder, including images in subfolders. Directly selected
images get copies beside them. Overlapping selections and hard links are
processed once; the outermost selected folder takes precedence.

Review any selection problems, then choose the ten settings for the run:

- Date/time format, including an option to omit it.
- Coordinate format; GPS is off by default.
- Custom text, including multiple lines.
- Installed typeface name, selected from suggestions or typed.
- Text size and colour.
- Outline width and colour.
- Position and margin.

Name typefaces as Font Book does, such as `Georgia`, `Georgia Bold` or
`Avenir Black`. An unavailable name is refused before stamping. Custom text may
contain up to 500 UTF-16 code units; null characters and incomplete Unicode are
refused. All glyphs use the chosen text colour, including monochrome silhouettes
of colour emoji.

Click **Create** to start. Independent setting errors appear together, and the
form keeps your draft while you correct them. When native form capability is
unavailable, stepwise dialogs end with a Create confirmation. Appearance settings,
including the GPS choice, are remembered in the preferences domain
`com.resoltico.StampImages`; custom text is never remembered.

The progress panel shows the current work and provides **Stop**. Stop takes effect
at the next safe checkpoint, keeps saved copies and retains any finished
unpublished copy in its existing temporary workspace. It reports the retained
path without starting a new Downloads access request. Completion reports saved,
recovered and unfinished work, metadata omissions and appearance notes, with
selectable details and **Show in Finder** for available copies.

## Supported files and output

Supported still-image formats are JPEG, PNG, HEIC/HEIF, TIFF, WebP and AVIF, in RGB
or greyscale. Convert other colour models, such as CMYK, before stamping. Animated
and multi-image files, GIF, vectors, documents and camera RAW are refused. A
supported filename extension is required for discovery; inspected image content
determines the encoder and output extension. A PNG named `photo.jpg` produces
`photo_stamped.png`.

A copy normally keeps its source encoding. JPEG, HEIC, WebP and AVIF are re-encoded
with quality 90; PNG and TIFF use lossless encoding. Re-encoding can change image
pixels. A coloured caption on a greyscale source expands the copy to RGB and is
reported. Colour profiles are used when converting caption colours; conversion
problems are reported.

Copies use names such as `holiday_stamped.jpg`, then `holiday_stamped 2.jpg` on a
collision. Nothing is overwritten. Folder walks skip dot-prefixed entries,
packages, links and supported images whose stems end in `_stamped` or
`_stamped <digits>`. Other supported names, including `holiday_stamped_2.jpg`, are
inputs. Explicitly selecting a stamped image stamps it again. Unreadable entries
are reported rather than silently omitted.

The stamp's date comes from `DateTimeOriginal` or `CreateDate`, never the file's
modification time or today's date. Dates and coordinates describe the camera's
metadata, not independently verified time or location. Missing requested metadata
is reported; custom text can still be stamped. A photograph with no requested
content gets no copy and an explanation.

**Turning GPS off does not remove embedded location metadata.** Copies retain
source metadata, including coordinates. This is not an anonymisation tool.

Sources are inspected before settings, then captured into private workspaces with
identity, size and version checks. Metadata, profiles and pixels come from the
same captured bytes. Coarse filesystem timestamps limit detection of concurrent
edits; stop other writers while stamping.

Failed publication attempts recovery to Downloads under the intended filename,
then a confirmed temporary copy. If recovery cannot be completed, the workspace
is retained and its location reported. Filesystem drivers without the necessary
exclusive publication support use recovery; this includes FAT32 on some hosts.
Only dead-owner workspaces without retained work are reclaimed. Follow reported
recovery paths promptly because system temporary storage is not permanent.

## Noninteractive use

```sh
osascript -l JavaScript dist/Stamp-Images.jxa -- --headless settings.json photo.jpg
```

[HEADLESS.md](HEADLESS.md) specifies settings, JSON receipts, exit statuses and tool
overrides. CLI runs open no dialogs and do not access interactive preferences.

## Development and verification

[CONTRIBUTING.md](CONTRIBUTING.md) covers clean setup, source layout, builds and
releases. [QA.md](QA.md) defines automated and live acceptance requirements; it is
not a claim that every supported host has been qualified.

## License and security

First-party files use [Mozilla Public License 2.0](https://mozilla.org/MPL/2.0/)
(`MPL-2.0`); see [LICENSE](LICENSE). Dependencies retain their own licenses. Preserve
notices and provide covered source and modifications as required when distributing.
The standalone script links to its corresponding source.
[SECURITY.md](SECURITY.md) describes the security model and private reporting.
