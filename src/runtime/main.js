"use strict";

const { APP_NAME } = require("../core/version.js");
const {
    errorMessage,
    isUserCancelled,
    describeForLog
} = require("../core/errors.js");
const { isHeadlessInput } = require("../core/invocation.js");
const { checkTools } = require("./preflight.js");
const { collectInvocation } = require("./input.js");
const { collectImageFiles } = require("./admission.js");
const { createTree } = require("./tree.js");
const { runJob } = require("./job.js");
const { withWorkspace, assemble } = require("./assembly.js");
const { openProgress } = require("./surfaces.js");
const { report, reportNothing } = require("./reporting.js");

/*
 * The order of a run, which is the product.
 *
 * Nothing is asked of anybody until what can be checked cheaply has been: the
 * tools must be there and usable, there must be photographs, and the settings
 * must describe a stamp that would put something on them. Asking ten
 * questions and then saying vips is missing wastes every answer.
 *
 * Cheap is not the same as instant. A selection of folders is walked here, and
 * the fonts are drawn with to find out which of them this Mac really has --
 * which is why the report exists before any of it rather than after it.
 *
 * Nothing is written until what will be written is known, and nothing that
 * was written is taken back: a photograph that fails is reported beside the
 * copies that succeeded, because those are finished work.
 */

function prepare(app, input, headless, progress) {
    progress.phase("Checking required tools");

    const tools = checkTools(app);
    const invocation = collectInvocation(app, input, headless);

    progress.phase("Finding photographs");

    return {
        tools,
        invocation,
        selection: collectImageFiles(
            app,
            invocation.inputItems,
            createTree(globalThis.ObjC, globalThis.$, globalThis.Ref)
        )
    };
}

/*
 * The report is closed before anything is displayed. A panel at the floating
 * window level sits above a dialog, so a report still on screen when the
 * completion message arrives is a report in front of the answer.
 */
function stampAll(app, job, selection, headless) {
    const result = runJob(job, selection.images);

    // Carried into the report: a photograph that was asked for and not
    // stamped is part of the outcome, not something to leave out of it.
    result.rejected = selection.rejected;
    // What a walk left alone was never asked for, so it is not part of what
    // was requested -- and a second run over a folder is a run that did
    // everything it was asked to.
    result.excluded = selection.excluded;
    result.requested = selection.images.length + selection.rejected.length;
    job.progress.close();

    return report(app, result, headless);
}

function stamp(prepared, place, headless) {
    const job = assemble(prepared, place);

    place.progress.expect(prepared.selection.images.length);

    return stampAll(prepared.app, job, prepared.selection, headless);
}

function execute(app, input, headless, progress = openProgress(headless)) {
    const prepared = { app, ...prepare(app, input, headless, progress) };

    if (prepared.selection.images.length === 0) {
        progress.close();

        return reportNothing(app, headless, prepared.selection.rejected);
    }

    const unpublished = new Set();

    return withWorkspace(app, unpublished, (workspace) => stamp(
        prepared,
        { workspace, unpublished, progress },
        headless
    ));
}

/*
 * The guarantee behind the sentence above: whatever happens in there, the
 * report is closed before the error dialog this returns into.
 */
function runReported(app, input, headless) {
    const progress = openProgress(headless);

    try {
        return execute(app, input, headless, progress);
    } finally {
        progress.close();
    }
}

// osascript calls run with this exact two-argument signature; the second
// parameter is unused here but must remain part of the signature. It answers
// a person with nothing, whichever way the run went -- Shortcuts turns a
// result into a file, and reporting.js is where that is written down.
// eslint-disable-next-line no-unused-vars
function run(input, parameters) {
    const app = Application.currentApplication();
    const headless = isHeadlessInput(input);

    app.includeStandardAdditions = true;

    try {
        return runReported(app, input, headless);
    } catch (error) {
        if (headless) {
            // stderr, where the failing command is worth having.
            throw new Error(describeForLog(error), { cause: error });
        }

        if (!isUserCancelled(error)) {
            app.displayDialog(errorMessage(error), {
                withTitle: APP_NAME,
                buttons: ["OK"],
                defaultButton: "OK"
            });
        }

        return undefined;
    }
}

module.exports = { run, execute };
