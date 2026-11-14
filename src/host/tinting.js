"use strict";
const {
    buildSolidArgv,
    buildColorArgv,
    buildBandjoinArgv,
    buildIccArgv
} = require("../backend/coloring.js");
const { positiveHeaderField } = require("./fidelity.js");
const { succeeds } = require("./filesystem-probes.js");
const { runArgv } = require("./shell.js");

/*
 * Giving a coverage mask a color.
 *
 * A mask says how much of each pixel a glyph covers and nothing about what
 * color it is, which is what lets one drawing serve both the text and its
 * outline. Color is a solid image with the mask for its alpha: the edge of a
 * glyph keeps the softness the renderer gave it, where painting the mask
 * directly would cut it to a hard shape.
 */

function sizeOf(job, path) {
    const measure = (field) => positiveHeaderField(job, path, field, "measuring the stamp");

    return { width: measure("width"), height: measure("height") };
}

/*
 * Distinguish no profile from an unreadable profile. Failed extraction or
 * transformation leaves sRGB caption numbers and marks the result as
 * unconverted; it must not report a successful color conversion.
 */
function inSpaceOf(job, paths, profile) {
    if (profile.failed) {
        return { path: paths.color, moved: false };
    }

    if (!profile.path) {
        return { path: paths.color, moved: true };
    }

    const moved = succeeds(
        job.app,
        buildIccArgv(job.tools.vips, paths.color, paths.moved, profile.path)
    );

    return moved
        ? { path: paths.moved, moved: true }
        : { path: paths.color, moved: false };
}

function tinted(job, paths, color, drawing) {
    runArgv(
        job.app,
        buildSolidArgv(job.tools.vips, paths.solid, drawing.size),
        "coloring the stamp"
    );
    runArgv(
        job.app,
        buildColorArgv(job.tools.vips, paths.solid, paths.color, color),
        "coloring the stamp"
    );

    const read = inSpaceOf(job, paths, drawing.profile);

    runArgv(
        job.app,
        buildBandjoinArgv(job.tools.vips, read.path, paths.mask, paths.out),
        "coloring the stamp"
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
        color: `${stem}-color.v`,
        moved: `${stem}-moved.v`,
        out: `${stem}.png`
    };
}

function filesOf(paths) {
    return [paths.raw, paths.mask, paths.solid, paths.color, paths.moved, paths.out];
}

module.exports = { sizeOf, inSpaceOf, tinted, pathsFor, filesOf };
