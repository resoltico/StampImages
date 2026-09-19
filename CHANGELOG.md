# Changelog

Notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-09-15

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

## [1.0.0] - 2026-09-14

- First release.
