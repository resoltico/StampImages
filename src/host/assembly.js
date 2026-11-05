"use strict";
const { OperationError } = require("../core/errors.js");
const { hasRetainedArtifacts } = require("../core/artifacts.js");
const { createWorkspace, removeWorkspace } = require("./workspace.js");
const { availableFonts } = require("./fonts.js");
const { catalogue } = require("./typefaces.js");
const { settingsFor } = require("./settings-run.js");

/*
 * Everything a run needs before it can stamp anything, gathered in the order
 * the answers depend on each other: which faces this Mac has, then what the
 * person wants drawn with them, then the job that carries both.
 *
 * Separate from main.js because it is a different kind of decision. The order
 * of a run is the product; this is the machinery that order asks for.
 */

/*
 * The workspace outlives the run when it still holds a finished copy that
 * could not be published and could not be moved anywhere else: the message
 * that reported the failure sent the user to it, and removing it here would
 * delete the file that message is about.
 */
function withWorkspace(app, prepared, progress, use) {
    const workspace = createWorkspace(app, prepared.storage);
    const artifacts = new Map();
    const place = { workspace, artifacts, progress };
    let result = null;
    try { result = use(place); return result; }
    finally {
        if (hasRetainedArtifacts(artifacts)) {
            const issue = { code: "retained", stage: "workspace", message: "Unreleased work remains in the workspace.", diagnostic: { path: workspace } };
            if (result) { result.issues.push(issue); }
            else { progress.diagnostics.push(issue); }
        } else {
            const removed = removeWorkspace(app, workspace);
            if (removed.state === "failed") {
                if (result) { result.issues.push(removed.issue); }
                else { progress.diagnostics.push(removed.issue); }
            }
        }
    }
}

/*
 * Which faces to suggest, asked only when somebody is going to be offered a
 * choice of them.
 *
 * It used to be the longest thing a run did before it said anything, because
 * every candidate was drawn with and compared. It is now a question put to the
 * font system, which answers in one call and answers about every family on the
 * machine rather than about ten.
 */
function fontsFor(known, headless) {
    return headless ? [] : availableFonts(known);
}

function settingsFrom(app, invocation, context) {
    return settingsFor(app, invocation, context);
}

function jobFor(prepared, settings, place) {
    return {
        app: prepared.app,
        tools: prepared.tools,
        settings,
        workspace: place.workspace,
        // One drawing per distinct text and colour space, bounded.
        stamps: new Map(),
        // How many drawings this run has made, which names their files.
        drawn: 0,
        // The colour profiles this run has seen, one file each.
        profiles: [],
        // Finished copies this run has produced and not yet published.
        artifacts: place.artifacts,
        sources: prepared.sources,
        storage: prepared.storage,
        publication: prepared.publication,
        cleanupIssues: [],
        progress: place.progress
    };
}

/*
 * The job, and the two questions that have to be answered before there can be
 * one. The pause is between them and the asking: a panel at the floating
 * window level would otherwise sit over the form, and re-arming it means a run
 * quick enough to need no window still does not get one.
 */
function assemble(prepared, place, known = catalogue()) {
    if (!known) { throw new OperationError("Installed typefaces could not be verified on this Mac."); }
    // What this Mac has, read once. It goes in the context beside the count
    // and the suggestions because it is the same sort of thing: what the front
    // ends need in order to ask. Neither of them can answer it, and both have
    // to -- a headless run has no suggestions and still names a typeface.
    const context = {
        count: prepared.selection.images.length,
        selectedFolders: prepared.selection.selectedFolders ?? 0,
        rejected: prepared.selection.rejected,
        fonts: fontsFor(known, prepared.invocation.headless),
        known
    };

    place.progress.pause();

    const settings = settingsFrom(prepared.app, prepared.invocation, context);

    return { ...jobFor(prepared, settings, place), covers: known.coverageOf?.(settings.typeface) ?? null };
}

module.exports = { withWorkspace, assemble, settingsFrom, jobFor };
