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
const { ORDER, formRows } = require("../../../src/core/form-rows.js");
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
        "weight",
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
