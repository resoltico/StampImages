"use strict";

/*
 * What the form opens on when there is nothing to open on, in the two shapes
 * two readers want it: answers for the controls, settings for a remembered
 * record. Both are read off the same list of rows.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    defaultAnswers,
    defaultSettings
} = require("../../../src/core/form-defaults.js");
const { ORDER } = require("../../../src/core/form-rows.js");
const { normalizeSettings } = require("../../../src/core/settings.js");
const { readAnswers } = require("../../../src/core/answers.js");

const FONTS = ["Menlo", "Menlo Bold"];

test("every row has a default, in both shapes", () => {
    const keys = ORDER.map((row) => row.key).sort();

    assert.deepEqual(Object.keys(defaultAnswers(FONTS)).sort(), keys);
    assert.deepEqual(Object.keys(defaultSettings(FONTS)).sort(), keys);
});

test("an answer is what a control shows, a setting is what is stored", () => {
    assert.equal(defaultAnswers(FONTS).dateFormat, "2026-09-09 14:30");
    assert.equal(defaultSettings(FONTS).dateFormat, "iso-minutes");
    assert.equal(defaultAnswers(FONTS).size, "36");
    assert.equal(defaultSettings(FONTS).size, 36);
});

test("the first font this Mac draws with is the one offered", () => {
    assert.equal(defaultAnswers(FONTS).font, "Menlo");
    assert.equal(defaultSettings(FONTS).font, "Menlo");
});

test("a machine with no fonts has no typeface to start from", () => {
    assert.equal(defaultAnswers([]).font, "");
    assert.equal(defaultSettings([]).font, "");
});

test("the compiled defaults are settings this program accepts", () => {
    // They are what a run opens on and what a partial remembered record is
    // filled in against, so a default that would not validate is a run that
    // cannot start.
    assert.doesNotThrow(() => normalizeSettings(defaultSettings(FONTS)));
});

test("the two shapes describe the same defaults", () => {
    // Reading the answers gives the settings: the one reader the form uses,
    // applied to what the form would be showing.
    const read = readAnswers(defaultAnswers(FONTS), FONTS);

    assert.equal(read.problems, undefined);
    assert.deepEqual(read.settings, defaultSettings(FONTS));
});

test("the stamp starts out saying something", () => {
    // A default that stamped nothing would open on a form the program
    // refuses.
    const settings = defaultSettings(FONTS);

    assert.notEqual(settings.dateFormat, "none");
    assert.notEqual(settings.coordinateFormat, "none");
});

test("the text starts white with a dark outline, because photographs vary", () => {
    assert.equal(defaultSettings(FONTS).textColour, "#FFFFFF");
    assert.equal(defaultSettings(FONTS).outlineColour, "#202020");
    assert.ok(defaultSettings(FONTS).outlineWidth > 0);
});
