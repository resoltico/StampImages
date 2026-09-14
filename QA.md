# Quality gates

What this repository checks, what each check is for, and what it does not
establish. The last of those matters most: a gate that is silent about its
blind spots reads as proof of more than it measured.

## Where this came from

The build, the gate and the release pipeline were carried over from Image
Files to PDF, a sibling Quick Action by the same author, and adapted. What
came with them was chosen module by module rather than by copying a repository
and deleting: of that project's source modules, most were about PDFs, paper or
pages, and a fork would have been mostly deletion with residue left in
comments, tests and this document.

What was taken is the pure logic about text, files and ordering, the tool
discovery and preflight, the filesystem walk and admission, the publication
protocol, the progress panel and the AppKit form, and the toolchain itself.
What was left behind is every module about pages. The stamping — the metadata,
the rendering, the placement and the settings that describe it — is this
project's own.

## Source gate

`npm run lint` checks the repository's own rules; `npm run lint:js` runs
ESLint. No source file may exceed 150 lines, tests included. A file that
outgrows the limit is split; the limit is not raised. Every binary the program
runs is declared in `src/core/executables.js` or located at run time by
`src/runtime/tools.js`.

## Coverage and mutation

`npm run test:coverage` requires 100% of lines, branches and functions.
`npm run test:mutation` runs StrykerJS with a break threshold, so tests that
stop discriminating fail the build rather than quietly passing.

Coverage says every line ran. Mutation says the tests would notice if a line
were wrong. Neither says the program does the right thing on a Mac.

Two things followed from taking that seriously rather than chasing a number.
A guard that no test could reach was removed rather than kept: a photograph
that fails cannot be a cancellation, because a person stops a run through a
progress surface and every report to one is caught where it is made. And the
ten rows of the form, which were written down twice — once grouped by kind for
the defaults and once in reading order for the form — became one list, because
two lists that must agree are one list and a bug waiting to be written.

## What the tools are asked, and why differently

Presence is not enough: a build can be installed, on PATH, and still refuse a
flag this program uses on every run.

vips is asked to fail. It is given the real flags and a path that cannot
exist, so a build that understands them gets as far as naming its loader and
one that does not complains about the flag instead.

exiftool cannot be asked that way, and this was measured rather than assumed:
`-notaflag` is not an unknown option to it but a request for a tag called
"notaflag", so a build that understood nothing we asked for would answer "File
not found" exactly as a healthy one does. It is asked to succeed instead,
about a file certain to exist — its own executable — and the answer must be
the JSON the adapter reads. That establishes the whole path at once: it runs,
it takes the flags, and what comes back can be parsed.

## What an audit found, and what it changed

An external review of the released bundle was read, and every claim in it was
reproduced against the artifact before anything was designed. Eight of its
findings were real, four were not, and two things it did not raise were worse
than several that it did.

What was real, and what it became:

- **A date was read in pieces.** `2026:02:31 99:99` passed the month and day
  bounds and was stamped as "2026-02-31 99:99"; so was anything trailing the
  minute, so "12:30garbage" became half past twelve. A moment is now read
  completely or not at all -- a real day of a real month of that year, and a
  clock -- and the shapes cameras actually write (the seconds, a fraction of
  one, an offset) are accepted without being displayed.
- **The file's modification time spoke for the capture.** It is only ever
  reached when both camera tags are absent, which is exactly the case where it
  is an editor's clock. It was dropped.
- **A metadata read that failed looked like a photograph with no metadata.**
  A broken exiftool produced a folder of copies with no date on them and a
  report saying everything had worked. Those are now different outcomes.
- **Seconds rounded after the degrees were taken**, so 12.9999999 was written
  `12°59'60.0"N`; and a coordinate just south of the equator was written
  `-0.0000`. Both forms now round into their smallest displayed unit first and
  read the larger units back out of it.
- **A caption was markup.** `vips text` parses pango markup: measured, "Mum &
  Dad" was refused outright -- invalid markup, no file, that photograph failed
  -- and "&lt;b&gt;x&lt;/b&gt;" came out bold. Text is escaped where the argument
  is built, which is the one place it becomes a command.
- **A stamp larger than its photograph was cropped and called a success.**
  Measured: vips crops an overlay to the image beneath it, and a 26-character
  caption at 90 points on a 120-pixel photograph was published as the letters
  "A v". It is refused now, with both sizes in the message.
