"use strict";
const { removeOwned } = require("./owned-cleanup.js");
const { buildOrientArgv } = require("../backend/commands.js");
const { buildToSrgbArgv } = require("../backend/coloring.js");
const { wantsColor } = require("../core/color.js");
const { runArgv } = require("./shell.js");
const { verifyFileWritten } = require("./filesystem-probes.js");
const { sizeOf } = require("./tinting.js");
const { refuseUnfaithful, hasAlpha, bandsOf } = require("./fidelity.js");
const { profileFor } = require("./color-space.js");
const { OperationError, errorMessage, commandOf } = require("../core/errors.js");
const { sourceIssue } = require("../core/source-policy.js");

/*
 * A photograph whose header passed inspection can still be cut short: the
 * header of a truncated JPEG is intact and only decoding finds the end
 * missing. That is a fact about the file, refused in the same words
 * inspection uses, rather than the decoder's own output. Only a loader's
 * complaint means this; any other failure keeps its own description.
 */
const LOADER_FAILURE = /\b(?:jpeg|png|heif|tiff|webp|vips)load\b|VipsForeignLoad/u;

function damagedOr(error) {
    if (!(error instanceof OperationError) || !LOADER_FAILURE.test(errorMessage(error))) { return error; }
    const issue = sourceIssue("damaged", {}, { command: commandOf(error), message: errorMessage(error) });
    return new OperationError(issue.message, { cause: error, issues: [{ ...issue, stage: "stamping" }] });
}

/*
 * What a photograph has to be before a stamp can go on it.
 *
 * Two things, and the second only sometimes: turned the way it is meant to be
 * seen, and in a color space that can hold the caption's color. Putting the
 * stamp on it and saving the result is image.js.
 */

// A photograph that stores only grays, with or without an alpha band.
const GRAY_BANDS = 2;

/*
 * Orientation is applied rather than carried. A photograph whose tag says to
 * rotate it is shown rotated by everything that displays it, so a stamp
 * composited before that happens would sit along an edge the viewer never
 * sees as the bottom.
 */
function orient(job, source, oriented) {
    runArgv(
        job.app,
        buildOrientArgv(job.tools.vips, source, oriented),
        "reading the image"
    );
    verifyFileWritten(job.app, oriented, "the image");

}

/*
 * Expand a gray photograph into sRGB only when the caption requires color.
 * Converting chromatic stamp values into a gray profile would erase that color:
 * measured, #FF3B30 becomes one gray band with value 138. Expanding the picture
 * instead preserves gray pixel values, such as 200 becoming 200, 200, 200, while
 * allowing the chosen caption color. Gray captions need no expansion.
 */
function inColor(job, oriented, profile, token) {
    const expanded = `${job.workspace}/color-${token}.v`;

    runArgv(
        job.app,
        buildToSrgbArgv(job.tools.vips, oriented, expanded, profile),
        "reading the image"
    );
    verifyFileWritten(job.app, expanded, "the image");

    return expanded;
}

function readPhotograph(job, source, token) {
    // Asked of the file, before it is decoded: a photograph this cannot copy
    // faithfully should cost two header reads and nothing else.
    refuseUnfaithful(job, source);

    const path = `${job.workspace}/oriented-${token}.v`;

    try {
        try { orient(job, source, path); }
        catch (error) { throw damagedOr(error); }

        return { path, size: sizeOf(job, path), hasAlpha: hasAlpha(job, path) };
    } catch (error) {
        removeOwned(job, path);
        throw error;
    }
}

/*
 * The photograph and the stamp have to meet in one space, and it has to be a
 * space that can hold the color. A photograph storing only grays cannot, so
 * it is read into sRGB and the stamp stays there with it -- which is the whole
 * of what the profile is for, so the profile goes with it.
 */
function prepareColorSpace(job, photograph, profile, token) {
    if (bandsOf(job, photograph.path) > GRAY_BANDS || !wantsColor(job.settings)) {
        return { photograph, profile, expanded: false };
    }

    return {
        photograph: { ...photograph, path: inColor(job, photograph.path, profile.path, token) },
        profile: { path: "", failed: profile.failed },
        expanded: true
    };
}

/*
 * Everything the photograph has to be, in order, with each stage this
 * photograph's to clear away -- the expansion included.
 */
function preparePhotograph(job, image, token, intermediates) {
    const read = readPhotograph(job, image.path, token);

    intermediates.push(read.path);

    const met = prepareColorSpace(job, read, profileFor(job, image.path, token), token);

    // Only when there is a second file: unexpanded, color preparation hands back the
    // photograph it was given, and a list holding it twice removes it twice.
    if (met.expanded) {
        intermediates.push(met.photograph.path);
    }

    return met;
}

module.exports = { readPhotograph, prepareColorSpace, preparePhotograph };
