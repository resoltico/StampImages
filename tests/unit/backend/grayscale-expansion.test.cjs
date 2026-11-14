"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { expandedColor, isGrayImage } = require("../../../src/core/source-policy.js");
const { wantsColor } = require("../../../src/core/color.js");
const { buildCompositeArgv } = require("../../../src/backend/commands.js");
const { buildToSrgbArgv } = require("../../../src/backend/coloring.js");

for (const [settings, expected] of [
    [{ textColor: "#FFFFFF", outlineColor: "#000000", outlineWidth: 2 }, false],
    [{ textColor: "#000000", outlineColor: "#00FF00", outlineWidth: 0 }, false],
    [{ textColor: "#808080", outlineColor: "#FF0000", outlineWidth: 0 }, false],
    [{ textColor: "#808081", outlineColor: "#000000", outlineWidth: 0 }, true],
    [{ textColor: "#FFFFFF", outlineColor: "#00FF00", outlineWidth: 2 }, true],
    [{ textColor: "#FF3B30", outlineColor: "#FFFFFF", outlineWidth: 0 }, true]
]) {
    test(`existing active palette rule: ${JSON.stringify(settings)}`, () => assert.equal(wantsColor(settings), expected));
}
for (const [source, saved, expected] of [
    [{ interpretation: "b-w", bands: 1 }, { interpretation: "b-w", bands: 1 }, false],
    [{ interpretation: "grey16", bands: 2 }, { interpretation: "grey16", bands: 2 }, false],
    [{ interpretation: "b-w", bands: 1 }, { interpretation: "srgb", bands: 3 }, true],
    [{ interpretation: "grey16", bands: 2 }, { interpretation: "rgb16", bands: 4 }, true],
    [{ interpretation: "srgb", bands: 3 }, { interpretation: "srgb", bands: 3 }, false],
    [{ interpretation: "srgb", bands: 4 }, { interpretation: "rgb16", bands: 4 }, false],
    [{ interpretation: "b-w", bands: 1 }, { interpretation: "cmyk", bands: 4 }, false],
    [{ interpretation: "grey16", bands: 1 }, { interpretation: "srgb", bands: 2 }, false],
    [{ interpretation: "b-w", bands: 3 }, { interpretation: "srgb", bands: 3 }, false]
]) {
    test(`actual representation transition: ${JSON.stringify(source)} → ${JSON.stringify(saved)}`, () => assert.equal(expandedColor(source, saved), expected));
}
test("gray-alpha is gray and RGB with coincident channel values is still RGB representation", () => {
    assert.equal(isGrayImage({ interpretation: "b-w", bands: 2 }), true);
    assert.equal(isGrayImage({ interpretation: "srgb", bands: 3 }), false);
});
test("unprofiled deep gray expands to RGB16; shallow gray uses sRGB", () => {
    assert.deepEqual(buildToSrgbArgv("vips", "in", "out", { profilePath: "", interpretation: "grey16" }), ["vips", "colourspace", "in", "out", "rgb16"]);
    assert.deepEqual(buildToSrgbArgv("vips", "in", "out", { profilePath: "", interpretation: "b-w" }), ["vips", "colourspace", "in", "out", "srgb"]);
});
test("healthy ICC route remains the existing native transform", () => {
    assert.deepEqual(buildToSrgbArgv("vips", "in", "out", { profilePath: "gray.icc", interpretation: "grey16" }), ["vips", "icc_transform", "in", "out", "srgb", "--input-profile", "gray.icc", "--intent", "relative"]);
});
test("final photograph composition can name its gray working space without changing layer compositions", () => {
    assert.deepEqual(buildCompositeArgv("vips", { base: "photo", overlay: "stamp", compositingSpace: "grey16" }, "out", { left: 10, top: 20 }), ["vips", "composite2", "photo", "stamp", "out", "over", "--x", "10", "--y", "20", "--compositing-space", "grey16"]);
    assert.deepEqual(buildCompositeArgv("vips", { base: "edge", overlay: "glyph" }, "stamp"), ["vips", "composite2", "edge", "glyph", "stamp", "over"]);
});

test("conversion refuses an obsolete scalar profile argument or unsupported source shape", () => {
    assert.throws(() => buildToSrgbArgv("vips", "in", "out", "gray.icc"), /gray source interpretation/u);
    assert.throws(() => buildToSrgbArgv("vips", "in", "out", { profilePath: "", interpretation: "srgb" }), /gray source interpretation/u);
    assert.throws(() => buildToSrgbArgv("vips", "in", "out", null), /gray source interpretation/u);
});


test("unknown prototype-like interpretations are unsupported facts, not inherited color models", () => {
    for (const interpretation of ["constructor", "__proto__", "toString"]) {
        assert.equal(expandedColor({ interpretation: "b-w", bands: 1 }, { interpretation, bands: 3 }), false);
    }
});