- **Every outline was clipped.** `vips rank` keeps its input's dimensions, so
  the growth was cut off at the glyph edge on all four sides. The mask is
  embedded in a border first, and both layers are made from that one mask so
  they line up.
- **Every copy was re-encoded at the encoder's default**, which vips documents
  and this Mac confirms as quality 75 for JPEG and lower for HEIF. The name
  and the encoder are now one decision, stated, at 90.

What the review got wrong, measured rather than argued:

- **Hemisphere signs are not applied twice.** With `-n`, exiftool returns
  composite coordinates already signed: a photograph tagged 33.8688 S comes
  back as -33.8688. Applying the reference again is what would put every
  southern and western coordinate in the wrong hemisphere.
- **Metadata and orientation survive the copy.** Measured: DateTimeOriginal,
  the GPS tags and the camera make are all present in the copy, and the
  orientation tag is normalised exactly once by `autorot`.
- **Unresolved inputs do not disappear**; there is a rejection for each.
- **The font probe is the more truthful oracle.** The review wanted a font
  catalogue instead. Measured, the catalogue disagrees with the renderer:
  `fc-match` resolves "Helvetica" and "Times New Roman" happily, and pango
  draws both as the fallback. The question worth asking is not whether a font
  is installed.

Four of its prescriptions were rejected outright, each for one reason. A
CoreText renderer would make drawing depend on AppKit inside the Shortcuts
helper, which is the one thing about this product that has not been
established -- trading a measured dependency for an unmeasured one. A native
process runner buys stopping mid-photograph, which is worth less than the
failure modes an NSTask and a hand-run event loop bring into a Quick Action. A
publication journal with crash reconciliation is machinery for a failure this
program cannot have: it never modifies an original and never publishes over a
name it does not own, so the worst a crash leaves is a temporary directory.
And snapshotting every source doubles the I/O of every run to close a window
in which another process rewrites a photograph between two reads of it.

Two things the review did not raise:

- **A photograph with nothing to stamp failed**, in the renderer's words:
  somebody who asked for the date on a folder of scans was shown "text: no
  text to render" and the command that failed. It is a third outcome now,
  beside stamped and failed.
- **Nothing could stop a run.** The panel ignores mouse events and the host's
  Progress object has no cancel, so the stop the loop asked about could never
  become true. Holding the Option key stops it between photographs; the panel
  says so in its title.

## What a second audit found

The bundle was reviewed again and every claim reproduced again. Eight more
were real, four were not, and the shape of the real ones was worth more than
the list: **the run's outcome could disagree with what was on disk**, because
something had been read off a message instead of asked of the filesystem, or
off a moment instead of of the run.

- **A claim that failed but had succeeded was believed.** ln makes the link,
  the command reports failure, and the next question -- is the name taken? --
  answers yes, so publication concluded the name had been taken by somebody
  else and set a second copy aside. Every path out of a claim now ends by
  asking the output path which file it holds, which is the question publish.js
  already asked after a success.
- **A stop that was asked for was forgotten.** The modifier is polled between
  photographs, so somebody who held it while one was being stamped and let go
  before it finished had asked for nothing. Stopping latches now, and a
  cancellation raised inside a photograph ends the run instead of being
  recorded as that photograph's failure.
- **Ownership was registered after the fact.** A photograph refused for being
  multipage or CMYK had already been decoded into the workspace, and the
  caller only took ownership of that file once the decode returned -- so every
  refusal leaked a full-sized intermediate. Both questions are asked of the
  source now, before anything decodes it, so there is nothing to leak.
  Measured: vipsheader answers both about the file itself for every format
  this accepts. And a finished copy became the job's only once a name had been
  chosen for it, so a run that could not find a free name threw away finished
  work; the copy is owned from the moment it exists.
- **An ordinary second run over a folder reported itself as a failure.** The
  copies an earlier run left there are excluded by design, and they were being
  counted against the request: one photograph stamped, "1 of 2 stamped, 1 not
  usable", exit non-zero. Excluded is now its own thing, outside the request.
- **A setting was coerced rather than read.** `[36]` was a text size of 36,
  `true` an outline a pixel wide, and `{}` the caption "[object Object]".
  Read now, by the same rule the coordinates are read by.
- **The hemisphere could be wrong by a whole hemisphere.** Half of the
  smallest displayed unit south of the equator rounds to a magnitude of one
  unit and, rounded again as a signed number, to negative zero -- so a place a
  tenth of a second south of the equator was labelled north of it. The sign is
  read off the coordinate now, not off a second rounding.
