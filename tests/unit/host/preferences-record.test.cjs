"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { DOMAIN, KEY, encode, rememberedAnswers } = require("../../../src/host/quick-action/preferences.js");
const { defaultSettings, defaultAnswers } = require("../../../src/host/quick-action/settings-model.js");
const fonts = ["Menlo"];
test("current preferences retain appearance and exclude private text and resolved typeface", () => {
    assert.equal(DOMAIN, "com.resoltico.StampImages"); assert.equal(KEY, "lastSettings");
    const settings = { ...defaultSettings(fonts), customText: "private", typeface: {} };
    const held = JSON.parse(encode(settings));
    assert.equal(held.customText, undefined); assert.equal(held.typeface, undefined);
    assert.deepEqual(rememberedAnswers(encode(settings), fonts), defaultAnswers(fonts));
});
test("incomplete, obsolete and malformed preferences are forgotten without migration", () => {
    const held = JSON.parse(encode(defaultSettings(fonts)));
    for (const value of [null, [], false, { ...held, weight: "bold" }, { ...held, customText: "private" }, { ...held, size: "36" }]) {
        assert.equal(rememberedAnswers(JSON.stringify(value), fonts), undefined);
    }
    assert.equal(rememberedAnswers("invalid", fonts), undefined);
    delete held.margin; assert.equal(rememberedAnswers(JSON.stringify(held), fonts), undefined);
});
test("an unavailable font name does not erase valid appearance choices", () => {
    const held = encode({ ...defaultSettings(fonts), font: "Removed Font", size: 72 });
    assert.equal(rememberedAnswers(held, fonts).size, "72");
    assert.equal(rememberedAnswers(held, fonts).font, "Removed Font");
});
