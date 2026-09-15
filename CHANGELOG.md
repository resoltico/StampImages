# Changelog

Notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-09-15

### Added

- Any typeface this Mac has, not only the ones the settings window suggests.
  The typeface control is a list you can also type into, the same way the
  colours are: pick a suggestion, or write the family name of anything else.
- Weight is a setting of its own, Regular or Bold, chosen beside the typeface.

### Changed

- The typeface is a family name. A settings file that named a weight in it,
  such as `"font": "Helvetica Neue Bold"`, now needs `"font": "Helvetica
  Neue"` with `"weight": "bold"` beside it. Settings remembered from an
  earlier run are carried over for you.

### Fixed

- Typefaces whose name ends in a style word can be chosen. "Times New Roman"
  and "Arial Black" were read as different families and appeared to be
  missing.
- A typeface this Mac cannot draw with is refused, with the reason and where
  fonts have to be kept. Some were accepted and then quietly drawn in another
  face, and some that work were turned away.
- Bold faces are checked like every other. The suggestions offered a bold
  version of each without asking whether this Mac had one.
- A Mac where none of the suggested faces are available still opens the
  settings window, so you can name a typeface it does have. It used to refuse
  to run at all.
- The one-question-at-a-time settings, used when the window cannot be shown,
  ask for the typeface the same way and refuse an unusable one at the question
  rather than after the last one.
- A black-and-white photograph no longer turns a coloured caption grey. The
  copy is written in colour so the caption keeps the colour you chose, the
  picture itself is unchanged, and the report says how many were treated that
  way. Grey, white and black captions are unaffected.
- A colour profile that cannot be read is reported rather than treated as a
  photograph that has none — which had been counted as a run where everything
  went well. Photographs with very long names could trigger it.

## [1.0.0] - 2026-09-14

- First release.
