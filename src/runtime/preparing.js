"use strict";

const { buildOrientArgv } = require("../core/commands.js");
const { buildToSrgbArgv } = require("../core/colouring.js");
const { wantsColour } = require("../core/colour.js");
const { runArgv } = require("./shell.js");
const { verifyFileWritten } = require("./asking.js");
const { sizeOf } = require("./tinting.js");
const { refuseUnfaithful, hasAlpha, bandsOf } = require("./fidelity.js");
const { profileFor } = require("./colour-space.js");

/*
 * What a photograph has to be before a stamp can go on it.
 *
 * Two things, and the second only sometimes: turned the way it is meant to be
 * seen, and in a colour space that can hold the caption's colour. Putting the
 * stamp on it and saving the result is image.js.
 */

// A photograph that stores only greys, with or without an alpha band.
const GREY_BANDS = 2;

/*
 * Orientation is applied rather than carried. A photograph whose tag says to
 * rotate it is shown rotated by everything that displays it, so a stamp
 * composited before that happens would sit along an edge the viewer never
 * sees as the bottom.
 */
function orient(job, source, token) {
    const oriented = `${job.workspace}/oriented-${token}.v`;

    runArgv(
        job.app,
        buildOrientArgv(job.tools.vips, source, oriented),
        "reading the photograph"
    );
    verifyFileWritten(job.app, oriented, "the photograph");

    return oriented;
}

/*
 * A grey photograph, read into sRGB so a colour can be painted on it.
 *
 * The stamp's colour is moved into the photograph's own space before it is
 * painted, and a grey space cannot hold a colour: measured, #FF3B30 moved into
 * a grey profile is one band with the value 138, and the caption came out grey
 * with the run reporting that the colour had been handled. A photograph that
 * stores only greys and a caption that is not grey cannot meet in the
 * photograph's space, so they meet in sRGB instead -- the picture unchanged,
 * a value of 200 read back as 200, 200, 200, and the colour that was chosen.
 *
 * Only when the colour actually needs it. White, black and the default
 * outline are greys, so the ordinary run over a grey photograph is untouched
 * and the copy stays as grey as the photograph was.
 */
function inColour(job, oriented, profile, token) {
    const expanded = `${job.workspace}/colour-${token}.v`;

    runArgv(
        job.app,
        buildToSrgbArgv(job.tools.vips, oriented, expanded, profile),
        "reading the photograph"
    );
    verifyFileWritten(job.app, expanded, "the photograph");

    return expanded;
}

function readPhotograph(job, source, token) {
    // Asked of the file, before it is decoded: a photograph this cannot copy
    // faithfully should cost two header reads and nothing else.
    refuseUnfaithful(job, source);

    const path = orient(job, source, token);

    return { path, size: sizeOf(job, path), hasAlpha: hasAlpha(job, path) };
}

/*
 * The photograph and the stamp have to meet in one space, and it has to be a
 * space that can hold the colour. A photograph storing only greys cannot, so
 * it is read into sRGB and the stamp stays there with it -- which is the whole
 * of what the profile is for, so the profile goes with it.
 */
function meeting(job, photograph, profile, token) {
    if (bandsOf(job, photograph.path) > GREY_BANDS || !wantsColour(job.settings)) {
        return { photograph, profile, expanded: false };
    }

    return {
        photograph: { ...photograph, path: inColour(job, photograph.path, profile.path, token) },
        profile: { path: "", failed: profile.failed },
        expanded: true
    };
}

/*
 * Everything the photograph has to be, in order, with each stage this
 * photograph's to clear away -- the expansion included.
 */
function prepared(job, image, token, intermediates) {
    const read = readPhotograph(job, image.path, token);

    intermediates.push(read.path);

    const met = meeting(job, read, profileFor(job, image.path, token), token);

    // Only when there is a second file: unexpanded, the meeting hands back the
    // photograph it was given, and a list holding it twice removes it twice.
    if (met.expanded) {
        intermediates.push(met.photograph.path);
    }

    return met;
}

module.exports = { readPhotograph, inColour, meeting, prepared };
