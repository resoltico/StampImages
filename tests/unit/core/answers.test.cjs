"use strict";

/*
 * Turning what a person answered into settings, or into a list of what is
 * wrong with it.
 *
 * Every problem at once, each naming the setting it is about: a form that
 * reports the first bad field and only then the second is a sequence of
 * dialogs with extra steps.
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

test("the labels a person chose become the values the pipeline stores", () => {
    const read = readAnswers(answers({
        dateFormat: "9 September 2026",
        position: "Top left",
        customText: "Riga"
    }), FONTS);

    assert.equal(read.problems, undefined);
    assert.equal(read.settings.dateFormat, "long-date");
    assert.equal(read.settings.position, "top-left");
    assert.equal(read.settings.customText, "Riga");
});

test("a number is digits, and refused by name when it is not", () => {
    // Number() also reads "0x12C" and "3e2" as 300, which would be guessing
    // rather than reading.
    for (const typed of ["3e2", "0x12C", "36.5", " ", "-4", "thirty"]) {
        const read = readAnswers(answers({ size: typed }), FONTS);

        assert.equal(read.problems.length, 1, typed);
        assert.equal(read.problems[0].key, "size");
        assert.match(read.problems[0].message, /Text size: enter a whole number/u);
    }
});

test("a number outside its bounds is refused with the bounds", () => {
    const read = readAnswers(answers({ outlineWidth: "21" }), FONTS);

    assert.match(read.problems[0].message, /from 0 to 20/u);
});

test("every problem is reported at once, each with its row", () => {
    const read = readAnswers(answers({
        size: "huge",
        textColour: "sky",
        position: "Sideways"
    }), FONTS);

    assert.deepEqual(
        read.problems.map((problem) => problem.key),
        ["size", "textColour", "position"]
    );
    assert.equal(read.settings, undefined);
});

test("a colour is refused in the same words the settings would use", () => {
    const read = readAnswers(answers({ outlineColour: "#12345" }), FONTS);

    assert.match(read.problems[0].message, /Outline colour must be six/u);
});

test("a font this Mac does not draw with is not one of the choices", () => {
    const read = readAnswers(answers({ font: "Comic Sans MS" }), FONTS);

    assert.equal(read.problems[0].key, "font");
    assert.match(read.problems[0].message, /is not one of the choices/u);
});

test("custom text longer than a caption is refused, naming the limit", () => {
    const read = readAnswers(answers({ customText: "x".repeat(501) }), FONTS);

    assert.equal(read.problems[0].key, "customText");
    assert.match(read.problems[0].message, /500 characters or fewer/u);
});

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
        font: "Menlo Bold",
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

test("a number is taken as typed, less the spaces around it", () => {
    assert.equal(readAnswers(answers({ size: " 72 " }), FONTS).settings.size, 72);
});

test("a value exactly at its bound is inside it", () => {
    // Written as "greater than the maximum", so an off-by-one here refuses
    // the largest size the form offers.
    const read = readAnswers(answers({
        size: "400",
        margin: "0",
        outlineWidth: "20"
    }), FONTS);

    assert.equal(read.problems, undefined);
    assert.equal(read.settings.size, 400);
    assert.equal(read.settings.margin, 0);
    assert.equal(read.settings.outlineWidth, 20);
});

test("custom text of exactly the limit is text, not too much text", () => {
    const read = readAnswers(answers({ customText: "x".repeat(500) }), FONTS);

    assert.equal(read.problems, undefined);
    assert.equal(read.settings.customText.length, 500);
});