- **The margin warning was wrong.** It asked for room on both sides of both
  edges, when a margin is measured from the two edges the position names, so
  an eighty-pixel stamp fifteen pixels in from the corner of a hundred-pixel
  photograph was reported as sitting against the edge. Placement and the
  warning come out of the same arithmetic now, which is the only way they can
  agree.
- **A caption of your own asked the photograph a question.** exiftool was run
  for every photograph even when nothing in the request wanted metadata, so a
  reader that would not run failed a job that needed nothing from it.

What the review got wrong, measured rather than argued: an anonymous input
that resolves to nothing is Shortcuts' own parameters object, appended to
every Quick Action's input, and reporting it would put a rejection in every
report; `CreateDate` is digitization time, which for a camera is the shutter
and is the only fallback worth having; a byte comparison that errors is read
as "the files differ", and both files were written and verified by this run
one call earlier, so the error it worries about requires an I/O failure that
would have taken the run down anyway; and the lifecycle rewrite, the owned
task runner, the publication journal and the source snapshot were rejected
again, for the reasons in the previous section.

## What a caption colour turned out to cost

The one finding whose weight the previous round got wrong.

A colour chosen in the form is three sRGB numbers, and writing those numbers
into a photograph does not make them that colour: they are read through
whatever profile the photograph carries. Measured on this Mac, in Lab:
`#FF3B30` written into a Display P3 photograph lands about 19 from the red
that was asked for, and `#FFD400` about 28. A difference of 2 is visible.
Every recent iPhone photograph is Display P3.

White and dark grey are exact -- the neutral axis is shared -- which is why
the defaults never showed it.

So a photograph's profile is taken out of it with exiftool, which writes it to
a file and writes nothing at all when there is none, and the colour is moved
into that space before it is painted. One file per distinct profile rather
than per photograph, because a batch comes off one camera, and the drawing is
cached by the inscription and the profile together. A transform that fails
leaves the sRGB numbers -- which is what every copy had before this existed --
and the run says how many photographs that applied to.

`tests/integration/copies.sh` stamps the same red caption onto an sRGB
photograph and a Display P3 one and requires the two to render within 2 of
each other in Lab.

## What a font probe had to become

The renderer resolves a font name through pango, and pango answers every name:
asked for one it cannot place, it draws in a default face and says nothing. So
each family is drawn with before it is offered, beside a name that certainly
does not exist, and a family whose drawing is that drawing did not resolve.

The first version compared the widths of those drawings, and measured on this
Mac it was wrong twice over. Georgia and the unresolvable name both drew the
probe 192 pixels wide, so a font that was installed was dropped. And a bold
name that had fallen back drew 197 against the regular fallback's 192, so a
font that was not installed was offered. The drawings are compared byte for
byte now — two renderings of one font are identical, measured — and against a
reference drawn at the same weight.

What the probe catches is not only a missing font. Measured with the fonts
present and listed by fontconfig, "Helvetica" and "Times New Roman" both draw
as the fallback while Helvetica Neue, Arial, Georgia and the rest draw as
themselves. The question worth asking is not whether a font is installed but
whether asking for it by that name draws it.

## What the sibling's next release had to teach this one

This product was ported from Image Files to PDF at that project's 1.4.0, and
its 1.5.0 was read against this codebase module by module rather than merged.
Four of its changes were defects here too, one exposed a hole in this
project's own testing, and the rest were already answered or do not apply.

### A tool's exit status is not evidence of what it was asked to do

`image.js` has always checked its own outputs, because vips can exit zero
having produced nothing. The same scepticism stopped one level short: nothing
asked whether the *source* had been read.

Measured here on vips 8.18.6:

| | read plainly | read with the policy |
| --- | --- | --- |
| truncated JPEG | exit 0, salvaged | exit 1, refused |
| truncated PNG | exit 0, salvaged | exit 1, refused |
| truncated HEIC, TIFF, WebP | refused | refused |
| whole JPEG, PNG, TIFF, WebP, HEIC | read | read |

Every check after the decode passed on the salvaged file -- the copy exists,
it is an image, it is the size the photograph said it was -- so half a
photograph was published as a finished copy. Measured against the built
artifact with the policy stripped back out: a JPEG cut off at 55% was stamped,
published as `cut_stamped.jpg`, and reported as a complete success.

