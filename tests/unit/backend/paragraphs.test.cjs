"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { inscriptionFor } = require("../../../src/core/inscription.js");
const { buildTextArgv } = require("../../../src/backend/lettering.js");
const argument = text => buildTextArgv("vips", "out.png", text, "Helvetica, 60")[3];
function caption(customText) {
    const settings = { dateFormat: "none", coordinateFormat: "none", customText };
    const made = inscriptionFor({}, settings);
    assert.equal(settings.customText, customText);
    return { ...made, argument: argument(made.text) };
}
test("core owns a complete FSI frame on each side of Unicode paragraph separator", () => {
    const made = caption("Latin\u2029שלום, 123!");
    assert.deepEqual(made.lines, ["Latin\u2029שלום, 123!"]);
    assert.equal(made.text, "\u2068Latin\u2069\u2029\u2068שלום, 123!\u2069");
    assert.equal(made.argument, "\u200e\u2068Latin\u2069\u2029\u200e\u2068שלום, 123!\u2069");
});
test("ordinary LF lines retain their original isolated internal text", () => {
    const made = caption("Latin\nאב");
    assert.deepEqual(made.lines, ["Latin", "אב"]);
    assert.equal(made.text, "\u2068Latin\u2069\n\u2068אב\u2069");
    assert.equal(made.argument, "\u200e\u2068Latin\u2069\n\u200e\u2068אב\u2069");
});
test("line separator remains inside its existing paragraph and FSI", () => {
    const made = caption("שלום\u2028Latin");
    assert.deepEqual(made.lines, ["שלום\u2028Latin"]);
    assert.equal(made.text, "\u2068שלום\u2028Latin\u2069");
    assert.equal(made.argument, "\u200e\u2068שלום\u2028Latin\u2069");
});
for (const character of ["\u0085", "\t"]) {
    test(`nonparagraph ${JSON.stringify(character)} stays inside the existing content frame`, () => {
        const made = caption(`Latin${character}אב`);
        assert.deepEqual(made.lines, [`Latin${character}אב`]);
        assert.equal(made.text, `\u2068Latin${character}אב\u2069`);
        assert.equal(made.argument, `\u200e\u2068Latin${character}אב\u2069`);
    });
}
for (const boundary of ["\r", "\r\n"]) {
    test(`existing CR normalization remains unchanged: ${JSON.stringify(boundary)}`, () => {
        const made = caption(`Latin${boundary}אב`);
        assert.deepEqual(made.lines, ["Latin", "אב"]);
        assert.equal(made.text, "\u2068Latin\u2069\n\u2068אב\u2069");
    });
}
test("backend prefixes raw CRLF as a pair without parsing or altering content wrappers", () => {
    assert.equal(argument("\u2068Latin\u2069\r\n\u2068אב\u2069"), "\u200e\u2068Latin\u2069\r\n\u200e\u2068אב\u2069");
    assert.equal(argument("\u2068Latin\u2069\r\u2068אב\u2069"), "\u200e\u2068Latin\u2069\r\u200e\u2068אב\u2069");
});
test("date content keeps LRI while the custom paragraph keeps FSI", () => {
    const made = inscriptionFor({ DateTimeOriginal: "2024:07:15 18:42:10" }, { dateFormat: "iso-minutes", coordinateFormat: "none", customText: "שלום\u2029אב" });
    assert.deepEqual(made.lines, ["2024-07-15 18:42", "שלום\u2029אב"]);
    assert.equal(made.text, "\u20662024-07-15 18:42\u2069\n\u2068שלום\u2069\u2029\u2068אב\u2069");
});
test("markup escaping remains at the renderer boundary", () => {
    assert.equal(caption("Mum & Dad <3").argument, "\u200e\u2068Mum &amp; Dad &lt;3\u2069");
});
