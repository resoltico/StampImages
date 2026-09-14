# Stamp Images

A macOS Finder Quick Action that writes the capture date, the coordinates and
your own text into copies of your photographs. The originals are never
touched.

Select photographs in Finder, choose what to stamp and how it should look, and
get stamped copies beside them — `holiday.jpg` becomes `holiday_stamped.jpg`,
in the same folder and the same format. No preview, no photo viewer, no
editing of the originals: one styled block of text, composited into new files.

The metadata it reads is a record of what the camera wrote. A visible date or
coordinate is a representation of that record, not proof that a clock or a
location was right. A photograph that says nothing about itself still gets the
text you typed, and nothing standing in for what is missing.

## What you can choose

Ten settings, asked once for the whole selection:

- how the date is written, or that it is not stamped
- how the coordinates are written, or that they are not
- text of your own, which may run to several lines
- the typeface, from the faces this Mac will actually render with
- the text size in points, and its colour
- the outline width and colour, so light text stays readable on a light sky
- which corner or edge the block goes in, and how far in from it

The settings are remembered from one run to the next. Your own text is not: it
is about one job, and it is the field most likely to say something private.

A long run can be stopped: hold the Option key, and it stops at the next thing
it is about to do. Nothing half-made is left in your folder. The panel says
what it is doing while it works.

## Requirements

macOS 12.3 or later, and two command-line tools:

```sh
brew install exiftool vips
```

The action checks both before asking anything, and says what is missing.

## Installing

Releases, sources and build attestation:

    https://github.com/resoltico/StampImages

Download the artifact from the releases page, open Shortcuts, create a Quick
Action that receives files from Finder, add a **Run JavaScript for Automation**
action, and paste the file into it. The build is attested: see `INSTALL.txt`
for how to check what you downloaded.

## What it does with your files

It reads the photographs you selected and writes new files beside them. It
never opens an original for writing, never moves one, and never deletes one.
Every photograph you select ends in exactly one of three places when the run
is over: a copy that exists, a reason there is none, or a reason it failed.
The second of those is for photographs the request did not apply to — a scan
that does not say when it was taken, when the date is all you asked for. That
is not a failure, and it is not silence either.

A copy is the same kind of file the photograph was, at a quality chosen so you
would not notice the difference, and it keeps what the photograph said about
itself — including, if it was there, where it was taken. The colour you chose
for the text is the colour that appears, whatever colour space the photograph
is in.

Selecting a folder again leaves the copies an earlier run put there alone.

Nothing is sent anywhere. The only programs it runs are the two above and a
handful of system tools, all named in `src/core/executables.js`.

## Running it without a person

```sh
osascript -l JavaScript Stamp-Images.jxa -- --headless settings.json photo.jpg
```

The settings file is a JSON object with all ten settings in it. The receipt is
printed as JSON — what was stamped, what failed, what could not be used — and
a run that could not honour everything writes that receipt and then exits
non-zero, because a caller needs both.

## Development

```sh
npm install
npm run release
```

That builds the artifact and runs the whole gate: lint, ESLint, unit tests
with full coverage, mutation testing, and a check that the committed artifact
is the one the sources produce. `npm run test:integration:macos` runs the
scenarios that need a real Mac, and counts pixels rather than trusting that a
file appeared.

`QA.md` records what has been measured and what has not.
