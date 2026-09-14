"use strict";

/*
 * Giving a coverage mask a colour: a solid image of that colour, with the mask
 * for its alpha. The mask says how much of each pixel a glyph covers, so the
 * softness the renderer gave an edge survives being coloured.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    buildSolidArgv,
    buildColourArgv,
    buildBandjoinArgv,
    buildIccArgv
} = require("../../../src/core/colouring.js");

const VIPS = "/v/vips";

test("the solid is the size of the drawing, in three bands", () => {
    assert.deepEqual(
        buildSolidArgv(VIPS, "/w/solid.v", { width: 120, height: 40 }),
        [VIPS, "black", "/w/solid.v", "120", "40", "--bands", "3"]
    );
});

test("black plus the colour is the colour, set in one operation", () => {
    assert.deepEqual(
        buildColourArgv(VIPS, "/w/solid.v", "/w/colour.v", "#FF8000"),
        [VIPS, "linear", "/w/solid.v", "/w/colour.v", "1 1 1", "255 128 0", "--uchar"]
    );
});

test("white and black are written as vectors like any other colour", () => {
    assert.equal(
        buildColourArgv(VIPS, "/w/s.v", "/w/c.v", "#FFFFFF")[5],
        "255 255 255"
    );
    assert.equal(
        buildColourArgv(VIPS, "/w/s.v", "/w/c.v", "#000000")[5],
        "0 0 0"
    );
});

test("bandjoin takes its two inputs as one argument", () => {
    // Which is the one place a path with a space in it would be read as two
    // paths; the workspace is refused if it has one.
    assert.deepEqual(
        buildBandjoinArgv(VIPS, "/w/colour.v", "/w/mask.png", "/w/out.png"),
        [VIPS, "bandjoin", "/w/colour.v /w/mask.png", "/w/out.png"]
    );
});

test("the colour is moved into the space the photograph is read in", () => {
    // Relative colorimetric because the colour asked for is a colour, not a
    // picture: what matters is that it comes out as itself.
    assert.deepEqual(
        buildIccArgv(VIPS, "/w/colour.v", "/w/moved.v", "/w/profile-1-a.icc"),
        [
            VIPS,
            "icc_transform",
            "/w/colour.v",
            "/w/moved.v",
            "/w/profile-1-a.icc",
            "--input-profile",
            "srgb",
            "--intent",
            "relative"
        ]
    );
});
