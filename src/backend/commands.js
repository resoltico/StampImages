"use strict";

/*
 * The exact argument vectors that tell vips what to do with a photograph.
 *
 * Pure, so every flag the tools receive is asserted by a test rather than
 * discovered on somebody's photographs. Nothing here runs anything. What the
 * stamp is drawn with is lettering.js, and what is asked of the tools rather
 * than told to them is queries.js.
 */

function buildCompositeArgv(vipsPath, over, outputPath, at) {
    const argv = [
        vipsPath,
        "composite2",
        over.base,
        over.overlay,
        outputPath,
        "over"
    ];

    return at
        ? [...argv, "--x", String(at.left), "--y", String(at.top)]
        : argv;
}

/*
 * The photograph, and the policy this reads it under.
 *
 * This is the one stage that decodes the file that was selected, and it is
 * where this program stops taking a tool's exit status as evidence of what it
 * was asked to do. libvips is permissive by default: measured on 8.18.6, a
 * JPEG or a PNG cut off inside its image data is salvaged into a partial
 * picture and vips exits zero. Every check after this one then passes -- the
 * copy exists, it is an image, it is the size the photograph said it was --
 * so half a photograph gets a name and a place in somebody's folder.
 *
 * `error` is the level that covers truncation and serious decoding errors.
 * `warning` would also refuse files that merely have a quirk, which is a
 * different decision about what counts as a photograph.
 *
 * It rides on the path because autorot is not a load operation and has no
 * flag of its own: vips reads a loader's settings off the end of the path it
 * is given, exactly as it reads an encoder's off the end of the path it is
 * told to write. Measured: vips tries the whole string as a filename before
 * it splits the trailing group off, so a photograph whose own name ends in
 * brackets is still read as itself.
 */
const FAIL_ON_DAMAGE = "[fail_on=error]";

function readingPath(sourcePath) {
    return `${sourcePath}${FAIL_ON_DAMAGE}`;
}

/*
 * Orientation is applied rather than carried: the stamp is composited in
 * pixel coordinates, so a photograph whose tag says "rotate 90" would be
 * stamped along an edge that is not the one the viewer sees.
 */
function buildOrientArgv(vipsPath, inputPath, outputPath) {
    return [vipsPath, "autorot", readingPath(inputPath), outputPath];
}

/*
 * Compositing adds an alpha band. Formats that cannot hold one save it as
 * something else or refuse, so it is flattened onto white before saving --
 * which changes nothing, since every pixel of a photograph is opaque.
 */
function buildFlattenArgv(vipsPath, inputPath, outputPath) {
    return [vipsPath, "flatten", inputPath, outputPath, "--background=255,255,255"];
}

module.exports = {
    FAIL_ON_DAMAGE,
    readingPath,
    buildCompositeArgv,
    buildOrientArgv,
    buildFlattenArgv
};
