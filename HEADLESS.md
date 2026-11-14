# Command line

Stamp Images runs from the command line with `osascript`. Node is not needed.

```sh
osascript -l JavaScript Stamp-Images.jxa -- --help
osascript -l JavaScript Stamp-Images.jxa -- --version
osascript -l JavaScript Stamp-Images.jxa -- --headless settings.json photo.jpg folder
```

`--help` lists every setting with its values and default; `--version` prints
`Stamp Images <version>`. Both print to stdout and exit 0. Anything else that is not
a complete `--headless` request is a usage error: it names the problem, prints the
run line and exits 2.

A command-line run never opens a dialog and neither reads nor writes remembered
settings. Paths may be absolute or relative to the working directory. Local
`file://` URLs are accepted; remote URLs are refused.

## Settings file

The settings file is UTF-8 JSON without a byte-order mark, and its root is an
object. All ten fields are required; unknown fields, numeric strings, fractional
numbers, `null` and wrong types are refused, and every problem is reported together.
Duplicate keys follow `JSON.parse`: the last value wins. Declared defaults are
listed by `--help`; they do not fill omitted fields in a settings file.

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
| `customText` | Custom text | String of up to 500 UTF-16 code units; may contain newlines; NUL and unpaired surrogates are refused |
| `font` | Typeface | Nonblank name of an installed face, as in Font Book; trimmed |
| `size` | Text size | Integer 8–400 (points at the image's scale) |
| `textColor` | Text color | Six hexadecimal digits, optional `#`; normalized to uppercase `#RRGGBB` |
| `outlineWidth` | Outline | Integer 0–20 (pixels) |
| `outlineColor` | Outline color | Six hexadecimal digits, optional `#`; normalized to uppercase `#RRGGBB` |
| `position` | Position | `bottom-right`, `bottom-left`, `top-right`, `top-left`, `bottom-center` or `top-center` |
| `margin` | Margin | Integer 0–2000 (pixels) |

A request must stamp something: a date format, a coordinate format or nonblank
custom text. `coordinateFormat` controls only what the stamp shows; copies keep the
location metadata their originals carry. Ultra HDR JPEGs produce standard-range
JPEG copies without gain maps; capture metadata and color profiles are retained.

## Receipt and exit status

Every handled request writes one JSON object, ending in a newline, to stdout, and a
plain-language report to stderr. Read both the receipt and the exit status.

| Exit | Meaning |
| --- | --- |
| `0` | Complete |
| `1` | Incomplete or stopped after setup; confirmed copies are kept |
| `2` | Usage error or invalid settings |
| `3` | Could not start: setup failed or was stopped |

| Field | Meaning |
| --- | --- |
| `state` | `complete`, `incomplete`, `canceled` or `invalid` |
| `images` | One record per admitted image, in processing order |
| `rejected` | Selected items that were not admitted |
| `excluded` | Earlier stamped copies found in selected folders and left alone |
| `issues` | Problems affecting the request as a whole |
| `diagnostics` | Optional-surface and cleanup diagnostics |
| `elapsed` | Human-readable run time; absent for invalid requests and when nothing was admitted |

Exit 3 identifies the setup phase, including required tools or native capabilities
that are unavailable. A setup cancellation has receipt state `canceled` and issue
code `canceled`; inspect those fields to distinguish a stop from a setup error.

`complete` requires every admitted image saved with everything requested, nothing
rejected and no issues. An abrupt process end or a failed stdout cannot guarantee a
receipt.

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
| `selection` | `folder`, `unsupported-format`, `not-a-file`, `not-a-path`, `package`, `link`, `special-file`, `unreadable`, `unexaminable`, `already-stamped`, `empty-folder`, and the run issue `no-images` |
| `inspection` | `unreadable`, `empty`, `not-an-image`, `unsupported-content`, `unsupported-color`, `multiple-images`, `damaged` |
| `stamping`, `publication`, `recovery`, `cleanup` | `operation`, `fault`, `canceled`, `damaged`, `publication`, `recovery`, `cleanup` |

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
setup with exit status 3.
