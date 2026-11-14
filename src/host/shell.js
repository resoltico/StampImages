"use strict";
const { hostError } = require("./cancellation.js");
const { OperationError, isUserCanceled } = require("../core/errors.js");

const { RM, RMDIR, MKTEMP } = require("../core/executables.js");
const { shellJoin, shellQuote } = require("../core/shell.js");
const { errorMessage, summarizeCommand } = require("../core/errors.js");

/*
 * Running a command and taking what it printed.
 *
 * Tool arguments are built as vectors and quoted here. Fixed shell syntax
 * for probes and redirection stays inside this runner; the locale export
 * applies to the entire shell program.
 *
 * Asking the filesystem a question is a different thing and lives in
 * filesystem-probes.js: a question that comes back "no" has answered, and must not be
 * dressed up as a command that failed.
 */

const LOCALE_PREFIX = "export LC_ALL=C; ";

function runCommand(app, command, label) {
    const executed = `${LOCALE_PREFIX}${command}`;
    try {
        return app.doShellScript(executed);
    } catch (caught) {
        const error = hostError(caught);
        if (isUserCanceled(error)) { throw error; }
        const context = label ? ` while ${label}` : "";

        // doShellScript turns the command's newlines into carriage returns,
        // which a terminal prints as lines written over one another.
        const said = errorMessage(error).replace(/\r\n?/gu, "\n").trim();
        const failure = new OperationError(
            `Command failed${context}.\n\n${said}`,
            { cause: error, command: summarizeCommand(executed) }
        );

        throw failure;
    }
}

function runArgv(app, argumentsList, label) {
    return runCommand(app, shellJoin(argumentsList), label);
}

/*
 * Redirect binary tool output to an explicit workspace file. ExifTool -w
 * extends the photograph's filename and can exceed the filesystem limit even
 * for a valid source name. Quote the redirection target by the same argv rule
 * as every other shell argument.
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
        return runArgv(app, argumentsList);
    } catch (caught) {
        const error = hostError(caught);
        if (isUserCanceled(error)) { throw error; }
        return "";
    }
}

function probeArgv(app, argv) { return runCommand(app, `${shellJoin(argv)} 2>&1 || true`); }

function probeImageArgv(app, argumentsList, image) {
    const directory = shellJoin([MKTEMP, "-d", "-t", "image-tool-probe"]);
    const cleanup = `${shellJoin([RM, "--"])} "$probe_dir/image.png"; ${shellJoin([RMDIR, "--"])} "$probe_dir"`;
    const write = `printf '%b' ${shellQuote(image)} >"$probe_dir/image.png"`;
    return runCommand(app, `probe_dir=$(${directory}) && (trap ${shellQuote(cleanup)} EXIT; ${write} && ${shellJoin(argumentsList)} "$probe_dir/image.png") 2>&1`);
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

const MAXIMUM_HEADER_COMMAND_LENGTH = 24000;
const HEADER_ARGV_BUDGET = MAXIMUM_HEADER_COMMAND_LENGTH - LOCALE_PREFIX.length;
const runHeaderArgv = runArgv;

module.exports = { probeImageArgv, probeArgv, cleanupArgv, HEADER_ARGV_BUDGET, runHeaderArgv, runArgv, runArgvInto, tryArgv, removeFile };
