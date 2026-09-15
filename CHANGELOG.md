# Changelog

Notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-09-15

### Added

- Any typeface this Mac has, not only the ten the settings window suggests.
  The typeface control is a list you can also type into, the same way the
  colours are — pick a suggestion, or write the family name of anything else.
- Weight is a setting of its own, regular or bold. It used to be half of the
  typeface's name, which is why "Arial Bold" and "Arial" were separate entries
  in a list of ten faces.

### Fixed

- A typeface this cannot use says the likeliest reason. A font activated by a
  font manager rather than installed is invisible to the tools this draws
  with, however plainly Font Book and every other app show it — and the
  refusal used to end by telling you to set the weight elsewhere, which is
  advice about a different problem.
- Typefaces whose name ends in a style word can be asked for at all. "Times
  New Roman" was read as the family "Times New" and appeared to be missing;
  "Arial Black" was read as Arial made bold. Both work now.
- A typeface this Mac does not have is refused rather than quietly replaced.
  The check used to compare two drawings, which could say yes to a family that
  does not exist and no to one that does: "Noto Serif" is not on macOS at all —
  there are 190 script-specific Noto families and not that one — and was
  accepted, while Times New Roman was refused.
- Bold is checked like everything else. The list used to offer a bold version
  of every face without ever asking whether this Mac had one.
- A Mac with none of the ten suggestions still opens the settings window, so
  you can name a face it does have. It used to refuse to run.
- The one-question-at-a-time fallback asks for the typeface the same way, and
  refuses a name this Mac cannot draw instead of failing several questions
  later. It had no way to enter a family that was not on the list.
- A photograph that stores only greys no longer turns a coloured caption grey.
  The copy is written in colour so the caption keeps the colour you chose, the
  picture is unchanged, and the run says how many it did that to.
- A colour profile that could not be read is no longer treated as a photograph
  that has none. It used to be reported as a run where everything went well.
  A photograph with a very long name triggered exactly that, because the file
  the profile was written to was named after it and could be too long to
  create.

## [1.0.0] - 2026-09-14

- First release.
