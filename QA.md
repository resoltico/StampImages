# Quality gates

What this repository checks, what each check is for, and what it does not
establish. The last of those matters most: a gate that is silent about its
blind spots reads as proof of more than it measured.

Everything here is the current state of the product. A measurement is written
down with what was measured and on what, so it can be taken again; how it came
to be taken is not part of it.

## Source gate

`npm run lint` checks the repository's own rules; `npm run lint:js` runs
ESLint. No source file may exceed 150 lines, tests included. A file that
outgrows the limit is split; the limit is not raised. Every binary the program
runs is declared in `src/core/executables.js` or located at run time by
`src/runtime/tools.js`.

The bundle is one scope, so every top-level declaration across the sources
must be unique, and the module order is written down rather than inferred:
`tools/module-order.mjs` lists it, and `tools/bundle.mjs` refuses a module
that requires one not yet bundled.

## Coverage and mutation

`npm run test:coverage` requires 100% of lines, branches and functions.
`npm run test:mutation` runs StrykerJS with a break threshold, so tests that
stop discriminating fail the build rather than quietly passing.

Coverage says every line ran. Mutation says the tests would notice if a line
were wrong. Neither says the program does the right thing on a Mac.

Two rules follow from taking that seriously rather than chasing a number. A
guard no test can reach is removed rather than kept — a photograph that fails
cannot be a cancellation, because a person stops a run through a progress
surface and every report to one is caught where it is made. And anything that
must agree with itself is written once: the form's rows are one list, read
both for the defaults and for the window, because two lists that must agree
are one list and a bug waiting to be written.

## What a generated case covers

Coverage and mutation both answer questions about the tests. Neither answers
whether anybody thought of the input — and the faults this project's
arithmetic has had were all inputs nobody thought of. Three modules are given
generated cases through fast-check.

`src/core/place.js` — whatever a photograph says, the place is refused or
written whole: any value exiftool could hand over, a number of any size, text
or nothing, goes through the same bounding a run does. Across every value that
bounding lets through, no minute is the sixtieth of a degree and no second the
sixtieth of a minute. A coordinate built from its parts is written as exactly
those parts, rounded into its nearest tenth of a second, with the hemisphere
its sign says, and a value just short of a whole minute is written as that
minute. Decimal degrees keep four places, never write a signed nothing, and
stay within half of the place they stop at.

`src/core/moment.js`, reading — a moment that exists is read back as the
fields it was written in; a day past the end of its month is not a date; a
field outside its range is not a moment; the seconds, a fraction of one and an
offset are read and not shown; an offset past fourteen hours is refused; and
anything else after the minute is refused.

`src/core/moment.js`, the calendar — a leap year is one the calendar agrees is
a leap year, and every month ends on the day the calendar says it does.

### How they are written

Three rules from fast-check's own guidance, each of which is visible here.

