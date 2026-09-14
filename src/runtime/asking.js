"use strict";

const { TEST, CMP } = require("../core/executables.js");
const { shellJoin } = require("../core/shell.js");
const { isUserCancelled } = require("../core/errors.js");

/*
 * Questions put to the filesystem, answered by whether a command succeeded.
 *
 * These do not go through runArgv, and that is the point of keeping them
 * apart: runArgv builds a described Error with a summarised command for
 * anything that fails, which is right for a command that was meant to do
 * something and wrong for one that was only ever a question. A test that
 * fails has answered.
 *
 * What a caller must not do is read a "no" as a fact about the file. Every
 * answer here is really "the test succeeded", and a test that could not be
 * run at all says no in the same words. Nothing may be deleted or given up
 * on the strength of one.
 *
 * There is one failure this can tell apart, and one place it is safe to let
 * out. A cancellation is not an answer about a file: reported as one it
 * became "the stamped photograph is not a file with anything in it", which is
 * a wrong diagnosis rather than a late stop. Every other question here is put
 * somewhere a raise would cost something -- a staging place left in somebody's
 * folder, a finished copy nobody is told the whereabouts of, a name chosen
 * after the copy exists -- and those swallow it as before. What it costs, said
 * plainly: a stop landing exactly on one of those sub-millisecond tests is not
 * noticed. vips takes seconds and is where somebody actually asks.
 */

function succeeds(app, argumentsList) {
    try {
        app.doShellScript(shellJoin(argumentsList));

        return true;
    } catch {
        return false;
    }
}

function asks(app, argumentsList) {
    return succeeds(app, [TEST, ...argumentsList]);
}

function testPath(app, flag, target) {
    return asks(app, [flag, target]);
}

/*
 * Whether there is any directory entry at this path -- which is the question
 * an output name poses, and not the one -e answers.
 *
 * -e follows a symbolic link and reports on its target, so a link whose
 * target is gone reads as nothing at all. Something is still there: measured,
 * mv replaces such a link without complaint while ln refuses the name. -L
 * asks about the entry itself, and the two together cover files, folders and
 * links alike, in one call.
 */
function pathIsTaken(app, path) {
    return asks(app, ["-e", path, "-o", "-L", path]);
}

function isRegularFile(app, path) {
    return testPath(app, "-f", path);
}

// A folder is not an image, and saying so is not the same as saying its name
// has the wrong extension.
function isDirectory(app, path) {
    return testPath(app, "-d", path);
}

function isExecutable(app, path) {
    return testPath(app, "-x", path);
}

/*
 * A regular file with something in it. Asked in one call because there are
 * five of these per image and a second subprocess each would be five
 * thousand more on a job of a thousand photographs.
 *
 * -s alone passes a directory: measured, and it is how a file moved inside a
 * directory that appeared at the output path was reported as published.
 */
function isRegularNonEmpty(app, path) {
    try {
        app.doShellScript(shellJoin([TEST, "-f", path, "-a", "-s", path]));

        return true;
    } catch (error) {
        if (isUserCancelled(error)) {
            throw error;
        }

        return false;
    }
}

/*
 * Whether two files hold the same bytes, which is the only question that
 * settles whether a font name was resolved or quietly replaced. Asked of
 * files this run has just written and verified, so a cmp that cannot read one
 * of them is not a case this has to tell apart from an honest difference.
 */
function sameBytes(app, one, other) {
    return succeeds(app, [CMP, "-s", one, other]);
}

function verifyFileWritten(app, path, label) {
    if (!isRegularNonEmpty(app, path)) {
        throw new Error(
            `${label} is not a file with anything in it:\n\n${path}`
        );
    }
}

module.exports = {
    succeeds,
    sameBytes,
    isRegularFile,
    isDirectory,
    isExecutable,
    pathIsTaken,
    verifyFileWritten
};
