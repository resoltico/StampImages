"use strict";

/*
 * What the form asks, described as data.
 *
 * One list of rows, in the order a person thinks about them, turned into ten
 * descriptions the runtime layer only has to render. Everything decidable
 * without AppKit is decided here, which is why it can be asserted at all.
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

function byKey(key) {
    return rowsFor().find((row) => row.key === key);
}

test("the rows read in the order somebody fills them in", () => {
    assert.deepEqual(ORDER.map((row) => row.key), [
        "dateFormat",
        "coordinateFormat",
        "customText",
        "font",
        "size",
        "textColour",
        "outlineWidth",
        "outlineColour",
        "position",
        "margin"
    ]);
});

test("every row becomes exactly one description", () => {
    const rows = rowsFor();

    assert.equal(rows.length, ORDER.length);
    assert.deepEqual(rows.map((row) => row.key), ORDER.map((row) => row.key));
});

test("the typeface row is a list of what this Mac draws with", () => {
    // Not a constant: a name written down here might be one the machine
    // quietly renders as something else.
    assert.deepEqual(byKey("font").options, [
        { label: "Menlo" },
        { label: "Menlo Bold" }
    ]);
    assert.equal(byKey("font").kind, "choice");
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

test("each kind of row carries what its widget needs and no more", () => {
    assert.equal(byKey("size").kind, "number");
    assert.equal(byKey("size").minimum, 8);
    assert.equal(byKey("size").maximum, 400);
    assert.equal(byKey("textColour").kind, "colour");
    assert.match(byKey("textColour").hint, /#RRGGBB/u);
    assert.equal(byKey("customText").kind, "text");
    assert.equal(byKey("customText").hint, undefined);
    assert.equal(byKey("position").kind, "choice");
});

test("a value is a string whatever it was, because a control holds text", () => {
    const rows = formRows(
        { ...defaultAnswers(FONTS), size: 36, margin: 0 },
        new Set(),
        FONTS
    );

    assert.equal(rows.find((row) => row.key === "size").value, "36");
    assert.equal(rows.find((row) => row.key === "margin").value, "0");
});

test("what is wrong is marked on the row it is wrong about", () => {
    const rows = rowsFor(defaultAnswers(FONTS), new Set(["size", "textColour"]));
    const marked = rows.filter((row) => row.invalid).map((row) => row.key);

    assert.deepEqual(marked, ["size", "textColour"]);
});

test("every row says what it is asking, twice over", () => {
    // The prompt is a sentence for the stepwise dialogs; the label is a column
    // heading in the form. A control with only one of them made the dialogs
    // fall back to the heading, which reads as a heading.
    for (const row of ORDER) {
        assert.match(row.control.prompt, /:$/u, row.key);
        assert.match(row.control.label, /:$/u, row.key);
    }
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