**Build the input and know the answer**, rather than generate one and work the
answer out the way the code does — a result computed by the same arithmetic
agrees with the code about the same mistake. The coordinate property builds a
value from whole degrees, minutes and tenths, placed anywhere inside its tenth
short of halfway, and expects exactly those parts back. The date properties
build
every moment from the platform's own Date, through `tests/unit/core/
fake-calendar.cjs`, rather than asking moment.js which days exist. Measured:
with June and July's lengths swapped in moment.js, properties that took their
calendar from moment.js report nothing wrong, and these fail from both the
calendar side and the reading side.

**Take the whole domain unless the algorithm needs less.** Every four-digit
year, because that is what the field holds — `fc.date` reaches year nought,
and the calendar is asked through `setUTCFullYear`, since `Date.UTC` reads a
year below 100 as 1900 plus it. Coordinates to ±180, because the same code
writes a longitude, and a longitude is bounded there rather than at the ±90 of
a latitude.

**Build valid inputs rather than discard invalid ones.** A day past a month's
end is generated past it; an impossible offset is generated impossible. One
filter remains — for text after the minute that does not begin a reading —
and it drops about one string in twenty.

### Seeds

Ordinary runs — `npm test`, the coverage gate, continuous integration — use
fast-check's defaults: a fresh seed and a hundred cases each time, so the
inputs keep changing from run to run. A failure is reproducible without a
fixed seed, because fast-check reports the seed it used and the smallest
counterexample it could shrink to.

A mutation campaign is the exception. It runs the suite once per mutant, and a
mutant that one seed kills and another does not would make the score a matter
of luck, so under it the seed is pinned and each property runs 25 cases.
`tests/unit/fast-check-mutation.cjs` does that, loaded by Stryker's tap runner
with `-r`. Measured: with that file made to throw, Stryker's dry run stops on
its message, so the runner does load it.

A property that runs unpinned has to hold for every input, not only for those
one seed happened to reach, so each of these was run at 20,000 cases on
several seeds before it was allowed to.

### What it costs, and what it does not buy

Stryker's dry run, which excludes the machine's load from the figure: the
suite's net running time is 1949.77ms with no properties and 2038.69ms with
these at the campaign's 25 cases. The mutation score is 96.52, against 96.48
without them, which is within what a timed-out mutant counting as killed does
from one run to the next.

Coverage is 100% with or without them. Nothing in this code fails any of them.
What they are is the assertion that the faults this arithmetic has had cannot
come back. With `place.js` reverted to the rounding that shipped, under the
campaign's seed, three fail: a value just short of a whole minute, shrunk to a
thousandth of a tenth of a second below one degree; no sixtieth, on
179.99998611111113; and no signed nothing, on -5e-324.

**A generator has to have the shape of the risk.** The carry that shipped needs
a value just below a minute, and a value drawn from anywhere lands there too
rarely: the built-from-parts property reached it in three runs of five at a
hundred cases, and not at all in the campaign's twenty-five. So the carry has
a construction of its own, just below the boundary, and it fails in every run
against the shipped rounding.

## What the tools are asked, and why differently

Presence is not enough: a build can be installed, on PATH, and still refuse a
flag this program uses on every run. Two tools are needed — `vips` and
`exiftool` — and they cannot be asked the same way.

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

Nothing is asked about typefaces, because nothing external answers for them.

## How a typeface is resolved

pango answers every name. Asked for one it cannot place, it draws in a default
face and says nothing — so a name nobody checked is a stamp in a face nobody
chose. Every name is resolved against the machine's own font catalogue before
anything is drawn.

**The catalogue is CoreText**, read through `NSFontManager` across the same
bridge the settings form is built with: `availableFontFamilies` for the
families, `availableMembersOfFontFamily:` for the faces of one. It is the font
system the renderer draws through, which is the whole point of the choice.
Measured with `otool -L`: pangocairo links `libpangoft2` and `libfontconfig`
**and** `/System/Library/Frameworks/CoreText.framework`. Which one draws is
chosen at run time, the default is CoreText, and `PANGOCAIRO_BACKEND=fontconfig`
selects the other and produces different bytes for the same request.

The two catalogues are not interchangeable. Measured on this Mac:

| catalogue | families it lists | of those, the renderer draws |
| --- | --- | --- |
| fontconfig | 671 | 147 |
| CoreText | 217 | 188 |

Neither list contains the other. A face switched on by a font manager — which
registers a file wherever it sits rather than installing it where fontconfig
looks — is in CoreText and not in fontconfig.

**A name is a family and, optionally, a face of it.** "Georgia", "Georgia
Bold", "Avenir Black", "Source Serif 4 Semibold". Splitting takes the
**longest** family prefix that the catalogue knows, not the shortest, because
family names are made of the words styles are also made of: "Avenir Next" is a
family and not Avenir in a style called Next, and "Arial Hebrew Scholar" is a
family and not Arial Hebrew in some Scholar style. The remainder must be a
face that family has, or the name is refused.

Matching ignores case and the spacing at either end. Measured across all 217
families and their faces: no family or face name on this Mac contains a comma,
so neither half needs escaping before it is joined into a description.

**One resolution, three callers.** The settings window, the stepwise dialogs
and a headless configuration all resolve through `src/core/typeface.js`, so a
name a configuration file may use is exactly a name somebody may type. A name
that resolves to nothing is refused with the reason before any photograph is
touched — refused rather than repaired, because choosing the substitute here
rather than letting pango choose it is the same silence with better manners.

**A host with no catalogue is not a Mac with no fonts.** If AppKit cannot be
reached, nothing can be checked: the suggestions are offered unfiltered and
the typed name is passed to pango whole, without the comma, so pango splits it
as best it can. That is worse, and it is better than refusing every typeface
on a machine that has them all.

### The limit of a catalogue, stated

CoreText lists names, not files. Measured: of its 217 families, 188 draw
distinctly, and 8 of the remaining 29 cover the probe characters and still
come out as the fallback face. Seven of those eight are old suitcase fonts
cairo will not open — Hoefler Text, Big Caslon, Apple Chancery, Kannada MN,
Kannada Sangam MN, Telugu MN and Telugu Sangam MN — and asking for one of them
stamps in the fallback face without saying so. The other 21 of the 29 do not
cover the Latin probe characters, which is a fact about the text rather than
about the font.

Verifying by drawing instead — rendering each candidate beside a name nobody
has and refusing whatever matches — is unsound at its root: measured, **the
face pango falls back to is Helvetica**, so such a test can never approve
Helvetica, and Times with it. Measured, it refuses 442 of the 589 families a
person can see. Seven rare silent substitutions is the price of not turning
away the most ordinary names on the machine, and it is written here rather
than left to be discovered.

## What a font description must look like

What vips receives is a pango description, not a family name, and pango reads
the words before the size as style instructions. A comma ends the family. The
two halves are kept apart until the description is built, which is the one
place they are joined. Measured on this Mac:

| asked for | drawn |
| --- | --- |
| `Times New Roman 40` | family "Times New", normal weight |
| `Arial Black 40` | Arial at weight 900 |
| `Times New Roman, 40` | Times New Roman |
| `Avenir, Black 40` | Avenir Black |
| `Avenir, Light 40` | Avenir Light |
| `Helvetica Neue, Condensed Bold 40` | that face |
| `Source Serif 4, Semibold 40` | that named instance of the variable font |
| `Helvetica Neue Bold, 40` | **the fallback face** |

The last row is why the comma matters: a full face name with a comma after it
is a family nothing has.

Two limits of the description, measured and stated rather than discovered
later. A style word pango does not know is ignored rather than folded into the
family, so `Avenir, Book 40` draws Avenir's own default face, which is Avenir
Book. And pango's weight scale is coarser than some families' face lists:
Avenir Heavy and Avenir Black render identically, as do Helvetica Neue
UltraLight and Light, and Hiragino Sans W4 and W8. Both fail towards the
family that was asked for.

**What vips reads is markup.** Measured, and not an edge case: "Mum & Dad" is
refused outright — invalid markup, no file written, that photograph failed —
and `<b>x</b>` is silently drawn in bold. Somebody typing a caption is typing
a caption, so the three characters markup reserves are written as the entities
that mean themselves, where the argument is built, which is the one place text
becomes a command. Only those three: the quote and the apostrophe are content
characters in markup, and a coordinate is full of them.

## What a caption colour costs

A colour chosen in the form is three sRGB numbers, and writing those numbers
into a photograph does not make them that colour: they are read through
whatever profile the photograph carries. Measured on this Mac, in Lab:
`#FF3B30` written into a Display P3 photograph lands about 19 from the red
that was asked for, and `#FFD400` about 28. A difference of 2 is visible.
Every recent iPhone photograph is Display P3.

