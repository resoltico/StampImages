# Headless interface

Run the standalone artifact with osascript; Node is not a runtime dependency.

```sh
osascript -l JavaScript dist/Stamp-Images.jxa -- --help
osascript -l JavaScript dist/Stamp-Images.jxa -- --version
osascript -l JavaScript dist/Stamp-Images.jxa -- --headless settings.json photo.jpg folder
```

CLI string-array input is always noninteractive. Invalid or missing arguments never
open dialogs. Paths may be absolute or relative to the working directory. Local
file URLs are accepted for source items; remote file authorities are refused.
The settings file must contain UTF-8 JSON without a byte-order mark.
`STAMP_IMAGES_VIPS`, `STAMP_IMAGES_VIPSHEADER` and `STAMP_IMAGES_EXIFTOOL`
may name explicit executables; an invalid override fails setup.

## Settings

All ten fields are required. Unknown fields, numeric strings, fractional numbers,
nulls and incorrect types are rejected. Multiple field errors are returned together.
Interactive controls convert their text to the same typed settings before validation.
A request with no date, coordinates or nonblank custom text is refused.

```json
{
  "dateFormat": "iso-minutes",
  "coordinateFormat": "none",
  "customText": "",
  "font": "Helvetica Neue Bold",
  "size": 36,
  "textColour": "#FFFFFF",
  "outlineWidth": 2,
  "outlineColour": "#202020",
  "position": "bottom-right",
  "margin": 24
}
```

| Field | Accepted value |
| --- | --- |
| `dateFormat` | `iso-minutes`, `iso-date`, `long-date`, `none` |
| `coordinateFormat` | `none`, `decimal`, `sexagesimal` |
| `customText` | Text, up to 500 UTF-16 code units; may contain newlines; null characters and incomplete Unicode are refused |
| `font` | Nonblank installed typeface name; trimmed before resolution |
| `size` | Integer 8–400, in points at the photograph's scale |
| `textColour`, `outlineColour` | Six hexadecimal sRGB digits, optional `#`; normalized to uppercase `#RRGGBB` |
| `outlineWidth` | Integer 0–20 pixels |
| `position` | `bottom-right`, `bottom-left`, `top-right`, `top-left`, `bottom-centre`, `top-centre` |
| `margin` | Integer 0–2000 pixels |

Headless runs neither read nor write remembered interactive settings. GPS controls
only visible stamp content: embedded location metadata is retained in copies.

## Receipt and status

A run or invalid request writes one newline-terminated JSON object to stdout.
Human-readable detail is written to stderr. Help and version print text to stdout.
Exit statuses are 0 complete, 1 incomplete or stopped, 2 invalid request/settings,
and 3 setup failure. An incomplete run keeps its confirmed saved outputs. Stop retains a validated
unpublished candidate in its existing workspace and reports that path; it does
not start a new Downloads recovery attempt.

The receipt contains `state`, `images`, `rejected`, `excluded`, `issues` and
`diagnostics`. Run states are `complete`, `incomplete`, `cancelled` and `invalid`.
Each admitted source has exactly one image record with its full `source` path,
`state`, `issues` and `missingMetadata`. Image states are:

| State | Meaning |
| --- | --- |
| `saved` | Confirmed requested output; `output` is its actual full path |
| `recovered` | Publication failed; `recovery` identifies retained work |
| `nothing-to-stamp` | No requested content exists for this photograph; `reason` explains |
| `failed` | Stamping failed; structured issues explain |
| `cancelled` | Stop interrupted this photograph |
| `not-started` | A previous cancellation or fatal issue stopped remaining work |

Saved and recovered records may include `crowded`, `expanded`, `unconverted` and
`substituted` appearance notes; `substituted` means some characters are not in the
chosen typeface and were drawn in another one.
`missingMetadata` lists requested fields the photograph cannot supply, such as
*date/time* or `GPS coordinates`, on every record including `nothing-to-stamp`.
`invalidMetadata`, present only when non-empty, names those of them that are recorded
but not valid, such as a zero date or a latitude beyond 90°. These omissions make the
run incomplete while keeping the copy.
A recovery path may refer to Downloads, a temporary copy, or the retained workspace;
follow its issues to distinguish confirmed external recovery from retained work.
Unexpected validation faults retain an unconfirmed candidate in the workspace,
reported as a workspace issue rather than a validated recovered image.

Issues carry `code`, `stage`, `message`, and optionally `source` and `diagnostic`.
Codes include `operation`, `fault`, `cancelled`, `cleanup`, `publication`, `recovery`,
`setting` and `unknown`. Inspection refusals include `unreadable`, `empty`,
`not-an-image`, `unsupported-content`, `unsupported-colour`, `multiple-images` and
`damaged`; unsupported colour models/layouts need conversion to RGB or greyscale. A file
whose header passes but whose decode fails (for example a truncated JPEG) is refused as
`damaged` at the `stamping` stage, with the decoder's output kept in its `diagnostic`.
A stamp larger than its photograph is an `operation` failure for that photograph only.
Selection refusals in `rejected` carry `stage` `selection` and a `code`: `folder`,
`unsupported-format`, `not-a-file`, `not-a-path`, `package`, `link`, `special-file`,
`unreadable`, `unexaminable`, `already-stamped` or `empty-folder`. Optional observer problems
are diagnostics. Software and cleanup faults stop further photographs. The receipt
retains confirmed outputs even if completion presentation fails.

Settings and receipts use this contract without migration readers or aliases.
Interactive preferences accept only the complete current appearance record;
invalid records open defaults. Custom text is excluded from that record.
