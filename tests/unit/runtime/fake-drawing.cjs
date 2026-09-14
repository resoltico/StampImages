"use strict";

/*
 * What the drawing tools answer: the header fields vipsheader reports, the
 * comparison that decides whether a font name resolved, and the contents of a
 * file the runtime reads.
 *
 * Apart from the rest of the machine because this half models the tools rather
 * than the installation: which of them exist is fake-shell.cjs's, and what
 * they say when they run is this.
 */

/*
 * The header fields the runtime asks for, with the answers an ordinary
 * photograph gives. Two of them are not universal, and the code has to tell
 * the cases apart: a file written without metadata has no orientation field,
 * and a single-page format has no n-pages field. vipsheader fails for a field
 * it cannot find, naming it -- which is what the tests that cover those drive
 * directly, because a fake that always answers would hide both.
 */
const HEADER_FIELDS = [
    ["'width'", "width", 600],
    ["'height'", "height", 400],
    ["'orientation'", "orientation", 1],
    ["'bands'", "bands", 3],
    ["'interpretation'", "interpretation",
        "((VipsInterpretation) VIPS_INTERPRETATION_sRGB)"]
];

const READS_FILE = /^'[^']*\/cat' '(?<path>.*)'$/u;

/*
 * Which font names this machine draws with.
 *
 * The real probe draws a candidate and the impossible name and compares the
 * two files, so a machine is modelled by remembering which family was last
 * drawn into the candidate file and answering the comparison accordingly:
 * identical means the name fell back. Left unsaid, every candidate draws,
 * which is a Mac with all of them installed.
 */
const DRAWS_FONT =
    /'text' '(?<out>[^']+)' '[^']*' '--font' '(?<font>[^']+) \d+'/u;
const COMPARES = /^'[^']*\/cmp' '-s' '(?<one>[^']+)' '(?<other>[^']+)'$/u;

function noteFontDrawn(app, command) {
    const drawn = DRAWS_FONT.exec(command);

    if (drawn && drawn.groups.out.endsWith("font-candidate.png")) {
        app.lastFontDrawn = drawn.groups.font;
    }
}

function refusesComparison(app, command) {
    const compared = COMPARES.exec(command);

    // cmp fails when the files differ, which is what a name that resolved to
    // its own face looks like.
    return Boolean(compared) &&
        (app.fonts === undefined || app.fonts.includes(app.lastFontDrawn));
}

function readsFile(app, command) {
    const read = READS_FILE.exec(command);

    return read ? (app.textFiles ?? {})[read.groups.path] ?? "" : undefined;
}

function headerField(app, command) {
    const field = HEADER_FIELDS.find(([name]) => command.includes(name));

    return field ? String(app[field[1]] ?? field[2]) : undefined;
}

module.exports = { noteFontDrawn, refusesComparison, readsFile, headerField };