White and dark grey are exact — the neutral axis is shared — which is why the
defaults never showed it.

So a photograph's profile is taken out of it with exiftool and the colour is
moved into that space before it is painted. One file per distinct profile
rather than per photograph, because a batch comes off one camera. A transform
that fails leaves the sRGB numbers, and the run says how many photographs that
applied to.

`tests/integration/copies.sh` stamps the same red caption onto an sRGB
photograph and a Display P3 one and requires the two to render within 2 of
each other in Lab.

### A grey photograph cannot hold a colour

Measured on this Mac: `#FF3B30` moved into a grey profile is one band with the
value 138, and the transform succeeds. A run that trusts that reports the
colour as handled, and a red caption on a grey-profiled photograph comes out
grey with nothing said.

The photograph and the stamp meet in sRGB instead. The photograph is read into
sRGB through its own profile, so its greys keep their meaning — measured, 200
comes back 200, 200, 200 — and the caption keeps the colour that was chosen.
Only when the colour needs it: white, black and the default outline are greys,
so an ordinary run over a grey photograph is untouched and the copy stays as
grey as the photograph was. A copy that changed in kind is counted and said
once for the run.

### Three answers about a profile, not two

"This photograph has no profile" and "this photograph's profile could not be
read" are different, and collapsing them reports the second as the first,
which reports the colour as handled. Measured: exiftool writing the tag to
standard output exits 0 with bytes for a photograph that has a profile, exits
0 with none for one that does not, and exits non-zero for a file it cannot
read. The three are told apart, and a failure is counted rather than assumed
away.

