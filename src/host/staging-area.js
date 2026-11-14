"use strict";
const { MKDIR, RMDIR } = require("../core/executables.js");
const { dirname } = require("../core/paths.js");
const { runArgv, cleanupArgv, removeFile } = require("./shell.js");
const { nonce } = require("./workspace.js");

/*
 * Create a hidden directory beside the destination for cross-volume staging.
 * mkdir claims the name exclusively and fails for an existing file, directory,
 * link or pipe, so cleanup can rely on ownership of this attempt's contents.
 *
 * Shell noclobber redirection is insufficient: it can follow a link to a
 * non-regular target such as /dev/null, and opening a named pipe can wait for
 * a reader. Neither establishes an exclusively owned staging entry.
 */

const { splitExtension } = require("../core/naming.js");

function stagingArea(finalPath) {
    const directory = `${dirname(finalPath)}.StampImages-${nonce()}`;

    return { directory, file: `${directory}/ready${splitExtension(finalPath).extension}` };
}

function openStaging(app, area) {
    runArgv(
        app,
        [MKDIR, area.directory],
        "making a place for the image in the output folder"
    );
}

/*
 * Whatever this run put in there, and then the directory itself. rmdir
 * removes an empty directory and refuses one that is not, so a directory
 * something else has written into is left alone rather than emptied.
 */
function closeStaging(app, area) {
    const outcomes = [removeFile(app, area.file), cleanupArgv(app, [RMDIR, area.directory])];
    return outcomes.filter((outcome) => outcome.state === "failed").map((outcome) => outcome.issue);
}

module.exports = { stagingArea, openStaging, closeStaging };
