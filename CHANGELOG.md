# Changelog

Notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
