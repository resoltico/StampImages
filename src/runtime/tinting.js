"use strict";

const {
    buildSolidArgv,
    buildColourArgv,
    buildBandjoinArgv,
    buildIccArgv
} = require("../core/colouring.js");
const { buildSizeArgv } = require("../core/queries.js");
const { succeeds } = require("./asking.js");
const { runArgv } = require("./shell.js");

/*
 * Giving a coverage mask a colour.
 *
 * A mask says how much of each pixel a glyph covers and nothing about what
 * colour it is, which is what lets one drawing serve both the text and its
 * outline. Colour is a solid image with the mask for its alpha: the edge of a
 * glyph keeps the softness the renderer gave it, where painting the mask
 * directly would cut it to a hard shape.
 */

function sizeOf(job, path) {
    const measure = (field) => Number(runArgv(
        job.app,
        buildSizeArgv(job.tools.vipsheader, path, field),
        "measuring the stamp"
    ));

    return { width: measure("width"), height: measure("height") };
}

/*
 * The colour as the photograph will read it.
 *
 * Three cases, because a profile that could not be read is not a photograph
 * without one: that used to take the no-profile path, which reports the colour
 * as handled, so an extraction that failed was a stamp in unconverted numbers
 * and a run that said everything went well. A transform that fails leaves the
 * sRGB numbers too, and either way the run counts it.
 */
function inSpaceOf(job, paths, profile) {
    if (profile.failed) {
        return { path: paths.colour, moved: false };
    }

    if (!profile.path) {
        return { path: paths.colour, moved: true };
    }

    const moved = succeeds(
        job.app,
        buildIccArgv(job.tools.vips, paths.colour, paths.moved, profile.path)
    );

    return moved
        ? { path: paths.moved, moved: true }
        : { path: paths.colour, moved: false };
}

function tinted(job, paths, colour, drawing) {
    runArgv(
        job.app,
        buildSolidArgv(job.tools.vips, paths.solid, drawing.size),
        "colouring the stamp"
    );
    runArgv(
        job.app,
        buildColourArgv(job.tools.vips, paths.solid, paths.colour, colour),
        "colouring the stamp"
    );

    const read = inSpaceOf(job, paths, drawing.profile);

    runArgv(
        job.app,
        buildBandjoinArgv(job.tools.vips, read.path, paths.mask, paths.out),
        "colouring the stamp"
    );

    return { path: paths.out, moved: read.moved };
}

/*
 * The files one layer of one stamp is made of. Every one of them is this
 * drawing's own, so the whole set can be cleared away once the stamp is
 * assembled -- which matters because a batch of photographs taken over an
 * hour has a distinct stamp for nearly every one of them.
 */
function pathsFor(workspace, token, stage) {
    const stem = `${workspace}/stamp-${token}-${stage}`;

    return {
        raw: `${stem}-raw.png`,
        mask: `${stem}-mask.png`,
        solid: `${stem}-solid.v`,
        colour: `${stem}-colour.v`,
        moved: `${stem}-moved.v`,
        out: `${stem}.png`
    };
}

function filesOf(paths) {
    return [paths.raw, paths.mask, paths.solid, paths.colour, paths.moved, paths.out];
}

module.exports = { sizeOf, inSpaceOf, tinted, pathsFor, filesOf };
