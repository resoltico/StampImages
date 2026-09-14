"use strict";

/*
 * The exact argument vectors that draw the shape of the letters.
 *
 * Asserted literally, because the alternative is discovering a wrong flag on
 * somebody's photographs. Nothing here runs anything.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    buildTextArgv,
    buildEmbedArgv,
    buildDilateArgv,
    windowFor
} = require("../../../src/core/lettering.js");

const VIPS = "/v/vips";

test("text is drawn as a coverage mask at a fixed DPI", () => {
    // 72 DPI is what makes a size asked for in points come out in pixels, and
    // the size travels inside the font string because that is how pango names
    // one.
    assert.deepEqual(
        buildTextArgv(VIPS, "/w/mask.png", "Riga", "Helvetica Neue 24"),
        [
            VIPS,
            "text",
            "/w/mask.png",
            "Riga",
            "--font",
            "Helvetica Neue 24",
            "--dpi",
            "72"
        ]
    );
});

test("the text is an argument, never part of a command", () => {
    // Whatever somebody typed is passed through unchanged: quoting happens
    // once, where the command is run.
    const argv = buildTextArgv(VIPS, "/w/m.png", "'; rm -rf /\nRiga", "Menlo 12");

    assert.equal(argv[3], "'; rm -rf /\nRiga");
});

test("an outline is the mask grown by a maximum filter", () => {
    // rank over a square window, taking the largest value in it, is dilation.
    assert.deepEqual(
        buildDilateArgv(VIPS, "/w/mask.png", "/w/edge.png", 2),
        [VIPS, "rank", "/w/mask.png", "/w/edge.png", "5", "5", "24"]
    );
});

test("the window is the width either side plus the pixel itself", () => {
    assert.equal(windowFor(0), 1);
    assert.equal(windowFor(1), 3);
    assert.equal(windowFor(4), 9);
});

test("a caption is text, and reaches the renderer as itself", () => {
    // What vips reads is pango markup. Measured: "Mum & Dad" is refused
    // outright -- invalid markup, no file written, that photograph failed --
    // and "<b>x</b>" is silently drawn in bold.
    const argv = buildTextArgv(VIPS, "/w/m.png", "Mum & Dad <b>x</b>", "Menlo 24");

    assert.equal(argv[3], "Mum &amp; Dad &lt;b&gt;x&lt;/b&gt;");
});

test("a quote and an apostrophe are content, and are left alone", () => {
    // A coordinate written 56°56'58.6"N is full of them.
    const argv = buildTextArgv(VIPS, "/w/m.png", `56°56'58.6"N`, "Menlo 24");

    assert.equal(argv[3], `56°56'58.6"N`);
});

test("the mask is given the room the outline will grow into", () => {
    // vips rank keeps its input's dimensions, so growth at the edge is lost.
    assert.deepEqual(
        buildEmbedArgv(VIPS, { input: "/w/m.png", output: "/w/e.png" },
            { width: 100, height: 40 }, 3),
        [VIPS, "embed", "/w/m.png", "/w/e.png", "3", "3", "106", "46",
            "--background", "0"]
    );
});