The file the profile is written to is named after the attempt and nothing
else. Named after the photograph, a 250-character name asked for a 264-byte
filename — longer than any Mac filesystem takes — and measured, that fails
with ENAMETOOLONG.

## When one drawing serves many photographs

A stamp is drawn once per distinct inscription and colour space rather than
once per photograph: a burst taken in one minute in one place says the same
thing, and the same words painted for a Display P3 photograph are different
numbers from the same words painted for an sRGB one.

A colour space is the profile **and whether it could be read**, not the
profile alone. Those are two different spaces sharing an empty path: one is
drawn for in sRGB and reported as handled, the other is drawn for in sRGB and
counted as unconverted. Keyed on the path alone, the second takes the first's
drawing and with it the first's verdict.

Eight drawings are kept. A run of a thousand photographs across an afternoon
says a thousand different things, and keeping every drawing would leave a
thousand files in the workspace to serve a hit rate of nothing.

## Reading a date and a place

A moment is read completely or not at all — a real day of a real month of that
year, and a clock. Read in pieces, `2026:02:31 99:99` passes the month and day
bounds, and anything trailing the minute is ignored, so "12:30garbage" becomes
half past twelve. The shapes cameras write — the seconds, a fraction of one,
an offset — are accepted without being displayed.

The file's modification time is not a fallback. It is only ever reached when
both camera tags are absent, which is exactly the case where it is an editor's
clock. `CreateDate` is, because for a camera digitization time is the shutter.

A metadata read that failed is not a photograph with no metadata. Collapsed,
a broken exiftool produces a folder of copies with no date on them and a
report saying everything worked.

Coordinates round into their smallest displayed unit first and read the larger
units back out of it. Rounded after the degrees are taken, 12.9999999 comes
out `12°59'60.0"N`. The hemisphere is read off the coordinate rather than off
a second rounding: half the smallest displayed unit south of the equator
rounds to a magnitude of one unit and, rounded again as a signed number, to
negative zero, which labels a place a tenth of a second south of the equator
as north of it.

Hemisphere signs are applied once. With `-n`, exiftool returns composite
coordinates already signed: a photograph tagged 33.8688 S comes back as
-33.8688.

The photograph is asked nothing it was not asked about. The query names the
two moment tags only when a date is stamped and the two GPS tags only when a
place is, so with coordinates off the place is never read. A request wanting
neither does not run exiftool at all, so a reader that will not run cannot
fail a job that needs nothing from it — and the builder refuses an empty tag
list outright, because exiftool reads no tags named as every tag there is.

What comes back is read as one record: an array of exactly one object, or the
read failed. A coordinate is a JSON number or text that is a plain decimal —
`1e2`, `0x10` and ` 12 ` are not places — inside ±90 or ±180; zero is a
place.

A copy that could be made but lacks part of what was asked for — a caption
drawn, the date absent — is recorded against the copy with the fields it
lacks. A field that was not asked for is never missing.

## What a value from outside may be

Everything that arrives from a settings file or a remembered record is read
rather than coerced. `[36]` is not a text size of 36, `true` is not an outline
a pixel wide, and `{}` is not the caption "[object Object]". Valid JSON is not
yet a set of settings either: `null`, `false`, `0`, a bare string and a list
all parse, and asking any of them for a setting fails further along in words
about the failure rather than about what was read.

A caption is bounded at 500 characters, because a stamp is a caption rather
than a document and an unbounded one renders a text image larger than the
photograph it is going on.

## What a stamp that will not fit does

A stamp larger than its photograph is refused, with both sizes in the message.
Measured: vips crops an overlay to the image beneath it, so unrefused, a
26-character caption at 90 points on a 120-pixel photograph publishes as the
letters "A v" and is called a success.

Placement and the margin warning come out of the same arithmetic, which is the
only way they can agree. Asked separately, the warning asks for room on both
sides of both edges when a margin is measured from the two edges the position
names, and reports an eighty-pixel stamp fifteen pixels in from the corner of
a hundred-pixel photograph as sitting against the edge.

Every outline is drawn from a mask embedded in a border first. `vips rank`
keeps its input's dimensions, so without the border the growth is cut off at
the glyph edge on all four sides. Both layers are made from that one mask, so
they line up.

Every copy is written at quality 90, stated. The encoder's default, which vips
documents and this Mac confirms, is 75 for JPEG and lower for HEIF.

## A tool's exit status is not evidence of what it was asked to do

