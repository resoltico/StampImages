"use strict";

const {
    buildTextArgv,
    buildEmbedArgv,
    buildDilateArgv
} = require("../core/lettering.js");
const { runArgv } = require("./shell.js");
const { verifyFileWritten } = require("./asking.js");
const { sizeOf, tinted, pathsFor, filesOf } = require("./tinting.js");

/*
 * The two drawings a stamp is made of: the glyphs, and the same glyphs grown
 * outwards underneath them.
 *
 * Both come from one mask of one size. That is the whole reason this is a
 * module rather than three lines: vips rank keeps its input's dimensions, so
 * the mask has to be given a border before it is grown, and the glyph layer
 * has to be given the same border or the two do not line up when they are
 * composited.
 */

/*
 * The glyphs, and the room the outline will need.
 *
 * Both layers are made from one mask of one size. vips rank keeps its input's
 * dimensions, so a mask dilated without a border loses the growth at every
 * edge -- and growing only the copy that is dilated would leave two images
 * that do not line up when they are composited.
 */
function drawMask(job, face, text) {
    const { settings, tools } = job;
    const border = settings.outlineWidth;

    runArgv(
        job.app,
        buildTextArgv(tools.vips, face.raw, text, `${settings.font} ${settings.size}`),
        "drawing the stamp"
    );
    verifyFileWritten(job.app, face.raw, "the drawn text");

    const drawn = sizeOf(job, face.raw);

    if (border === 0) {
        return { mask: face.raw, size: drawn };
    }

    runArgv(
        job.app,
        buildEmbedArgv(tools.vips, { input: face.raw, output: face.mask }, drawn, border),
        "drawing the stamp"
    );

    return { mask: face.mask, size: sizeOf(job, face.mask) };
}

function drawOutline(job, token, drawing) {
    const edge = pathsFor(job.workspace, token, "edge");

    runArgv(
        job.app,
        buildDilateArgv(
            job.tools.vips,
            drawing.mask,
            edge.mask,
            job.settings.outlineWidth
        ),
        "drawing the outline"
    );

    return { paths: edge, ...tinted(job, edge, job.settings.outlineColour, drawing) };
}

/*
 * An outline of nothing is not drawn at all rather than drawn as a
 * zero-pixel dilation, which is a copy and a composite for no visible
 * difference.
 */
function drawLayers(job, token, drawn) {
    const face = pathsFor(job.workspace, token, "face");
    const drawing = { ...drawMask(job, face, drawn.text), profile: drawn.profile };
    const glyphs = tinted(
        job,
        { ...face, mask: drawing.mask },
        job.settings.textColour,
        drawing
    );

    if (job.settings.outlineWidth === 0) {
        return {
            glyphs: glyphs.path,
            outline: "",
            moved: glyphs.moved,
            size: drawing.size,
            spent: filesOf(face)
        };
    }

    const outline = drawOutline(job, token, drawing);

    return {
        glyphs: glyphs.path,
        outline: outline.path,
        moved: glyphs.moved && outline.moved,
        size: drawing.size,
        spent: [...filesOf(face), ...filesOf(outline.paths)]
    };
}

module.exports = { drawLayers };
