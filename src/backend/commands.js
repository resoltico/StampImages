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
 * Refuse decoder warnings as damage. JPEG entropy corruption can be reported
 * only as a warning while decoding still succeeds with incomplete pixels.
 * Apply the same threshold to the runtime loader and the capability probe.
 */
const DAMAGE_THRESHOLD = "warning";
const FAIL_ON_DAMAGE = `--fail-on=${DAMAGE_THRESHOLD}`;

function readingPath(sourcePath) {
    return `${sourcePath}[fail_on=${DAMAGE_THRESHOLD}]`;
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

module.exports = { FAIL_ON_DAMAGE, readingPath, buildCompositeArgv, buildOrientArgv, buildFlattenArgv };