`image.js` checks its own outputs, because vips can exit zero having produced
nothing. The same scepticism applies to the source: the photograph is read
under a damage policy, so a file that cannot be read whole is refused rather
than salvaged.

Measured here on vips 8.18.6:

| | read plainly | read with the policy |
| --- | --- | --- |
| truncated JPEG | exit 0, salvaged | exit 1, refused |
| truncated PNG | exit 0, salvaged | exit 1, refused |
| truncated HEIC, TIFF, WebP | refused | refused |
| whole JPEG, PNG, TIFF, WebP, HEIC | read | read |

Every check after the decode passes on a salvaged file — the copy exists, it
is an image, it is the size the photograph said it was — so half a photograph
is published as a finished copy. Measured against the built artifact with the
policy stripped back out: a JPEG cut off at 55% was stamped, published as
`cut_stamped.jpg`, and reported as a complete success.

**The policy rides on the path, not on a flag.** The one stage that decodes
the photograph is `vips autorot`, which is not a load operation and has no
`--fail-on`, so vips reads the loader's settings off the end of the path it is
given exactly as it reads an encoder's off the end of the path it writes.
Measured, because it looks fragile and is not: vips tries the whole string as
a filename before it splits the trailing group off, so `p[1].jpg[fail_on=error]`
reads `p[1].jpg`.

**What the preflight probe can and cannot establish.** Measured: vips checks
that a file exists and sniffs its format *before* it parses a load option, so
a probe naming a file that cannot exist never reaches one — and neither does a
probe naming a file that exists and is not an image. The load-option form
cannot be probed at all without writing a real image first, which is two more
subprocesses on every run to catch a libvips four years old. The probe carries
`--fail-on=error` on `thumbnail` instead, the same enum added by the same
libvips release: it establishes that this build has `VipsFailOn`, and infers
that its loaders take the option. That inference is written down here rather
than left in the code as a coincidence.

## A cancellation is not an answer, a diagnosis, or a refusal

Three readings of one wrong idea, each with its own consequence.

**Not a diagnosis.** `isRegularNonEmpty` lets a cancellation out rather than
swallowing it. Swallowed, a stop landing on the check after a vips stage is
reported as "the stamped photograph is not a file with anything in it" — a
wrong diagnosis rather than a late stop. It is let out there and
nowhere else: every other question in `asking.js` is put somewhere a raise
would cost something, and what that costs is a stop landing exactly on a
sub-millisecond `test` going unnoticed. vips takes seconds and is where
somebody actually asks.

**Not a refusal.** `linkFrom` returns its failure rather than reducing it to a
string. A cancellation and a refusal mean opposite things: the route below the
link exists because the link may be *impossible* — another volume, a
filesystem without hard links — and taking it after a cancellation makes a
folder in somebody's photographs and copies the whole picture into it after
they said stop. `deliver`, `throughStaging` and `claimFrom` each ask before
choosing the next strategy.

**Not an outcome of publication.** A stop is neither published nor refused: it
is **abandoned**, and it carries no reasons, because there is nothing to say
about a file that is not there. What it does carry is the claim — an
interrupted call is not proof the filesystem did nothing, and a hard link
shares the identity of the file it was made from, so the output path is asked
the same question a successful claim asks it. A link made before the stop
surfaced is a copy that was published and counted, and then the run stops; one
that was not leaves nothing behind and the copy goes with the workspace, which
is the difference from a refusal, where the person needs the copy back.

Stopping latches. The modifier is polled between reports, so without a latch
somebody who holds it while a photograph is being stamped and lets go before
it finishes has asked for nothing.

## The reports are the checkpoints

A report of what is *about* to happen may stop the run; a report of what has
happened may not. Nothing has been done at any of the first kind, so nothing
is lost by not doing it, and a stage added later becomes a checkpoint by
writing the line that makes it visible. The second kind is the one exception
and it is exact: unwinding past finished work throws away the account of it.

Two details are load-bearing. The check comes *after* the report, because a
host raises at the call following the button, so the report that discovers a
stop is the one being made. And announcing a photograph happens inside the
attempt's own `try`, where a stop is an outcome of that photograph rather than
an escape from the batch — outside it, the first stop takes the whole account
of what had already been published with it.

Holding the Option key is what asks. `NSEvent.modifierFlags` can be read with
no delegate, no event tap and no permission prompt; the panel ignores mouse
events and the host's Progress object has no cancel, so a stop asked for any
other way could never become true.

## Publishing a finished copy

