# Security

## Reporting

Report a suspected vulnerability privately through the repository's
[private vulnerability reporting](https://github.com/resoltico/StampImages/security/advisories/new),
not as a public issue. This is a personal project without a support commitment.

## File-safety boundary

Originals are read and copied, never opened for writing, moved or deleted. Folder
searches do not follow links or enter packages and skip hidden entries; an
explicitly selected item is checked on its own terms. Required file-kind, package,
identity and source-capture capabilities must be available; processing does not
fall back to weaker checks.

Candidates are inspected before consent and settings. Each admitted source is then
copied into an owned private workspace, and its metadata, color profile and pixels
are all read from those same captured bytes. Identity, size and version are checked
around the capture, and an observed change refuses the image. Coarse filesystem
timestamps cannot guarantee an atomic snapshot of an original that another program
is changing, so stop other writers while stamping.

A finished copy is published with an exact-path hard link, or with an exclusive
rename of an owned copy on volumes that cannot link. Only a classified name
collision is retried, with the next `_stamped N` name. Existing files, folders,
pipes and links are never replaced or written inside. Native identity and size
confirm the actual output before the workspace copy is released. A volume without
either exclusive route fails over to recovery instead of exposing a partial file.

If a copy cannot be published, it is recovered to `~/Downloads` under its intended
name with the same exclusive rules, or failing that to a confirmed copy in the system
temporary directory. Only a confirmed recovery releases the workspace copy; otherwise
the workspace is retained and its location reported. A candidate whose validation
faulted is reported as unconfirmed, never as a validated recovery. Stop keeps saved
copies and retains a finished, unpublished copy in its workspace. Temporary storage
is not permanent: move needed recovered or retained work promptly.

Each workspace records `owner.json` (process ID and start time) before any image
data, and a `retain` marker protects work entering validation. When a run starts,
only workspaces whose recorded process has ended and that carry no `retain` marker
are removed; retained, unreadable and ownerless workspaces are reported and left
alone. Help, version and invalid command-line requests do not run this cleanup.

## Embedded image metadata

Copies retain capture metadata, including GPS coordinates, whether or not the
stamp shows them. HDR JPEG copies are standard-range images without gain maps;
they retain EXIF, ICC, XMP and IPTC metadata. A copy is not anonymized: review
its metadata before sharing it when location or camera details are sensitive.
The repository commits no real photographs or coordinates; its fixtures are
generated.

Remembered settings, under `com.resoltico.StampImages`, hold appearance only.
Custom text is never stored.

## Commands and trust

External commands are built as argument vectors and shell-quoted at the execution
boundary; NUL bytes are refused. System executables are registered in
`src/core/executables.js` and image tools are located by `src/host/tools.js`.
`STAMP_IMAGES_VIPS`, `STAMP_IMAGES_VIPSHEADER` and `STAMP_IMAGES_EXIFTOOL` can name
explicit executables; they select trusted tools and are not a sandbox.

The action runs with your user permissions and trusts the installed `exiftool`,
`vips` and supporting system tools. It makes no network requests; installing tools
and verifying attestations need network access. Diagnostics can contain source and
output paths and the underlying commands; review them before sharing.

## Distribution integrity

The release workflow requires the generated artifact to reproduce the committed
bytes, verifies checksums and build attestations before publication, and checks
that the tag still names the commit being released. The JXA, checksum manifest,
installation instructions and license are attestation subjects.

[README.md](README.md#verify-a-download) describes download verification.
Checksums and attestations do not verify a copy pasted into Shortcuts; replace it
with the complete verified file when installing a build.
