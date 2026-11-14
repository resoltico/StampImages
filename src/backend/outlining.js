"use strict";

/*
 * The exact argument vectors that give the glyphs an outline: the room it
 * needs, and the outline itself.
 *
 * Apart from lettering.js because it is a different question. That one is
 * about turning words into a picture; this is about making the picture
 * legible on whatever it lands on, which is a decision about the stamp rather
 * than about the text.
 *
 * Pure, so every flag the renderer receives is asserted by a test rather than
 * discovered on somebody's photographs. Nothing here runs anything.
 */

// Either side of the pixel itself, which is what a width means for an outline.
const BOTH_SIDES = 2;

/*
 * Embed the mask in a border before dilation. vips rank retains its input
 * dimensions, so growth without that border is clipped at the glyph edges.
 * Embed the glyph layer in the same border so both layers have matching sizes
 * and positions when composited.
 */
function buildEmbedArgv(vipsPath, around, size, border) {
    return [
        vipsPath,
        "embed",
        around.input,
        around.output,
        String(border),
        String(border),
        String(size.width + border * BOTH_SIDES),
        String(size.height + border * BOTH_SIDES),
        "--background",
        "0"
    ];
}

/*
 * The outline is the same mask grown by a few pixels: a maximum filter over a
 * square window, which is what dilation is. The window is the width either
 * side plus the pixel itself, and the index selects the largest of them.
 */
function windowFor(outlineWidth) {
    return outlineWidth * BOTH_SIDES + 1;
}

function buildDilateArgv(vipsPath, inputPath, outputPath, outlineWidth) {
    const size = windowFor(outlineWidth);

    return [
        vipsPath,
        "rank",
        inputPath,
        outputPath,
        String(size),
        String(size),
        String(size * size - 1)
    ];
}

module.exports = { buildEmbedArgv, buildDilateArgv, windowFor };
