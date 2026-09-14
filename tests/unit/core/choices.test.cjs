"use strict";

/*
 * What a person may choose, and the words they choose it by.
 *
 * The label is read and the value is stored, and they are deliberately not the
 * same word: renaming what a control says must not change what the program
 * does with the answer.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    POSITION,
    DATE_FORMAT,
    COORDINATE_FORMAT,
    SIZE,
    MARGIN,
    OUTLINE_WIDTH,
    labelsOf,
    defaultLabelOf,
    defaultValueOf,
    valueOfLabel,
    labelOfValue
} = require("../../../src/core/choices.js");

const CONTROLS = [POSITION, DATE_FORMAT, COORDINATE_FORMAT];

test("a label and a value round-trip through each other", () => {
    for (const control of CONTROLS) {
        for (const choice of control.choices) {
            assert.equal(valueOfLabel(control, choice.label), choice.value);
            assert.equal(labelOfValue(control, choice.value), choice.label);
        }
    }
});

test("the first choice is the default, both ways round", () => {
    for (const control of CONTROLS) {
        assert.equal(defaultLabelOf(control), control.choices[0].label);
        assert.equal(defaultValueOf(control), control.choices[0].value);
        assert.equal(labelsOf(control)[0], defaultLabelOf(control));
    }
});

test("the defaults are the ones somebody stamping a photograph wants", () => {
    assert.equal(defaultValueOf(POSITION), "bottom-right");
    assert.equal(defaultValueOf(DATE_FORMAT), "iso-minutes");
    assert.equal(defaultValueOf(COORDINATE_FORMAT), "decimal");
});

test("a word no control offers is refused rather than guessed at", () => {
    for (const control of CONTROLS) {
        assert.throws(
            () => valueOfLabel(control, "Sideways"),
            /Unrecognised choice: Sideways/u
        );
        assert.throws(
            () => labelOfValue(control, "sideways"),
            /Unrecognised value: sideways/u
        );
    }
});

test("every label is distinct, because a menu is chosen from by label", () => {
    for (const control of CONTROLS) {
        const labels = labelsOf(control);

        assert.equal(new Set(labels).size, labels.length);
    }
});

test("every value is distinct, because a value is what is stored", () => {
    for (const control of CONTROLS) {
        const values = control.choices.map((choice) => choice.value);

        assert.equal(new Set(values).size, values.length);
    }
});

test("the date and the coordinates can both be declined", () => {
    assert.equal(valueOfLabel(DATE_FORMAT, "Do not stamp the date"), "none");
    assert.equal(
        valueOfLabel(COORDINATE_FORMAT, "Do not stamp the coordinates"),
        "none"
    );
});

test("the choices a date offers are shown as dates, not described", () => {
    // "2026-09-09 14:30" says what it does; "ISO 8601 with minutes" does not.
    assert.deepEqual(labelsOf(DATE_FORMAT), [
        "2026-09-09 14:30",
        "2026-09-09",
        "9 September 2026",
        "Do not stamp the date"
    ]);
});

test("the coordinates are shown the two ways they can be written", () => {
    assert.deepEqual(labelsOf(COORDINATE_FORMAT), [
        "56.9496, 24.1052",
        "56\u00b056'58.6\"N 24\u00b06'18.7\"E",
        "Do not stamp the coordinates"
    ]);
});

test("every corner and both centres are offered, named for the edges", () => {
    assert.deepEqual(labelsOf(POSITION), [
        "Bottom right",
        "Bottom left",
        "Top right",
        "Top left",
        "Bottom centre",
        "Top centre"
    ]);
    assert.deepEqual(POSITION.choices.map((choice) => choice.value), [
        "bottom-right",
        "bottom-left",
        "top-right",
        "top-left",
        "bottom-centre",
        "top-centre"
    ]);
});

test("a number is offered with its bounds and a default inside them", () => {
    for (const control of [SIZE, MARGIN, OUTLINE_WIDTH]) {
        const value = Number(control.defaultAnswer);

        assert.ok(control.minimum <= value && value <= control.maximum, control.label);
        assert.match(control.prompt, new RegExp(`${control.minimum}`, "u"));
        assert.match(control.prompt, new RegExp(`${control.maximum}`, "u"));
        assert.ok(control.hint.length > 0);
    }
});

test("an outline may be asked for and may be declined", () => {
    assert.equal(OUTLINE_WIDTH.minimum, 0);
    assert.match(OUTLINE_WIDTH.hint, /0 for none/u);
});

test("every control says what it is asking, twice over", () => {
    // The prompt is a sentence for the stepwise dialogs; the label is a
    // column heading in the form. Neither reads as the other.
    for (const control of [...CONTROLS, SIZE, MARGIN, OUTLINE_WIDTH]) {
        assert.match(control.prompt, /:$/u);
        assert.match(control.label, /:$/u);
    }
});
