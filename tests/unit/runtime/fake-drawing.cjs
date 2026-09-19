"use strict";

/*
 * What the drawing tools answer: the header fields vipsheader reports, and
 * the contents of a file the runtime reads.
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

function readsFile(app, command) {
    const read = READS_FILE.exec(command);

    return read ? (app.textFiles ?? {})[read.groups.path] ?? "" : undefined;
}

function headerField(app, command) {
    const field = HEADER_FIELDS.find(([name]) => command.includes(name));

    return field ? String(app[field[1]] ?? field[2]) : undefined;
}

module.exports = { readsFile, headerField };
