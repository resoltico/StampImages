"use strict";

/*
 * Reading a remembered record back, and every way of failing to.
 * What a run remembers of the last one, and what it makes of finding it.
 *
 * One record under one key, and nothing that comes back from it is trusted: it
 * has been on disk, where anything can edit it, so it goes through the same
 * validation as a headless configuration -- the same function, not a second
 * one that agrees with it today.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    encode,
    rememberedAnswers
} = require("../../../src/core/preferences.js");
const { defaultAnswers, defaultSettings } =
    require("../../../src/core/form-defaults.js");

const FONTS = ["Menlo", "Menlo Bold"];

function remembered(settings = {}) {
    return rememberedAnswers(
        encode({ ...defaultSettings(FONTS), ...settings }),
        FONTS
    );
}

test("the text field opens empty however the last run filled it", () => {
    assert.equal(remembered({ customText: "Riga" }).customText, "");
});

test("a record that holds text anyway is still opened blank", () => {
    // Nothing per-job is kept, so nothing per-job comes back -- and a record
    // edited by hand, or written by a version that kept it, does not get to
    // put somebody else's caption on this run's photographs.
    assert.equal(rememberedAnswers('{"customText":"Riga"}', FONTS).customText, "");
});

test("a record from a version that knew one setting fewer is still a record", () => {
    const partial = rememberedAnswers('{"size":48}', FONTS);

    assert.equal(partial.size, "48");
    assert.equal(partial.margin, defaultAnswers(FONTS).margin);
});

test("anything unreadable is no answer at all", () => {
    // Not an empty set of answers, which would be a form opening on blanks:
    // nothing at all, which is what makes the caller show its own defaults.
    for (const text of ["", "{", "null", "false", "0", "[]", '"words"', undefined]) {
        assert.equal(rememberedAnswers(text, FONTS), undefined, String(text));
    }
});

test("a record edited into something invalid is refused entirely", () => {
    for (const record of [
        '{"size":9000}',
        '{"textColour":"sky"}',
        '{"position":"middle"}',
        '{"dateFormat":"rfc822"}'
    ]) {
        assert.equal(rememberedAnswers(record, FONTS), undefined, record);
    }
});

test("a font that has gone since is not a reason to forget the rest", () => {
    // It used to be read back through the list of faces this Mac drew with
    // today, where an absent one has no label, and that raised -- which took
    // the size, the colours, the position and the margin down with it. One
    // absent typeface reset every setting somebody had chosen.
    const kept = JSON.stringify({
        ...defaultSettings(FONTS),
        font: "Zapfino",
        weight: "regular",
        size: 120,
        margin: 0
    });
    const restored = rememberedAnswers(kept, FONTS);

    assert.equal(restored.size, "120");
    assert.equal(restored.margin, "0");
    assert.equal(
        restored.font,
        "Zapfino",
        "and the typeface comes back as the name it was, for the field to hold"
    );
});

test("what is encoded can be remembered, which is the whole contract", () => {
    const settings = { ...defaultSettings(FONTS), size: 120, margin: 0 };

    assert.deepEqual(rememberedAnswers(encode(settings), FONTS), {
        ...defaultAnswers(FONTS),
        size: "120",
        margin: "0"
    });
});