Every path out of a claim ends by asking the output path which file it holds.
A claim that reports failure may have succeeded: `ln` makes the link, the
command reports failure, and the next question — is the name taken — answers
yes. Believing the report, publication concludes the name was taken by
somebody else and sets a second copy aside.

Ownership is registered before the fact, not after. A photograph refused for
being multipage or CMYK is refused from questions asked of the source, before
anything decodes it, so there is nothing to leak; measured, vipsheader answers
both about the file itself for every format this accepts. Asked after the
decode, every such refusal leaks a full-sized intermediate. A finished copy is
the job's from the moment it exists rather than once a name has been chosen
for it, so a run that cannot find a free name does not throw away finished
work.

Copies an earlier run left in the folder are excluded by design, and excluded
is its own outcome rather than a failure counted against the request. Counted
against it, an ordinary second run over a folder reports "1 of 2 stamped, 1
not usable" and exits non-zero.

A photograph with nothing to stamp is a third outcome beside stamped and
failed. Treated as a failure it fails in the renderer's words, so somebody who
asks for the date on a folder of scans is shown "text: no text to render" and
the command that produced it.

## What a saved copy costs while it is being made

The stages between a photograph and its copy are uncompressed. A 24-megapixel
photograph is about 70 megabytes oriented and rather more once the stamp has
been composited onto it, and a batch of two hundred kept until the end of the
run would ask the disk for tens of gigabytes it was never told about. Each
photograph's intermediates are removed as soon as its copy is written; the
stamps are not, because one drawing serves every photograph that carries the
same text.

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

## What a run remembers

Nine settings, kept as one record under one key in a named defaults suite:
everything but your own text, the GPS choice included. Coordinates are off in
the compiled defaults, so a first run stamps the date and nothing about the
place; after that the record decides, like every other setting.
One record rather than one key each, because two keys can be written by two
runs at once and leave one run's typeface beside another's colour.

The version is in the name of the key rather than in the record. A record this
version cannot read is one it must not overwrite either, and checking a number
inside the record cannot stop that: by the time the number is read, the run is
already pointed at the key it is about to write. A later version can still
read this one's and bring it forward.

The record holds settings rather than answers — what the pipeline stores, not
what a control was showing — because a label is display text that renaming a
preset would change. What comes back is not trusted: it has been on disk,
where anything can edit it, so it goes through the same validation a headless
configuration does, by the same function. Anything unreadable, unrecognised or
out of range is no answer at all, and the run opens on the compiled defaults.

Your own text is not kept. It is about one job, and it is the field most
likely to say something private. Nor is what a typeface name turned out to
mean: that is a fact about the machine as it was that day, worked out again
next time.

A record written by 1.0.0 is read unchanged, because the typeface is one name
in both.

Every copy of the action shares the suite, so a workflow kept for testing and
one used for real change each other's settings.

## The settings window, and the dialogs behind it

The window is preferred and the stepwise dialogs are the fallback, because a
host that can present neither is a host this cannot ask anything — and falling
back to ten questions is better than failing a run over a widget.

**What the two cannot do equally.** A dialog's field is one line, so a caption
typed there is one line; the window takes as many as you type, and so does a
headless configuration. Everything else is asked the same way in both,
including the typeface, which is typed and resolved by the same function.

**The typeface control is a list you can also type into**, which is what the
colours have always been. The suggestions are a handful worth having at hand
— ten families macOS ships, each with its bold face where the family has one —
rather than a menu of 217. Measured through the real bridge with the shipped
artifact: "Helvetica Neue Bold", the longest name the list offers, asks AppKit
for exactly 165 points, and the hint "or type a name" asks for 82 of the 87
that leaves.

**A hint that offers is not marked when the row is refused.** Marking a row
paints the value and its hint together, which is right for a hint that states
a rule — "8-400 pt", "or type #RRGGBB" — and wrong for one that invites:
painting "or type a name" red tells somebody who has just typed one that they
have not, in the loudest place on the row. A control says which kind its hint
is. What makes a typeface acceptable cannot go in 87 points of hint column
anyway; it is the sentence at the top.

**A label names the setting, not the subject.** `Date/time format:` and
`Coordinate format:` over menus of `2026-09-09 14:30` and `56.9496, 24.1052`,
because a noun over a menu of plausible values reads as a choice of *which*
date, or as data already read out of the photograph and offered back. The
window says it once above the rows: "The date and place come from each image's
own metadata; the formats below are examples." The items stay samples rather
than names — "ISO 8601 to the minute" is a name somebody has to know already.

