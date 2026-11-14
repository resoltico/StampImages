# Command line

Stamp Images runs from the command line with `osascript`. Node is not needed.

```sh
osascript -l JavaScript Stamp-Images.jxa -- --help
osascript -l JavaScript Stamp-Images.jxa -- --version
osascript -l JavaScript Stamp-Images.jxa -- --headless settings.json photo.jpg folder
```

`--help` lists every setting with its accepted values and a complete JSON example; `--version` prints
`Stamp Images <version>`. Both print to stdout and exit 0. Anything else that is not
a complete `--headless` request is a usage error: it names the problem, prints the
run line and exits 2.

A command-line run never opens a dialog and neither reads nor writes remembered
settings. External tools run in the C locale so message parsing does not depend on
the terminal language. Paths may be absolute or relative to the working directory. Local
`file://` URLs for settings and images are accepted; remote URLs of any scheme are refused.
A relative filename containing a colon needs an explicit `./` prefix, for example
`./photo:one.jpg`, to distinguish it from a URL scheme. Missing paths are reported
before filename-format checks; permission failures remain distinct.

## Settings file

The settings file is UTF-8 JSON without a byte-order mark, and its root is an
object. All ten fields are required; unknown fields, numeric strings, fractional
numbers, `null` and wrong types are refused, and every problem is reported together.
Command-line messages identify JSON keys and distinguish missing fields from wrong
JSON types; Quick Action messages retain their form labels.
Duplicate keys follow `JSON.parse`: the last value wins. Declared defaults are
shown in the complete `--help` example; they do not fill omitted fields in a settings file.

Settings and the installed typeface are checked before tool discovery or source
admission. Invalid settings take precedence over missing tools and exit 2,
including when the configured typeface is unavailable.

```json
{
  "dateFormat": "iso-minutes",
  "coordinateFormat": "none",
  "customText": "",
  "font": "Helvetica Neue Bold",
  "size": 36,
  "textColor": "#FFFFFF",
  "outlineWidth": 2,
  "outlineColor": "#202020",
  "position": "bottom-right",
  "margin": 24
}
```

