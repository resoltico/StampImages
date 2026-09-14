"use strict";

const { LN } = require("../core/executables.js");
const { errorMessage, isUserCancelled } = require("../core/errors.js");
const { runArgv } = require("./shell.js");
const { pathIsTaken } = require("./asking.js");

/*
 * Creating the output name, and what is known when it cannot be created.
 *
 * One rule, and nothing is allowed to bend it: the name is created only by an
 * operation that puts the whole copy there in one step and refuses a name that
 * is already taken. Nothing else ever writes to that name.
 *
 * Two operations do that, and both need their source on the destination's own
 * volume. ln creates the directory entry and fails if anything is there --
 * measured, including that what is there is left exactly as it was, and that
 * a link whose target is gone still counts as there. An exclusive rename
 * moves a file onto the name and refuses an occupied one, which is how a
 * FAT32 camera card can be published to at all: it has no hard links.
 *
 * Which may be used where is decided by what a failure would cost. ln does
 * not give up its source, so it can be used on the finished copy itself. An
 * exclusive rename does give it up, so it is used only on a copy -- with the
 * original still in the workspace, which is the whole of what makes a copy
 * expendable. That is why claiming from the workspace is offered no rename.
 *
 * Measured, from a place beside the destination: APFS and HFS Plus take the
 * link, FAT32 refuses it with "Operation not supported" and takes the rename,
 * exFAT refuses both. So a drive with hard links does not need the bridge to
 * the rename to exist at all -- and when that bridge was the only thing tried
 * from beside the destination, a volume that could have taken a link was told
 * it could not be published to.
 *
 * Where both refuse, publication stops. Taking the name empty and filling it
 * is what that replaced: the name existed before the copy was in it, and no
 * guard fixes that, since proving an entry matches something measured a
 * moment ago is not proving it is the file that was created.
 *
 * What is said about a refusal is what was established and nothing more. That
 * a name is taken is an answer to a question actually put. Why an operation
 * was refused is not one: errno does not reach here, and a refused link says
 * why only in a message. So the system's own words are carried instead of a
 * cause of this code's invention -- which named the drive for a folder that
 * denied permission, and for a bridge that had not loaded.
 */

const UNTAKEN = "the output name could not be created in one step, " +
    "so the copy was not put there";
const NO_RENAME = "the other way of creating it was not available to this run";

function published(from) {
    return { published: true, reasons: [], claimed: from };
}

function refused(reasons, taken = false) {
    // Whether something else is at the name is worth carrying: it is the one
    // refusal another name would answer.
    return { published: false, reasons, taken };
}

/*
 * Stopped before it could be either published or refused.
 *
 * Neither of the other two, and it carries no reasons because there is
 * nothing to report about a file that is not there. What the caller does with
 * it is publish.js's business: it puts the same question a successful claim
 * puts, because an interrupted call is not proof the filesystem did nothing.
 */
function abandoned() {
    return { published: false, abandoned: true };
}

/*
 * The link onto the final name: nothing at all when the name was created, and
 * the failure itself when it was not.
 *
 * The failure rather than its message, because the callers have a question to
 * ask of it before they reduce it to words. A cancellation and a refusal read
 * the same once they are strings, and they mean opposite things here: one
 * says this filesystem cannot make links, which is the reason the other route
 * exists, and the other says nothing at all about the filesystem.
 */
function linkFrom(app, from, finalPath) {
    try {
        runArgv(app, [LN, from, finalPath], "claiming the output name");

        return null;
    } catch (error) {
        return error;
    }
}

/*
 * Why the name was not created, in the order it is worth reading: the plain
 * words first, the system's own after them.
 */
function whyNot(app, finalPath, said, rename) {
    if (pathIsTaken(app, finalPath)) {
        return { reasons: ["the output path was taken", said], taken: true };
    }

    return {
        reasons: rename ? [UNTAKEN, said] : [UNTAKEN, NO_RENAME, said],
        taken: false
    };
}

/*
 * Both operations, in turn, from a source that is expendable.
 */
function claimFrom(attempt, from) {
    const { app, paths, rename } = attempt;
    const failure = linkFrom(app, from, paths.final);

    if (!failure) {
        return published(from);
    }

    // The rename is the other way of creating the name, tried because the
    // link would not. A cancellation did not establish that.
    if (isUserCancelled(failure)) {
        return abandoned();
    }

    if (rename && rename.rename(from, paths.final)) {
        return published(from);
    }

    const why = whyNot(app, paths.final, errorMessage(failure), rename);

    return refused(why.reasons, why.taken);
}

module.exports = { linkFrom, claimFrom, published, refused, abandoned };
