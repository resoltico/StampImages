"use strict";

/*
 * The job the stamping and publication tests run against: settings that stamp
 * something in every field, and the tools in fixed places so a command can be
 * compared literally.
 */

const { UserCancelled } = require("../../../src/core/errors.js");
const { SILENT } = require("../../../src/runtime/progress.js");

const SETTINGS = Object.freeze({
    font: "Helvetica Neue",
    size: 24,
    textColour: "#FFFFFF",
    outlineColour: "#000000",
    outlineWidth: 2,
    position: "bottom-right",
    margin: 16,
    dateFormat: "iso-minutes",
    coordinateFormat: "decimal",
    // Something to stamp whatever the photograph knows about itself, so a
    // test about the batch is not also a test about metadata.
    customText: "Riga"
});

const TOOLS = Object.freeze({
    vips: "/v/vips",
    vipsheader: "/v/vipsheader",
    exiftool: "/v/exiftool"
});

function makeJob(app, settings = {}) {
    return {
        app,
        settings: { ...SETTINGS, ...settings },
        workspace: "/tmp/StampImages.X",
        stamps: new Map(),
        // How many drawings this run has made, which names their files, and
        // the colour profiles it has seen, one file each.
        drawn: 0,
        profiles: [],
        unpublished: new Set(),
        progress: SILENT,
        rename: app.renamer ?? null,
        tools: { ...TOOLS }
    };
}

/*
 * What admission hands over: the path, the name to use for the output, and
 * the folder the copy goes in -- which for a directly selected file is its own.
 */
function imageOf(path) {
    return {
        path,
        originalName: path.slice(path.lastIndexOf("/") + 1),
        folder: path.slice(0, path.lastIndexOf("/") + 1)
    };
}

/*
 * A progress object that records what it was told and can stop the run, which
 * is the contract the real one has: a report of what is about to happen may
 * raise a cancellation, and a report of what has happened may not.
 *
 * `stopAfter` counts finished photographs and `stopAt` names one line, so a
 * test can stop between photographs or in the middle of one.
 */
function reporter(stopAfter = Infinity, stopAt = null) {
    const said = [];
    let finished = 0;

    const announce = (line) => {
        said.push(line);

        if (finished >= stopAfter || line === stopAt) {
            throw new UserCancelled();
        }
    };

    return {
        said,
        stopped: () => finished >= stopAfter,
        beginning: (index, name) => announce(`beginning ${index} ${name}`),
        phase: (text) => announce(`phase ${text}`),
        finished(text) {
            finished += 1;
            said.push(`finished ${text}`);
        }
    };
}

module.exports = { SETTINGS, TOOLS, makeJob, imageOf, reporter };
