"use strict";

/*
 * The other direction: settings the form could have produced, which is what a
 * remembered run is given back as.
 *
 * The exact inverse of reading them, and only for a closed choice: a label is
 * looked up, and a number, a colour or a typeface is already what the control
 * holds. Which is why a remembered typeface that has gone since is no longer a
 * problem -- it used to be read back through the list of faces this Mac drew
 * with today, where an absent one has no label at all.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    readAnswers,
    answersFromSettings
} = require("../../../src/core/answers.js");
const { defaultAnswers } = require("../../../src/core/form-defaults.js");

const FONTS = ["Menlo", "Menlo Bold"];

function answers(overrides = {}) {
    return { ...defaultAnswers(FONTS), ...overrides };
}

test("settings become the answers a form would have been showing", () => {
    const { settings } = readAnswers(answers({ customText: "Riga" }), FONTS);

    assert.deepEqual(
        answersFromSettings(settings, FONTS),
        answers({ customText: "Riga" })
    );
});

test("the two directions are each other's inverse", () => {
    const given = answers({
        dateFormat: "2026-09-09",
        coordinateFormat: "56°56'58.6\"N 24°6'18.7\"E",
        font: "Menlo",
        weight: "Bold",
        size: "72",
        margin: "0",
        outlineWidth: "0",
        textColour: "#FF8000"
    });
    const { settings } = readAnswers(given, FONTS);

    assert.deepEqual(answersFromSettings(settings, FONTS), given);
});

test("a value nothing offers cannot be turned back into a label", () => {
    // Which is a settings file somebody edited, and is refused rather than
    // shown as an empty menu.
    assert.throws(
        () => answersFromSettings({ ...readAnswers(answers(), FONTS).settings, position: "middle" }, FONTS),
        /Unrecognised value: middle/u
    );
});
