"use strict";
const { hasRetainedArtifacts } = require("../core/artifacts.js");
const { createWorkspace, removeWorkspace } = require("./workspace.js");

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

function jobFor(prepared, settings, place) {
    return {
        app: prepared.app,
        tools: prepared.tools,
        settings,
        workspace: place.workspace,
        // One drawing per distinct text and color space, bounded.
        stamps: new Map(),
        // How many drawings this run has made, which names their files.
        drawn: 0,
        // The color profiles this run has seen, one file each.
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

function assemble(prepared, place, resolved) {
    return { ...jobFor(prepared, resolved.settings, place), covers: resolved.covers };
}
module.exports = { withWorkspace, assemble };
