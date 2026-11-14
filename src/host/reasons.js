"use strict";
const { isSupportedImage, supportedFormatList } = require("../core/formats.js");
const { isRegularFile, isDirectory } = require("./filesystem-probes.js");
const { isRemoteUrl } = require("./invocation-syntax.js");
const { pathCandidates } = require("./input.js");

/*
 * Every requested item that cannot be stamped needs a stated reason. A silent
 * filter could omit a selected GIF while reporting that no requested work failed.
 */

/*
 * Why a resolved path is not something this action can convert, or "" when it
 * is. Kept apart from the filtering so that a rejection is a stated reason
 * rather than the absence of an entry in a list.
 */
const FOLDER = "This is a folder; select the images inside it.";
const UNSUPPORTED = `This file is not a supported format; use ${supportedFormatList()}.`;
const NOT_A_FILE = "This file cannot be read; check that it still exists and that you have access.";
const NOT_A_PATH = "No file or folder exists at this path.";
const REMOTE_URL = "Remote URLs are not supported; download the file first.";

function rejectionReason(app, path) {
    // Asked first, because a folder that happens to be called album.png would
    // otherwise be turned away for having the wrong extension, and a folder
    // called album for having no extension at all. Neither says what it is.
    if (isDirectory(app, path)) {
        return FOLDER;
    }

    if (!isRegularFile(app, path)) { return NOT_A_FILE; }
    return isSupportedImage(path) ? "" : UNSUPPORTED;
}

/*
 * Keep both admitted items and requested items that cannot be stamped.
 * Unresolved Shortcuts parameter objects are host metadata, not user requests,
 * and do not become rejections.
 */
/*
 * An unresolved item with a name is still a request and needs a rejection.
 * The unnamed parameters object appended by Shortcuts is host metadata.
 */
const ANONYMOUS = "[object Object]";

function describeUnresolved(item) {
    const named = pathCandidates(item)
        .find((candidate) => candidate && candidate !== ANONYMOUS);

    if (!named) { return null; }
    const remote = isRemoteUrl(named);
    return {
        path: "",
        name: named,
        reason: remote ? REMOTE_URL : NOT_A_PATH,
        code: remote ? "remote-url" : "not-a-path",
        stage: "selection"
    };
}

module.exports = { rejectionReason, describeUnresolved, FOLDER, UNSUPPORTED, NOT_A_FILE, NOT_A_PATH, REMOTE_URL };
