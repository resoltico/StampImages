# Security

## Reporting

Report anything you believe to be a security problem through the repository's
private vulnerability reporting, rather than as a public issue.

## What this program is

The released artifact is a single JavaScript file that is pasted into a
Shortcuts action. It installs nothing, runs no server, listens on no port, and
contains no network code. It runs two command-line tools, `exiftool` and
`vips`, which you install yourself with Homebrew.

System executables are registered in `src/core/executables.js`; runtime image
tools are located by `src/host/tools.js`. Image-tool commands are built as
argument vectors and shell-quoted at the execution boundary. Explicit tool
overrides are executable paths, so use only trusted tools.

## What it reads and writes

It reads the photographs you select and the metadata they carry. It writes copies beside directly selected files or into selected folders, and
uses a private temporary directory while processing. It never modifies an
original. Processing reads a private capture; metadata and
pixels come from the same owned bytes. Identity, size and version checks detect
source changes, subject to filesystem timestamp precision; stop other writers
while stamping. Failed publication can recover to Downloads or retain temporary
work, and completion identifies its actual location. Stop retains finished
unpublished work in its current workspace. Move needed temporary recovery copies
to permanent storage promptly.

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
