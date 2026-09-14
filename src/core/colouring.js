"use strict";

const { rgbOf } = require("./colour.js");

/*
 * Giving a coverage mask a colour, as argument vectors.
 *
 * A solid image of the colour, with the mask for its alpha. The edge of a
 * glyph keeps the softness the renderer gave it, where painting the mask
 * directly would cut it to a hard shape.
 */

function buildSolidArgv(vipsPath, outputPath, size) {
    return [
        vipsPath,
        "black",
        outputPath,
        String(size.width),
        String(size.height),
        "--bands",
        "3"
    ];
}

/*
 * A black image plus the colour is that colour, and linear takes the two as
 * vectors so the three bands are set in one operation.
 */
function buildColourArgv(vipsPath, inputPath, outputPath, colour) {
    const { red, green, blue } = rgbOf(colour);

    return [
        vipsPath,
        "linear",
        inputPath,
        outputPath,
        "1 1 1",
        `${red} ${green} ${blue}`,
        "--uchar"
    ];
}

/*
 * The colour with the mask as its alpha.
 *
 * bandjoin takes its inputs as one space-separated argument, which is the
 * one place in this program where a path containing a space would be read as
 * two paths. The workspace is checked for that when it is made, because the
 * alternative is a failure that names a file nobody asked about.
 */
function buildBandjoinArgv(vipsPath, colourPath, maskPath, outputPath) {
    return [vipsPath, "bandjoin", `${colourPath} ${maskPath}`, outputPath];
}

/*
 * The colour, moved out of sRGB and into the space the photograph's numbers
 * are read in. Relative colorimetric because the colour asked for is a
 * colour, not a picture: what matters is that it comes out as itself, and
 * anything outside the destination's reach is brought to its nearest edge.
 */
function buildIccArgv(vipsPath, inputPath, outputPath, profilePath) {
    return [
        vipsPath,
        "icc_transform",
        inputPath,
        outputPath,
        profilePath,
        "--input-profile",
        "srgb",
        "--intent",
        "relative"
    ];
}

module.exports = {
    buildSolidArgv,
    buildColourArgv,
    buildBandjoinArgv,
    buildIccArgv
};
