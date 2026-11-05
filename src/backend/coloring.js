"use strict";

const { rgbOf } = require("../core/color.js");

/*
 * Giving a coverage mask a color, as argument vectors.
 *
 * A solid image of the color, with the mask for its alpha. The edge of a
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
 * A black image plus the color is that color, and linear takes the two as
 * vectors so the three bands are set in one operation.
 */
function buildColorArgv(vipsPath, inputPath, outputPath, color) {
    const { red, green, blue } = rgbOf(color);

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
 * The color with the mask as its alpha.
 *
 * bandjoin takes its inputs as one space-separated argument, which is the
 * one place in this program where a path containing a space would be read as
 * two paths. The workspace is checked for that when it is made, because the
 * alternative is a failure that names a file nobody asked about.
 */
function buildBandjoinArgv(vipsPath, colorPath, maskPath, outputPath) {
    return [vipsPath, "bandjoin", `${colorPath} ${maskPath}`, outputPath];
}

/*
 * The color, moved out of sRGB and into the space the photograph's numbers
 * are read in. Relative colorimetric because the color asked for is a
 * color, not a picture: what matters is that it comes out as itself, and
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

/*
 * A gray photograph, read into sRGB.
 *
 * Through its own profile when it has one, so the grays keep their meaning --
 * measured, a value of 200 comes back 200, 200, 200. Without a profile there
 * is nothing to read it through and the numbers are already what they are.
 */
function buildToSrgbArgv(vipsPath, inputPath, outputPath, profilePath) {
    return profilePath
        ? [
            vipsPath,
            "icc_transform",
            inputPath,
            outputPath,
            "srgb",
            "--input-profile",
            profilePath,
            "--intent",
            "relative"
        ]
        : [vipsPath, "colourspace", inputPath, outputPath, "srgb"];
}

module.exports = {
    buildToSrgbArgv,
    buildSolidArgv,
    buildColorArgv,
    buildBandjoinArgv,
    buildIccArgv
};
