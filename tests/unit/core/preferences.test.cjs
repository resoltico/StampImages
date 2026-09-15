"use strict";

/*
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
    DOMAIN,
    KEY,
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

test("the domain is this action's own, and the version is in the key", () => {
    // A record this version cannot read is one it must not overwrite either,
    // and an older copy asking for a different key cannot reach a newer one's.
    assert.equal(DOMAIN, "com.resoltico.StampImages");
    assert.match(KEY, /\.v\d+$/u);
});

test("what is kept is the appearance, and what is written is not", () => {
    // The text somebody typed is about this job, and is the field most likely
    // to say something private.
    const record = JSON.parse(encode({ ...defaultSettings(FONTS), customText: "Riga" }));

    assert.equal(record.customText, undefined);
    assert.equal(record.font, "Menlo");
    assert.equal(record.textColour, "#FFFFFF");
});

test("a remembered run comes back as the answers it gave", () => {
    assert.deepEqual(
        remembered({
            font: "Menlo",
            weight: "bold",
            size: 72,
            position: "top-left"
        }),
        {
            ...defaultAnswers(FONTS),
            font: "Menlo",
            weight: "Bold",
            size: "72",
            position: "Top left"
        }
    );
});

test("what 1.0.0 stored is read as what this version means", () => {
    // The typeface used to carry the weight in its name, because the list
    // offered the two weights as separate entries. Read now as a family name,
    // "Menlo Bold" is a family nothing has -- so a record this program wrote
    // itself would be refused by the program that wrote it.
    // A 1.0.0 record, which named no weight at all.
    const kept = JSON.stringify({
        ...defaultSettings(FONTS),
        font: "Menlo Bold",
        weight: undefined,
        size: 72
    });

    assert.deepEqual(
        rememberedAnswers(kept, FONTS),
        { ...defaultAnswers(FONTS), font: "Menlo", weight: "Bold", size: "72" }
    );
});