**Whether to stamp the place is a checkbox; how is the menu beside it.**
Publishing where a photograph was taken is a different decision from how a
date is written, and it deserves a control that reads as one. The two still
submit one setting — `coordinateFormat` is `none` or a format — so they cannot
contradict each other. The checkbox's `value` is bound to the menu's `enabled`,
with no target or delegate; the binding is removed when the form closes,
whichever way. Turning it off and on again in an open form keeps the format.
The date row keeps "Do not stamp the date" as a menu item: the date is the
default content, not an opt-in.

**What the window says before anything is created**, from
`src/core/stamp-description.js`, in the words Image Files to PDF uses for the
same things: what was selected ("You have selected 12 images.", or "Found 231
images in your selection, including subfolders." when a folder was selected —
admission counts selected folders, including refused ones); that each image
gets a stamped copy, saved in each folder you selected or beside each image
you selected, and the originals are not changed; where the stamp's words come
from; and that leaving GPS off does not remove location data already in the
image. A form sent back puts the problems first and keeps all of that.

**Consent.** Selected items that will not be stamped are listed in a
Continue/Cancel dialog before the settings. A request that would stamp nothing
is a problem on the custom-text row, sent back like any other, rather than a
failure after Create. The stepwise dialogs put the window's text above their
first question, read each answer on its own, and end with a Create/Cancel
review of every setting, since the last answer to a question is not consent to
write files. Settings are remembered only after that consent. Anything but the
button that goes on is a cancellation, and a cancellation never falls back to
another interface. When the window stops working part way, the dialogs open on
the answers last submitted.

## What a Quick Action does with the result

A person is answered with nothing at all, said out loud with `return
undefined`.

Measured on 2026-09-14 against the built artifact in a real Quick Action: a
text result is written out by Shortcuts as a file named after the text, with
the slashes turned into colons, so returning the list of published paths left
a 42-byte file beside each copy —

    :Users:someone:Downloads:IMG_1538_stamped.txt

— holding one line and carrying
`com.apple.quarantine: 0082;...;com.apple.shortcuts;`. Five paths returned,
five files. Nothing in the installation this ships has a second action to
chain to, so the list had nowhere to go but the filesystem.

The headless path is untouched: there the return value is the receipt, and the
integration suites read it. What is given up is chaining this action to
another one inside a shortcut, which is a capability somebody can ask for;
litter in their photographs is not a default worth keeping to hold it open.

**Not established:** that returning nothing stops Shortcuts writing anything.
What is established is where the files came from and what was in them.

## What counts as a complete run

A headless run is complete when every photograph asked for came back as a
copy and no copy lacks anything it was asked to show. Copies missing a
requested date or place overlap the stamped column of the ledger rather than
forming a sixth one, which would count one photograph twice; they make the run
incomplete, so the receipt is written and the run exits non-zero, and the
copies stay where they were published.

A person is told the same things in paragraphs, in the order and the words
Image Files to PDF uses where the two say the same thing: what was created and
where it was saved, with a stopped run's count of images not stamped; the
images that could not be stamped; those there was nothing to stamp on; those
stamped without everything asked for; and the selected items not included.

## macOS integration gate

`npm run test:integration:macos` runs eleven suites against the built artifact
through `osascript`, on real files.

- **macos** — a headless run stamps real photographs: the pixels that are not
  the background are counted, in the corner the settings named, and nothing
  was drawn in the others. It also covers the refusals — a caption with an
  ampersand, a photograph with nothing to stamp, a stamp too large to fit, the
  quality the copy is written at, and a second run over a folder leaving the
  first run's copies alone.
- **copies** — the same red caption on an sRGB photograph and a Display P3
  one, required to render within 2 of each other in Lab.
- **colour** — a coloured caption on a grey-profiled photograph, and the count
  the run reports for it.
- **typeface** — a family draws; a name no face answers to is refused and
  nothing is published; a family asked for a style it has not is told which
  styles it does come in; a family whose name ends in a style word draws; a
  style reaches the renderer as a style, with bold covering more pixels than
  regular; and two styles no weight menu could offer draw different pictures.
- **damaged** — a truncated JPEG and a truncated PNG are refused by name while
  whole files alongside them are stamped, and the refusal carries what vips
  said.