**The mechanism differs from the sibling's and had to.** There, the flag rides
on `vips thumbnail`, which takes `--fail-on` as an operation flag. The one
stage here that decodes the photograph is `vips autorot`, which is not a load
operation and has no such flag, so the policy goes on the path: vips reads a
loader's settings off the end of the path it is given, exactly as it reads an
encoder's off the end of the path it writes. Measured, because it looks
fragile and is not: vips tries the whole string as a filename before it splits
the trailing group off, so `p[1].jpg[fail_on=error]` reads `p[1].jpg`.

**What the probe can and cannot establish.** Measured: vips checks that the
file exists and sniffs its format *before* it parses a load option, so a probe
naming a file that cannot exist never reaches one -- and neither does a probe
naming a file that exists and is not an image. The load-option form cannot be
probed at all without writing a real image first, which is two more
subprocesses on every run to catch a libvips four years old. So the probe
carries `--fail-on=error` on `thumbnail` instead, which is the same enum
introduced by the same libvips release: it establishes that this build has
`VipsFailOn`, and infers that its loaders take the option. That inference is
written down here rather than left in the code as a coincidence.

### A cancellation is not an answer, a diagnosis, or a refusal

Three separate readings of the same wrong idea, all of them live here.

`isRegularNonEmpty` swallowed it, so a stop landing on the check after a vips
stage was reported as "the stamped photograph is not a file with anything in
it" -- a wrong diagnosis rather than a late stop. It is let out there and
nowhere else: every other question in `asking.js` is put somewhere a raise
would cost something, and what that costs is a stop landing exactly on a
sub-millisecond `test` going unnoticed. vips takes seconds and is where
somebody actually asks.

`linkFrom` reduced its failure to a string, so a cancellation and a refusal
read the same. They mean opposite things: the route below the link exists
because the link may be *impossible* -- another volume, a filesystem without
hard links -- and taking it after a cancellation makes a folder in somebody's
photographs and copies the whole picture into it after they said stop. It
returns the failure now, and `deliver`, `throughStaging` and `claimFrom` each
ask before choosing the next strategy.

And publication answered two ways where there are three. A stop is neither
published nor refused: it is **abandoned**, and it carries no reasons, because
there is nothing to say about a file that is not there. What it does carry is
the claim -- an interrupted call is not proof the filesystem did nothing, and
a hard link shares the identity of the file it was made from, so the output
path can be asked the same question a successful claim asks it. This half was
already right here: `claimOnce` has always asked, whatever the claim said. So
a link made before the stop surfaced is a copy that was published, counted,
and then the run stops; one that was not leaves nothing behind and the copy
goes with the workspace, which is the difference from a refusal, where the
person needs the copy back.

One more of the same family turned up in the QA pass on this design rather
than in the sibling: `resolves` in `fonts.js` had a bare `catch` that answered
"this Mac does not have this font". The probe is one vips render per candidate
and the longest thing a run does before it says anything, so it is exactly
where somebody waiting asks it to stop -- and a stop landing there was
answered as a verdict about every remaining family, ending in "None of the
fonts this action offers draws on this Mac." in a dialog. Nothing has been
produced at that point, so it is let out.

### The reports are the checkpoints

A stop used to be asked for between photographs, and that was argued for on
the grounds that a publication in progress owns a finished copy and a name it
has claimed. True, and it bounds a stop by a whole photograph: a
24-megapixel HEIC goes through half a dozen vips stages, and somebody holding
the key waited out all of them.

The rule that replaced it has no list to keep right. A report of what is
*about* to happen may stop the run; a report of what has happened may not.
Nothing has been done at any of the first kind, so nothing is lost by not
doing it, and a stage added later becomes a checkpoint by writing the line
that makes it visible. The second kind is the one exception and it is exact:
unwinding past finished work throws away the account of it.

Two details are load-bearing. The check comes *after* the report, because a
host raises at the call following the button, so the report that discovers a
stop is the one being made. And announcing a photograph moved inside the
attempt's own `try`, where a stop is an outcome of that photograph rather than
an escape from the batch -- outside it, the first stop would have taken the
whole account of what had already been published with it.

### What was not adopted, and why

- **Timestamp validation.** The sibling's headless caller supplies a timestamp
  that lands in an output filename; nothing here does. Every part of an output
  name comes from the photograph's own path. (The comment in `naming.js` that
  claimed otherwise was ported prose and is gone.)
