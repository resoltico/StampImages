"use strict";

/*
 * The exact argument vectors for what is done to a photograph: putting the
 * stamp on it, applying its orientation, and saving it as the kind of file it
 * was.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    buildCompositeArgv,
    readingPath,
    buildOrientArgv,
    buildFlattenArgv
} = require("../../../src/core/commands.js");

const VIPS = "/v/vips";

test("compositing without a position puts the overlay at the origin", () => {
    assert.deepEqual(
        buildCompositeArgv(VIPS, { base: "/w/a.v", overlay: "/w/b.png" }, "/w/o.v"),
        [VIPS, "composite2", "/w/a.v", "/w/b.png", "/w/o.v", "over"]
    );
});

test("a position is two more arguments, and they are numbers", () => {
    assert.deepEqual(
        buildCompositeArgv(
            VIPS,
            { base: "/w/a.v", overlay: "/w/b.png" },
            "/w/o.v",
            { left: 780, top: 680 }
        ),
        [
            VIPS,
            "composite2",
            "/w/a.v",
            "/w/b.png",
            "/w/o.v",
            "over",
            "--x",
            "780",
            "--y",
            "680"
        ]
    );
});

test("a position at the origin is still a position", () => {
    // { left: 0, top: 0 } is what a stamp larger than its photograph gets,
    // and an object is truthy, so it must not read as "no position given".
    const argv = buildCompositeArgv(
        VIPS,
        { base: "/w/a.v", overlay: "/w/b.png" },
        "/w/o.v",
        { left: 0, top: 0 }
    );

    assert.deepEqual(argv.slice(-4), ["--x", "0", "--y", "0"]);
});

test("orientation is applied rather than carried", () => {
    assert.deepEqual(
        buildOrientArgv(VIPS, "/a/p.jpg", "/w/oriented.v"),
        [VIPS, "autorot", "/a/p.jpg[fail_on=error]", "/w/oriented.v"]
    );
});

test("the one stage that reads the photograph refuses a damaged one", () => {
    // Measured on vips 8.18.6: a JPEG or a PNG cut off inside its image data
    // is salvaged into a partial picture and vips exits zero, and every check
    // after this one passes -- so half a photograph used to get a name.
    //
    // On the path rather than as a flag, because autorot is not a load
    // operation and has none: vips reads a loader's settings off the end of
    // the path it is given, as it reads an encoder's off the path it writes.
    assert.equal(readingPath("/a/p.jpg"), "/a/p.jpg[fail_on=error]");

    // A photograph whose own name ends in brackets is still read as itself:
    // vips tries the whole string as a filename before it splits the trailing
    // group off. Measured, not assumed.
    assert.equal(readingPath("/a/p[1].jpg"), "/a/p[1].jpg[fail_on=error]");
});

test("an alpha band a format cannot hold is flattened onto white", () => {
    assert.deepEqual(
        buildFlattenArgv(VIPS, "/w/stamped.v", "/w/staged.jpg"),
        [VIPS, "flatten", "/w/stamped.v", "/w/staged.jpg", "--background=255,255,255"]
    );
});
