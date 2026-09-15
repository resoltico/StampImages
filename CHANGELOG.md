# Changelog

Notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-09-15

### Added

- Any typeface this Mac has, not only the ten the settings window suggests.
  The typeface control is a list you can also type into, the same way the
  colours are: pick one of the suggestions, or write the family name of
  anything else — "Zapfino", "Optima", a font you installed yourself. The name
  is drawn with before the run starts, so one that draws nothing comes back
  with the field marked and your other answers where you left them, rather
  than being stamped in whatever face the renderer picked instead.

### Fixed

- A settings file naming a typeface this Mac cannot draw with is refused, with
  the reason. The photograph used to be stamped in whatever face the renderer
  picked instead, and the run reported as a complete success.
- Your remembered settings survive a typeface going away. A font removed since
  the last run used to reset the size, the colours, the position and the margin
  along with it.

## [1.0.0] - 2026-09-14

- First release.
