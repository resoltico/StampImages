"use strict";

/*
 * The three settings that are a number between two others.
 *
 * The bounds are stated once and read by the form, the readers and the
 * settings alike, so the rule shown beside a field is the rule the answer is
 * measured against.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    SIZE,
    MARGIN,
    OUTLINE_WIDTH
} = require("../../../src/core/bounds.js");

const CONTROLS = [SIZE, MARGIN, OUTLINE_WIDTH];

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
