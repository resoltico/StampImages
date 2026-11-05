"use strict";
const { OperationError } = require("../core/errors.js");

const { RM } = require("../core/executables.js");
const { shellJoin } = require("../core/shell.js");
const { errorMessage, summarizeCommand } = require("../core/errors.js");

/*
 * Running a command and taking what it printed.
 *
 * Every command is built as an argument vector and quoted here, so no caller
 * ever assembles a command string by concatenation.
 *
 * Asking the filesystem a question is a different thing and lives in
 * asking.js: a question that comes back "no" has answered, and must not be
 * dressed up as a command that failed.
 */

function runCommand(app, command, label) {
    try {
        return app.doShellScript(command);
    } catch (error) {
        const context = label ? ` while ${label}` : "";

        // doShellScript turns the command's newlines into carriage returns,
        // which a terminal prints as lines written over one another.
        const said = errorMessage(error).replace(/\r\n?/gu, "\n").trim();
        const failure = new OperationError(
            `Command failed${context}.\n\n${said}`,
            { cause: error }
        );

        // Carried alongside the message so the presenter can decide: shown in
        // a log, withheld from a dialog.
        failure.command = summarizeCommand(command);

        throw failure;
    }
}

function runArgv(app, argumentsList, label) {
    return runCommand(app, shellJoin(argumentsList), label);
}

/*
 * A command whose answer is a file rather than a line.
 *
 * exiftool writes a binary tag to standard output, and its own -w names the
 * file after the photograph -- which is how a 250-character photograph name
 * asked for a 264-byte filename, over what any Mac filesystem will take. The
 * redirection goes through the same quoting every argument does.
 */
function runArgvInto(app, argumentsList, path, label) {
    return runCommand(
        app,
        `${shellJoin(argumentsList)} > ${shellJoin([path])}`,
        label
    );
}

/*
 * A command whose failure is an answer rather than an error: a temporary file
 * that will not go, a directory that will not empty, a measurement that
 * cannot be taken. Nothing is thrown and nothing is described -- a
 * description is written for somebody to read, and here there is nobody.
 * What silence means is the caller's to decide, and every caller of this has
 * an answer for it.
 */
function tryArgv(app, argumentsList) {
    try {
        return app.doShellScript(shellJoin(argumentsList));
    } catch {
        return "";
    }
}


function cleanupArgv(app, argv) {
    try { runArgv(app, argv, "cleaning temporary work"); return { state: "removed" }; }
    catch (error) {
        const { issuesOf, ISSUE } = require("../core/outcomes.js");
        const [issue] = issuesOf(error, "cleanup");
        return { state: "failed", issue: { ...issue, code: issue.code === ISSUE.canceled ? issue.code : ISSUE.cleanup } };
    }
}
function removeFile(app, path) { return path ? cleanupArgv(app, [RM, "-f", path]) : { state: "skipped" }; }

const HEADER_ARGV_BUDGET = 24000;
const runHeaderArgv = runArgv;

module.exports = { cleanupArgv, HEADER_ARGV_BUDGET, runHeaderArgv, runArgv, runArgvInto, tryArgv, removeFile };
