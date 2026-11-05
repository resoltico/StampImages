"use strict";

/*
 * Giving a coverage mask a color: a solid image of that color, with the mask
 * for its alpha. The mask says how much of each pixel a glyph covers, so the
 * softness the renderer gave an edge survives being colored.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    buildSolidArgv,
    buildColorArgv,
    buildBandjoinArgv,
    buildIccArgv
} = require("../../../src/backend/coloring.js");

const VIPS = "/v/vips";

test("the solid is the size of the drawing, in three bands", () => {
    assert.deepEqual(
        buildSolidArgv(VIPS, "/w/solid.v", { width: 120, height: 40 }),
        [VIPS, "black", "/w/solid.v", "120", "40", "--bands", "3"]
    );
});

test("black plus the color is the color, set in one operation", () => {
    assert.deepEqual(
        buildColorArgv(VIPS, "/w/solid.v", "/w/color.v", "#FF8000"),
        [VIPS, "linear", "/w/solid.v", "/w/color.v", "1 1 1", "255 128 0", "--uchar"]
    );
});

test("white and black are written as vectors like any other color", () => {
    assert.equal(
        buildColorArgv(VIPS, "/w/s.v", "/w/c.v", "#FFFFFF")[5],
        "255 255 255"
    );
    assert.equal(
        buildColorArgv(VIPS, "/w/s.v", "/w/c.v", "#000000")[5],
        "0 0 0"
    );
});

test("bandjoin takes its two inputs as one argument", () => {
    // Which is the one place a path with a space in it would be read as two
    // paths; the workspace is refused if it has one.
    assert.deepEqual(
        buildBandjoinArgv(VIPS, "/w/color.v", "/w/mask.png", "/w/out.png"),
        [VIPS, "bandjoin", "/w/color.v /w/mask.png", "/w/out.png"]
    );
});

test("the color is moved into the space the photograph is read in", () => {
    // Relative colorimetric because the color asked for is a color, not a
    // picture: what matters is that it comes out as itself.
    assert.deepEqual(
        buildIccArgv(VIPS, "/w/color.v", "/w/moved.v", "/w/profile-1-a.icc"),
        [
            VIPS,
            "icc_transform",
            "/w/color.v",
            "/w/moved.v",
            "/w/profile-1-a.icc",
            "--input-profile",
            "srgb",
            "--intent",
            "relative"
        ]
    );
});

test("gray promotion uses explicit sRGB or relative ICC conversion argv", () => {
    const { buildToSrgbArgv } = require("../../../src/backend/coloring.js");
    assert.deepEqual(buildToSrgbArgv("vips", "in.v", "out.v", ""), ["vips", "colourspace", "in.v", "out.v", "srgb"]);
    assert.deepEqual(buildToSrgbArgv("vips", "in.v", "out.v", "gray.icc"), ["vips", "icc_transform", "in.v", "out.v", "srgb", "--input-profile", "gray.icc", "--intent", "relative"]);
});