- **Two progress counts.** The sibling has a mode that makes one document out
  of every image, where units and images are different numbers. One photograph
  is one unit here.
- **Per-image temporary space.** Already the rule here, and stated better; what
  was missing was the copy itself on the failure path, now swept with the rest.
- **The AppKit bridge extraction, the cause-chain cancellation read, the
  completion counts.** Already present, and the ledger here is ahead of the
  sibling's.
- **The sibling's hand-test record.** That is evidence about that artifact.
  This one needs its own; the method is worth copying and the findings are not.

### What this exposed that was not in the sibling's release at all

Every claim in the headers of `claim.js`, `transfer.js` and `output-copy.js`
was measured in the sibling and inherited here. Nothing in this project ran
its own artifact against a filesystem that cannot make hard links. Three
suites now do -- `publication.sh`, `volumes.sh`, `cards.sh` -- and a fourth,
`damaged.sh`, covers the decoding policy above. What they establish is in the
next section.

## What the first hand test on a real Shortcut found

Run on 2026-09-14 against the built artifact pasted into a Quick Action, over
five photographs in ~/Downloads. The stamping was right: five copies beside
their originals, correct sizes, originals untouched. Two things were not.

### The action's result becomes files

Beside each copy was a 42-byte file:

    :Users:someone:Downloads:IMG_1538_stamped.txt

holding one line -- `/Users/someone/Downloads/IMG_1538_stamped.jpg` -- and
carrying `com.apple.quarantine: 0082;...;com.apple.shortcuts;`. So Shortcuts
wrote them, not this action: a Quick Action's result is the shortcut's result,
and a text result is written out as a file named after the text, with the
slashes turned into colons, which is how a whole POSIX path becomes one
filename. Five paths returned, five files.

`report` returned `result.outputs` for a person exactly as it returns the
receipt for a headless caller. The receipt has a reader; the list did not.
Nothing in the installation this ships has a second action to chain to, so the
list had nowhere to go but the filesystem, silently, once per photograph, for
as long as somebody kept using the action.

So a person is answered with nothing at all -- said out loud with `return
undefined` rather than left to fall off the end of the function -- and the
headless path is untouched, because there the return value is the receipt and
the integration suites read it. What is given up is chaining this action to
another one inside a shortcut. That is a capability somebody can ask for;
litter in their photographs is not a default worth keeping to hold it open.

**Not established here:** that returning nothing stops Shortcuts writing
anything, which needs the next hand test. What is established is where the
files came from and what was in them.

### Two controls that did not say what they choose

The form's first two rows were labelled `Date:` and `Coordinates:`, over menus
whose items are `2026-09-09 14:30` and `56.9496, 24.1052`. Reported as
ambiguous, and it is: a noun over a menu of plausible values reads as a choice
of *which* date -- or as data the action had already read out of the
photograph and was offering back. It is neither. The values are the
photograph's own, and what the menu chooses is how they are written, or that
they are not written at all.

Three things were wrong at once, and only the third is cosmetic:

1. nothing said where the stamped values come from;
2. the label named the subject where every other row's label names the setting
   -- `Text size:` is followed by `36`, which *is* the setting, while `Date:`
   was followed by a sample;
3. one item in each menu ("Do not stamp the date") is a different kind of
   thing from the others, and a label naming the subject gave no hint that the
   menu was the place to turn it off.

The fix is words, not widgets. The labels are `Date format:` and `Coordinate
format:`, which is also what the settings file has always called them
(`dateFormat`, `coordinateFormat`), so the window and a headless configuration
now use one vocabulary. And the line the form opens with -- the only place
that can say it once for the whole window -- now reads "The date and place are
each photograph's own. Your own text is the same on all of them."

Splitting each row into a checkbox and a format menu was considered and
rejected: it doubles the controls for two of ten rows, and a format has to be
chosen either way, so the "off" state is one item in a list rather than a
second widget. The items stay samples rather than names -- "ISO 8601 to the
minute" is a name somebody has to know already.

## What has been measured on this Mac

Through `osascript`, with the built artifact:

- the JXA runtime accepts every construct in the bundle, and the file runs;
- AppKit is reachable from it: the progress panel is built, ordered front,
  painted through a bounded run loop pump, hidden and closed, and the
  activation policy is raised from prohibited to accessory for the duration
  and put back afterwards;
