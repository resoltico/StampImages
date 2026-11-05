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
 * Room for the outline to grow into.
 *
 * vips rank keeps its input's dimensions -- documented, and measured: a mask
 * dilated by four pixels came back the same size with the growth cut off at
 * every edge, so every stamp this program drew had its outline shaved flat
 * against the glyphs. The mask is embedded in a border first, and the border
 * is what the outline grows into.
 *
 * The glyphs are embedded in the same border rather than only the copy that
 * is dilated, because the two are composited on top of each other and two
 * images of different sizes do not line up.
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
