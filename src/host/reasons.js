"use strict";
const { isSupportedImage, supportedFormatList } = require("../core/formats.js");
const { isRegularFile, isDirectory } = require("./filesystem-probes.js");
const { pathCandidates } = require("./input.js");

/*
 * Why something the user asked for will not be converted.
 *
 * A rejection is a stated reason rather than the absence of an entry in a
 * list: a silent filter turned a GIF selected alongside two photos into a
 * report that nothing had failed.
 */

/*
 * Why a resolved path is not something this action can convert, or "" when it
 * is. Kept apart from the filtering so that a rejection is a stated reason
 * rather than the absence of an entry in a list.
 */
const FOLDER = "This is a folder; select the images inside it.";
const UNSUPPORTED = `This file is not a supported format; use ${supportedFormatList()}.`;
const NOT_A_FILE = "This file cannot be read; check that it still exists and that you have access.";
const NOT_A_PATH = "This is not an absolute path to a file.";

function rejectionReason(app, path) {
    // Asked first, because a folder that happens to be called album.png would
    // otherwise be turned away for having the wrong extension, and a folder
    // called album for having no extension at all. Neither says what it is.
    if (isDirectory(app, path)) {
        return FOLDER;
    }

    if (!isSupportedImage(path)) {
        return UNSUPPORTED;
    }

    return isRegularFile(app, path) ? "" : NOT_A_FILE;
}

/*
 * Both what will be converted and what was asked for and will not be.
 *
 * A silent filter is the problem here: selecting a GIF alongside two photos
 * stamped the photographs it could see and reported that nothing had
 * failed, so the
 * count described the surviving subset rather than the request. An item that
 * resolves to no path at all is host metadata — Shortcuts appends its
 * parameters to every Quick Action input — and is not a rejection, because
 * the user never asked for it.
 */
/*
 * What to say about an item that resolved to no path at all.
 *
 * Shortcuts appends its parameters object to the input of every Quick Action,
 * and that is host metadata: it has no identity of its own, and String() on it
 * says as much. Anything that did name itself and still did not resolve is
 * something the user asked for, and used to be dropped between the resolution
 * and the admission without appearing in either list.
 */
const ANONYMOUS = "[object Object]";

function describeUnresolved(item) {
    const named = pathCandidates(item)
        .find((candidate) => candidate && candidate !== ANONYMOUS);

    return named
        ? {
            path: "",
            name: named,
            reason: NOT_A_PATH,
            code: "not-a-path",
            stage: "selection"
        }
        : null;
}

module.exports = { rejectionReason, describeUnresolved, FOLDER, UNSUPPORTED, NOT_A_FILE };
