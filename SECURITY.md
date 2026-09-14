# Security

## Reporting

Report anything you believe to be a security problem through the repository's
private vulnerability reporting, rather than as a public issue.

## What this program is

The released artifact is a single JavaScript file that is pasted into a
Shortcuts action. It installs nothing, runs no server, listens on no port, and
contains no network code. It runs two command-line tools, `exiftool` and
`vips`, which you install yourself with Homebrew.

Every binary it runs is named in `src/core/executables.js` or located at run
time by `src/runtime/tools.js`. Commands are built as argument vectors and
quoted in one place, so no caller assembles a command string by
concatenation.

## What it reads and writes

It reads the photographs you select and the metadata they carry. It writes new
files beside them and, while it works, into a private temporary directory it
makes for itself. It never modifies an original.

It remembers one thing between runs: how the stamp should look, in a defaults
suite of its own named `com.resoltico.StampImages`. Text you typed is not part
of that record — it is about one job, and it is the field most likely to say
something private.

Metadata is private: a photograph's coordinates say where somebody was. A copy
keeps the metadata the photograph carried, coordinates included, whether or
not you chose to stamp them — so a copy you share carries what the original
did. This repository commits no real photographs and no real coordinates, and
its fixtures are generated.

## Verifying a download

Releases carry a SHA-256 manifest and a build attestation. `INSTALL.txt`
gives the commands to check both.
