"use strict";

/*
 * Error classification. The runtime distinguishes a deliberate cancellation,
 * which must stay silent, from a genuine failure, which must be reported.
 */

const CANCEL_ERROR_NUMBER = -128;
const MAX_COMMAND_LENGTH = 4000;
const COMMAND_HEAD_LENGTH = 2000;
const COMMAND_TAIL_LENGTH = 1000;

function errorMessage(error) {
    if (!error) {
        return "Unknown error";
    }

    if (error.message) {
        return String(error.message);
    }

    return String(error);
}

/*
 * Cancellation is a decision, not a phrase.
 *
 * This used to be read out of the message text, and every per-image failure
 * carries the name of the image it happened to -- so a file called
 * "User cancelled.jpg" that genuinely failed to convert looked exactly like
 * somebody pressing Cancel, and the run ended silently with no dialog at all.
 *
 * The host's own cancellation still arrives as a number, because that is how
 * osascript reports one and there is nothing to mistake it for.
 */
// Deep enough for the wrapping this code does, and bounded so a cause that
// refers back to itself cannot spin.
const MAXIMUM_CAUSE_DEPTH = 8;

/*
 * Every error in the chain, outermost first.
 *
 * A layer that adds context wraps what it caught as a cause, so the error a
 * caller is handed is rarely the error that happened. Two questions here are
 * really questions about the chain: which command failed, and whether the
 * person asked to stop.
 */
function causes(error) {
    const chain = [];
    let current = error;

    for (let depth = 0; current && depth < MAXIMUM_CAUSE_DEPTH; depth += 1) {
        chain.push(current);
        current = current.cause;
    }

    return chain;
}

class UserCancelled extends Error {
    constructor() {
        super("User cancelled.");
        this.name = "UserCancelled";
    }
}

/*
 * Whether the person asked to stop, wherever in the chain they asked.
 *
 * Asked of the whole chain, because a cancellation that passes through a
 * layer which adds context arrives wrapped -- and read off the outermost
 * error alone it is not a cancellation at all, so the run reports "the person
 * cancelled" in a dialog as though something had gone wrong.
 */
function isUserCancelled(error) {
    return causes(error).some((each) => each instanceof UserCancelled ||
        each.errorNumber === CANCEL_ERROR_NUMBER);
}

/*
 * A failing command is shown to the user in a dialog. A long argument list
 * would make that dialog unreadable, so the middle is elided.
 */
function summarizeCommand(command) {
    const text = String(command);

    if (text.length <= MAX_COMMAND_LENGTH) {
        return text;
    }

    return [
        text.slice(0, COMMAND_HEAD_LENGTH),
        "...[command truncated]...",
        text.slice(text.length - COMMAND_TAIL_LENGTH)
    ].join("\n\n");
}

/*
 * The failing command, wherever it is in the chain.
 *
 * Only the innermost error carries it, and every layer that adds context
 * wraps that error as a cause. Reading the outermost error alone therefore
 * finds nothing, and the one detail worth having in a log is the one that
 * disappears.
 */
function commandOf(error) {
    const carried = causes(error).find((each) => each.command);

    return carried ? String(carried.command) : "";
}

/*
 * The command that failed is invaluable in a log and noise in a dialog: a
 * person who right-clicked in Finder is not going to debug an argv, and it
 * buries the one line that matters underneath it.
 */
function describeForLog(error) {
    const command = commandOf(error);

    return command
        ? `${errorMessage(error)}\n\nCommand:\n${command}`
        : errorMessage(error);
}

module.exports = {
    UserCancelled,
    errorMessage,
    commandOf,
    isUserCancelled,
    summarizeCommand,
    describeForLog
};