| Field | Setting | JSON value |
| --- | --- | --- |
| `dateFormat` | Date/time format | `iso-minutes`, `iso-date`, `long-date` or `none` |
| `coordinateFormat` | Coordinate format | `none`, `decimal` or `sexagesimal` |
| `customText` | Custom text | String of up to 500 UTF-16 code units; may contain newlines; CRLF and CR normalize to LF before counting; NUL and unpaired surrogates are refused |
| `font` | Typeface | Nonblank name of an installed face, as in Font Book; trimmed |
| `size` | Text size | Integer 8–400 (points at the image's scale) |
| `textColor` | Text color | Six hexadecimal digits, optional `#`; normalized to uppercase `#RRGGBB` |
| `outlineWidth` | Outline | Integer 0–20 (pixels) |
| `outlineColor` | Outline color | Six hexadecimal digits, optional `#`; normalized to uppercase `#RRGGBB` |
| `position` | Position | `bottom-right`, `bottom-left`, `top-right`, `top-left`, `bottom-center` or `top-center` |
| `margin` | Margin | Integer 0–2000 (pixels) |

A request must stamp something: a date format, a coordinate format or visible
custom text. Whitespace, Unicode control/format characters and blank fillers alone
are empty text; combining sequences, emoji and right-to-left scripts remain valid. `coordinateFormat` controls only what the stamp shows; copies keep the
location metadata their originals carry. Ultra HDR JPEGs produce standard-range
JPEG copies without gain maps; capture metadata and color profiles are retained.

Copies retain standard EXIF capture fields and GPS across supported output formats,
plus writable XMP/IPTC and the copy’s color profile. Orientation and EXIF/XMP
dimensions describe the upright stamped pixels. Proprietary maker fields are not
guaranteed across encoders; existing retained maker data is not deleted.

## Receipt and exit status

Every handled request attempts the plain-language report on stderr before one JSON
object ending in a newline on stdout. `stack` keys are omitted at serialization; other
structured diagnostic data is retained. Read both the receipt and the exit status. Recovered copies appear under
“Saved elsewhere” with a one-line cause; “Could not stamp” lists failed copies
only, and other cleanup or run problems have their own section.

| Exit | Meaning |
| --- | --- |
| `0` | Complete |
| `1` | Incomplete, stopped or output transport failed; confirmed copies are kept |
| `2` | Usage error or invalid settings |
| `3` | Could not start: setup failed |

| Field | Meaning |
| --- | --- |
| `state` | `complete`, `incomplete`, `canceled` or `invalid` |
| `images` | One record per admitted image, in processing order |
| `rejected` | Selected items that were not admitted |
| `excluded` | Earlier stamped copies found in selected folders and left alone |
| `issues` | Problems affecting the request as a whole |
| `diagnostics` | Optional-surface, cleanup and prior-workspace diagnostics |
| `elapsed` | Human-readable processing time, from the first image's preparation to completion; excludes dialogs and is absent before processing |

Exit 3 identifies failed setup, including required tools or native capabilities
that are unavailable. A cancellation exits 1 in every phase. After settings and
typeface validation, SIGINT and SIGTERM request the same cooperative stop as the
Quick Action: an in-flight native command finishes before the next safe checkpoint
observes the request. Monitoring remains owned through receipt/report transport;
the command-line process exits and the OS reclaims its signal resources.

`complete` requires every admitted image saved with everything requested, nothing
rejected and no issues. An abrupt process end or a failed stdout cannot guarantee a
receipt. If stdout fails, one plain stderr line says "Standard output could not be
completed." and the exit status is 1; saved copies remain confirmed. Help/version
use the same stdout failure rule. A stderr refusal still allows one receipt attempt
before its original failure is retained. SIGPIPE is ignored only during each native
transport write, with the complete prior disposition restored afterward; processing
and child commands keep their inherited signal behavior.

Prior workspaces left retained or unreadable, and safely reclaimed stale
workspaces, appear in a `Temporary work` report section when their exact workspace
paths are known. Their existing diagnostic object shape is unchanged;
`workspace-reclaimed` records successful reclamation with stage `workspace` and
`diagnostic.path`. These informational diagnostics do not change run state.

Output and recovery basenames are read back after publication and match the
actual directory entry bytes; creation preserves source spelling where the
filesystem permits it. A name-verification refusal keeps the validated original
in its private workspace and reports claim uncertainty without inventing a public
output path. A missing or replaced original is a fatal fault with no asserted
recovery path; a confirmed public output remains saved when original cleanup
cannot safely proceed.

## Image records

Each record has the image's full `source` path, `state`, `issues` and
`missingMetadata`.

| State | Meaning |
| --- | --- |
| `saved` | Stamped and saved; `output` is the copy's full path |
| `recovered` | Saved somewhere else; `recovery` is the actual location |
| `nothing-to-stamp` | The image has none of the requested content; `reason` explains |
| `failed` | Not stamped; `issues` explain |
| `canceled` | Stop interrupted this image |
| `not-started` | An earlier stop or fault ended the run first |

`missingMetadata` lists requested fields the image cannot supply ("date/time",
"GPS coordinates"). `invalidMetadata`, present only when non-empty, names those
that are recorded but not valid, such as a zero date or a latitude beyond 90°.
Either makes the run incomplete while keeping the copy.

Saved and recovered records also carry appearance notes, each `true` or `false`:

| Note | Meaning |
| --- | --- |
| `crowded` | The margin was larger than the room; the stamp sits against the opposite edge |
| `expanded` | A colored stamp on a grayscale image made the copy RGB |
| `unconverted` | The image's color profile could not be read; colors were drawn in sRGB |
| `substituted` | Some characters were not in the typeface and were drawn in another one |

A `recovery` path may be in Downloads, a temporary copy, or the retained workspace;
the record's issues say which. A copy whose validation faulted stays in its
workspace and is reported as a workspace issue, not as a recovered image.

## Issue codes

Every issue and every `rejected` entry carries a `code`, a `stage` and a `message`;
an issue may also carry `field`, `source` and `diagnostic`. An `unsupported-content`
refusal includes `diagnostic.loader`, the vips loader that recognized its content.

| Stage | Codes |
| --- | --- |
| `request` | `usage`, `settings-file` |
| `settings` | `unknown`, `choice`, `integer`, `text`, `color`, `typeface`, `object`, `empty-stamp` |
| `setup` | `operation` when a required tool is missing or unusable |
| `selection` | `folder`, `unsupported-format`, `not-a-file`, `not-a-path`, `remote-url`, `package`, `link`, `special-file`, `unreadable`, `unexaminable`, `already-stamped`, `empty-folder`, and the run issue `no-images` |
| `inspection` | `unreadable`, `empty`, `not-an-image`, `unsupported-content`, `unsupported-color`, `multiple-images`, `damaged` |
| `stamping`, `publication`, `recovery`, `cleanup` | `operation`, `fault`, `canceled`, `damaged`, `publication`, `recovery`, `cleanup` |

A supported-looking file opened by an excluded loader is `unsupported-content`,
with the loader in its diagnostic. Truncated recognized HEIC is `damaged`; text
with a HEIC extension remains `not-an-image`. Visible pipes, sockets and devices
inside selected folders are reported as `special-file` without being opened.

`unsupported-color` means the image needs converting to RGB or grayscale. A file
whose header looks right but whose decoding fails, such as a truncated JPEG, is
refused as `damaged` at the `stamping` stage, with the decoder's output in its
`diagnostic`. A stamp larger than its image is an `operation` failure for that image
only. Software faults (`fault`), cleanup failures and a stop end the run; remaining
images are `not-started`. Confirmed copies are kept in every case.

`empty-stamp` identifies `customText` at the `settings` stage.

## Tool overrides

`STAMP_IMAGES_VIPS`, `STAMP_IMAGES_VIPSHEADER` and `STAMP_IMAGES_EXIFTOOL` may name
explicit executables. An override that is missing, relative or unusable fails
setup with state `invalid` and exit status 3; another executable is never silently
substituted. Errors name the variable and its value. Setup probes all three tools,
including a real width read by `vipsheader` from a built-in PNG.
