"use strict";

/*
 * The one part of the stamp a person wrote.
 *
 * It keeps the line breaks and the spacing it was given, because it is not
 * this program's to tidy -- and it is the one thing that needs nothing from
 * the photograph, so a run that wants only this asks the photograph nothing.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    inscriptionFor,
    wantsMetadata
} = require("../../../src/core/inscription.js");

const { rigaFacts } = require("./gps-fixtures.cjs");

const TAKEN = {
    DateTimeOriginal: "2026:09:09 14:30:05",
    ...rigaFacts()
};

function settings(overrides = {}) {
    return {
        dateFormat: "iso-minutes",
        coordinateFormat: "decimal",
        customText: "",
        ...overrides
    };
}

test("custom text keeps the line breaks and the spacing it was given", () => {
    // It is the one part a person wrote, so it is not tidied into something
    // they did not write.
    assert.deepEqual(
        inscriptionFor({}, settings({ customText: "Riga\n\n  Latvia" })).lines,
        ["Riga", "", "  Latvia"]
    );
});

test("a trailing newline is an accident of typing, not an inch of space", () => {
    assert.deepEqual(
        inscriptionFor({}, settings({ customText: "Riga\n\n  \n" })).lines,
        ["Riga"]
    );
    assert.equal(inscriptionFor({}, settings({ customText: "  \n\n" })).lines, undefined);
});

test("text nobody typed is no line at all", () => {
    for (const value of [undefined, null, ""]) {
        assert.deepEqual(
            inscriptionFor(TAKEN, settings({ customText: value })).lines.length,
            2,
            String(value)
        );
    }
});

test("text somebody typed is enough on its own", () => {
    assert.deepEqual(
        inscriptionFor({}, settings({ customText: "Riga" })).lines,
        ["Riga"]
    );
});

test("a caption of your own is not a question for the photograph", () => {
    // A run that asks anyway is a run that can fail on a metadata reader it
    // never needed.
    assert.equal(wantsMetadata(settings()), true);
    assert.equal(wantsMetadata(settings({ dateFormat: "none" })), true);
    assert.equal(wantsMetadata(settings({ coordinateFormat: "none" })), true);
    assert.equal(
        wantsMetadata(settings({ dateFormat: "none", coordinateFormat: "none" })),
        false
    );
});

test("caption line endings and trailing invisible lines do not add empty rendered paragraphs", () => {
    const result = inscriptionFor({}, { dateFormat: "none", coordinateFormat: "none", customText: "A\r\nB\rC\r\n\u200b" });
    assert.deepEqual(result.lines, ["A", "B", "C"]);
    assert.doesNotMatch(result.text, /\r/u);
});
