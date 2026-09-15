"use strict";

/*
 * The lists the form offers, and which of them are the whole truth.
 *
 * A closed list is everything that may be chosen: the position and the two
 * formats. The typeface is the one that is not -- probing every family
 * fontconfig knows would cost a rendering apiece, so what it offers is a
 * handful worth having at hand and a name may be typed instead.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    ORDER,
    fontControl,
    resolvedRow,
    controlFor,
    formRows
} = require("../../../src/core/form-rows.js");
const { defaultAnswers } = require("../../../src/core/form-defaults.js");

const FONTS = ["Menlo", "Menlo Bold"];

function rowsFor(answers = defaultAnswers(FONTS), invalid = new Set()) {
    return formRows(answers, invalid, FONTS);
}

function byKey(key, rows = rowsFor()) {
    return rows.find((row) => row.key === key);
}

test("the typeface row suggests what this Mac draws with, and takes any name", () => {
    // Not a constant: a name written down here might be one the machine
    // quietly renders as something else. And not the whole truth either --
    // probing every family fontconfig knows would cost a render apiece -- so
    // the row carries a hint saying a name may be typed instead.
    assert.deepEqual(byKey("font").options, [
        { label: "Menlo" },
        { label: "Menlo Bold" }
    ]);
    assert.equal(byKey("font").kind, "font");
    assert.equal(byKey("font").hint, "or type a name");
});

test("a closed list says nothing about typing, because nothing may be", () => {
    for (const key of ["position", "dateFormat", "coordinateFormat"]) {
        assert.equal(byKey(key).kind, "choice", key);
        assert.equal(byKey(key).hint, undefined, key);
    }
});

test("a machine with no fonts offers no fonts, rather than inventing one", () => {
    assert.deepEqual(fontControl([]).choices, []);
    assert.equal(formRows(defaultAnswers([]), new Set(), []).find(
        (row) => row.key === "font"
    ).options.length, 0);
});

test("only the typeface row is answered by the machine", () => {
    for (const row of ORDER) {
        const resolved = resolvedRow(row, FONTS);

        assert.equal(
            resolved === row,
            row.kind !== "font",
            `${row.key} should ${row.kind === "font" ? "" : "not "}be resolved`
        );
    }

    assert.equal(controlFor(ORDER[3], FONTS).choices.length, 2);
});

test("the two rows that choose a format say so", () => {
    // They were "Date:" and "Coordinates:", over menus of "2026-09-09 14:30"
    // and "56.9496, 24.1052" -- which reads as a control asking which date to
    // stamp, or offering one it had already read from the photograph. It is
    // neither: the values are the photograph's own and what is chosen here is
    // how they are written, or that they are not written at all.
    const labels = Object.fromEntries(
        ORDER.map((row) => [row.key, row.control.label])
    );

    assert.equal(labels.dateFormat, "Date format:");
    assert.equal(labels.coordinateFormat, "Coordinate format:");
});

test("choosing a format includes choosing not to stamp it", () => {
    // The one item that is not a sample: without it there would be no way to
    // say "not this one", and the pair of them is the whole of what makes a
    // run that stamps nothing possible to ask for.
    for (const key of ["dateFormat", "coordinateFormat"]) {
        const row = ORDER.find((each) => each.key === key);
        const off = row.control.choices.at(-1);

        assert.equal(off.value, "none");
        assert.match(off.label, /^Do not stamp /u, key);
    }
});
