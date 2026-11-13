"use strict";

/*
 * What this run will write on one photograph -- or the reason it will write
 * nothing on it.
 *
 * Nothing downstream of here may decide not to draw something. A photograph
 * that knows nothing about itself used to reach the renderer as an empty
 * drawing, which vips refused in its own words, so somebody who had asked for
 * the date on a folder of scans was shown "text: no text to render" and the
 * command that failed.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { inscriptionFor } = require("../../../src/core/inscription.js");

const TAKEN = {
    DateTimeOriginal: "2026:09:09 14:30:05",
    GPSLatitude: 56.9496,
    GPSLongitude: 24.1052
};

function settings(overrides = {}) {
    return {
        dateFormat: "iso-minutes",
        coordinateFormat: "decimal",
        customText: "",
        ...overrides
    };
}

test("the lines read in the order somebody reads them", () => {
    assert.deepEqual(
        inscriptionFor(TAKEN, settings({ customText: "Riga" })).lines,
        ["2026-09-09 14:30", "56.9496, 24.1052", "Riga"]
    );
});

test("the text is the lines, joined, each isolated so one cannot reorder another", () => {
    // Measured: a right-to-left caption drawn in one layout with the date and
    // place reversed them to "18:42 2021-07-14" and "24.1052 ,56.9496".
    assert.equal(
        inscriptionFor(TAKEN, settings({ customText: "Riga\nשלום" })).text,
        "\u20662026-09-09 14:30\u2069\n\u206656.9496, 24.1052\u2069\n\u2068Riga\u2069\n\u2068שלום\u2069"
    );
});

test("an override typed into a caption is closed at the end of its line", () => {
    const { text } = inscriptionFor(TAKEN, settings({ customText: "\u202eevil\nnext" }));

    assert.deepEqual(text.split("\n").slice(2), ["\u2068\u202eevil\u2069", "\u2068next\u2069"]);
});

test("each date format writes the date its own way", () => {
    const written = (dateFormat) => inscriptionFor(
        TAKEN,
        settings({ dateFormat, coordinateFormat: "none" })
    ).lines[0];

    assert.equal(written("iso-minutes"), "2026-09-09 14:30");
    assert.equal(written("iso-date"), "2026-09-09");
    assert.equal(written("long-date"), "September 9, 2026");
});

test("a line nobody asked for is not a line", () => {
    assert.deepEqual(
        inscriptionFor(TAKEN, settings({ dateFormat: "none" })).lines,
        ["56.9496, 24.1052"]
    );
    assert.deepEqual(
        inscriptionFor(TAKEN, settings({ coordinateFormat: "none" })).lines,
        ["2026-09-09 14:30"]
    );
});

test("a line the photograph cannot supply is left out, not stood in for", () => {
    // Never a line reading "unknown", which looks like a record of something.
    assert.deepEqual(
        inscriptionFor({ GPSLatitude: 1, GPSLongitude: 2 }, settings()).lines,
        ["1.0000, 2.0000"]
    );
    assert.deepEqual(
        inscriptionFor({ DateTimeOriginal: "2026:09:09 14:30" }, settings()).lines,
        ["2026-09-09 14:30"]
    );
});

test("a photograph with nothing to say is a reason, not a drawing", () => {
    const said = inscriptionFor({}, settings());

    assert.equal(said.lines, undefined);
    assert.match(said.nothing, /does not say when or where it was taken/u);
    assert.match(said.nothing, /no text of your own/u);
});

test("the reason names only what was asked for", () => {
    assert.match(
        inscriptionFor({}, settings({ coordinateFormat: "none" })).nothing,
        /does not say when it was taken/u
    );
    assert.match(
        inscriptionFor({}, settings({ dateFormat: "none" })).nothing,
        /does not say where it was taken/u
    );
});



test("an unrecognized format writes nothing rather than something wrong", () => {
    // The formats are a closed list; anything else is a caller's mistake and
    // must not become a line of somebody's photograph.
    assert.equal(
        inscriptionFor(TAKEN, settings({
            dateFormat: "rfc822",
            coordinateFormat: "utm"
        })).lines,
        undefined
    );
});

test("each requested fact a photograph lacks is named as missing", () => {
    assert.deepEqual(inscriptionFor({}, settings({ customText: "Riga" })).missing, ["date/time", "GPS coordinates"]);
    assert.deepEqual(inscriptionFor({ GPSLatitude: 56.9496, GPSLongitude: 24.1052 }, settings({ customText: "Riga" })).missing, ["date/time"]);
});