- **content** — a configuration without `coordinateFormat` is refused and
  writes nothing; the date alone is drawn with coordinates off; decimal and
  degrees/minutes/seconds each change the pixels and differ from each other;
  the original is byte-identical afterwards; a copy with coordinates off still
  carries the source's GPS metadata; and a copy lacking a requested place, or a
  requested date beside a caption, is kept, reported in `missingMetadata`, and
  exits non-zero.
- **form** — the settings window built from the shipped artifact with real
  AppKit, not run modally, for several selections and a form sent back with
  invalid answers, in the light and dark appearance: every menu item fits its
  control by the cell's own measured size, no label or hint is clipped, every
  control carries its label and help for accessibility, the checkbox enables
  and disables the format menu through the binding, and the alert is no taller
  than 744 points — the 11-inch MacBook Air of early 2015, the smallest display
  macOS 12 supports, less its menu bar. Measured: 694 points, 726 with two
  corrections shown. The runner's own screen is not the measure, because a CI
  runner's virtual display is smaller than any Mac's. It writes a PNG of each form to `$STAMP_FORM_PREVIEWS`, which CI keeps
  as `native-form-previews`. This is layout measured in AppKit, not use: nobody
  has operated the form with VoiceOver.
- **selection**, **publication**, **volumes**, **cards** — publication against
  a real filesystem, below.

## What publication has been measured against

Against the built artifact, on real filesystems:

- an ordinary folder publishes in one operation and leaves nothing of the
  machinery behind, and the published copy has one name rather than two;
- a dangling symbolic link standing at the output name is stepped around
  rather than replaced — `-e` follows it and reports the name as free;
- a folder that cannot be written to refuses every route, and the finished
  copy is somewhere the message names, readable, and the size it should be;
- a folder whose ACL denies `add_file` and allows `add_subdirectory` makes the
  place beside the destination, copies into it, and is refused both ways of
  creating the name — on the boot disk, which does hard links and exclusive
  renames both, so the message carries the system's own words and names no
  cause nobody established;
- an attached HFS+ volume, where the workspace and the output folder are
  different filesystems, publishes through the staging place and sweeps it;
- an attached FAT32 volume, which has no hard links at all, publishes by
  exclusive rename, and steps around a name something else is holding;
- an attached exFAT volume, which has neither, stops: nothing of the run
  reaches the card, the message carries `Operation not supported` from the
  kernel, and the finished copy is where the message says.

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
  built and read back as "Riga\nLatvia". A text field cannot — Return commits
  the alert rather than starting a line — so the promise that your text keeps
  its line breaks is one only a headless caller and the window can make;
- the font catalogue answers: 217 families, and for a family its faces by
  name.

A Quick Action run on 2026-09-14 established that five photographs selected in
Finder arrive in the shape the input adapter expects and are stamped.

## What has not been established

These are inherited confidence from the sibling project rather than
measurements of this one:

- that AppKit presents the form and the panel from inside the Shortcuts
  helper, which is a different process from `osascript` with a different
  activation policy. The 2026-09-14 run reached the settings, so something
  asked; what has not been recorded is which of the two asked, and the panel
  is a separate question again;
- that a named defaults suite is writable there, which is where the settings
  of the last run are kept;
- that `NSEvent.modifierFlags` reports a modifier as held while a Quick Action
  is running. The call was measured; a key being held while it is made was
  not, because nothing here can hold one.

A run that cannot remember opens on the compiled defaults and stamps the
photographs anyway, and a host that can present nothing falls back to asking
one question at a time — so none of the three is a run that fails. They are
things the documents must not claim until somebody has watched them.

## What was rejected, and why

Four prescriptions are declined deliberately, each for one reason.

- **A CoreText renderer** would make drawing depend on AppKit inside the
  Shortcuts helper, which is the one thing about this product that has not
  been established — trading a measured dependency for an unmeasured one.
  Reading the font catalogue through AppKit is not the same bet: a host that
  cannot reach it still draws, with nothing checked.
- **A native process runner** buys stopping mid-photograph, which is worth
  less than the failure modes an NSTask and a hand-run event loop bring into a
  Quick Action.
- **A publication journal with crash reconciliation** is machinery for a
  failure this program cannot have: it never modifies an original and never
  publishes over a name it does not own, so the worst a crash leaves is a
  temporary directory.
- **Snapshotting every source** doubles the I/O of every run to close the
  window described above.

Free-form variable-font axis values — `Cantarell @wght=550` — are not
supported. Named instances are, because the font system lists them as faces.