- the settings form is built with all ten rows and attached to an NSAlert;
- `NSEvent.modifierFlags` can be read with no delegate, no event tap and no
  permission prompt, and reports nothing held when nothing is held;
- a caption can hold more than a line: an NSTextView in an NSScrollView is
  built and read back as "Riga\nLatvia". A text field cannot -- Return commits
  the alert rather than starting a line -- so the promise that your text keeps
  its line breaks was one only a headless caller could rely on;
- a headless run stamps real photographs: `npm run test:integration:macos`
  counts the pixels that are not the background, in the corner the settings
  named, and checks that nothing was drawn in the others. It also covers the
  refusals: a caption with an ampersand, a photograph with nothing to stamp, a
  stamp too large to fit, the quality the copy is written at, and a second run
  over a folder leaving the first run's copies alone;
- publication reaches a real filesystem, against the built artifact:
  - an ordinary folder publishes in one operation and leaves nothing of the
    machinery behind, and the published copy has one name rather than two;
  - a dangling symbolic link standing at the output name is stepped around
    rather than replaced -- `-e` follows it and reports the name as free;
  - a folder that cannot be written to refuses every route, and the finished
    copy is somewhere the message names, readable, and the size it should be;
  - a folder whose ACL denies `add_file` and allows `add_subdirectory` makes
    the place beside the destination, copies into it, and is refused both ways
    of creating the name -- on the boot disk, which does hard links and
    exclusive renames both, so the message carries the system's own words and
    names no cause nobody established;
  - an attached HFS+ volume, where the workspace and the output folder are
    different filesystems, publishes through the staging place and sweeps it;
  - an attached FAT32 volume, which has no hard links at all, publishes by
    exclusive rename, and steps around a name something else is holding;
  - an attached exFAT volume, which has neither, stops: nothing of the run
    reaches the card, the message carries `Operation not supported` from the
    kernel, and the finished copy is where the message says;
  - a truncated JPEG and a truncated PNG are refused by name while whole files
    alongside them are stamped, and the refusal carries what vips said.

## What has not been established

A Quick Action run on 2026-09-14 settled the first of these -- five
photographs selected in Finder arrived in the shape the input adapter expects
and were stamped -- and it is written up above. The rest are still inherited
confidence from the sibling project rather than measurements of this one:

- that AppKit presents the form and the panel from inside the Shortcuts
  helper, which is a different process from `osascript` with a different
  activation policy. The same run reached the settings, so something asked;
  what has not been recorded is which of the two asked, and the panel is a
  separate question again;
- that a named defaults suite is writable there, which is where the settings
  of the last run are kept;
- that `NSEvent.modifierFlags` reports a modifier as held while a Quick Action
  is running. The call was measured; a key being held while it is made was
  not, because nothing here can hold one.

A run that cannot remember opens on the compiled defaults and stamps the
photographs anyway, and a host that can present nothing falls back to asking
one question at a time — so none of the three is a run that fails. They are
things the documents must not claim until somebody has watched them.

## What a saved copy costs while it is being made

The stages between a photograph and its copy are uncompressed. A
24-megapixel photograph is about 70 megabytes oriented and rather more once
the stamp has been composited onto it, and a batch of two hundred kept until
the end of the run would ask the disk for tens of gigabytes it was never told
about. Each photograph's intermediates are removed as soon as its copy is
written; the stamps are not, because one drawing serves every photograph that
carries the same text.

## What the stepwise dialogs cannot do

They are the fallback when AppKit cannot present the form, and they ask one
question at a time through the host's own dialogs. A dialog's field is one
line, so a caption typed there is one line. The form takes as many as you
type, and so does a headless configuration.

## What is not snapshotted, and what follows

A photograph's pixels and its metadata are read by two separate tools, one
after the other, from the path that was selected. Another process rewriting
the file between those two reads would produce a copy whose stamp came from a
different version than its picture. Nothing guards against that, deliberately:
the alternative is copying every selected file into the workspace before
reading it, which doubles the I/O and the disk of every run to close a window
measured in milliseconds on files somebody is watching a progress panel about.

## What the format list depends on

A copy is saved as the kind of file the photograph was, which means vips has
to be able to write that kind. Measured on this Mac's Homebrew build, it
writes JPEG, PNG, TIFF, WebP, HEIC and AVIF. A build without the HEIF encoder
would fail on a HEIC photograph — as that photograph's own failure, reported
beside the copies that succeeded, rather than as a failure of the run.
