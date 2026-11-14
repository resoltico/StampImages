"use strict";
const { OperationError } = require("../core/errors.js");
const { formatDuration } = require("../core/formatting.js");
const { executeRun } = require("../application/run.js");
const { checkTools } = require("./preflight.js");
const { collectImageFiles } = require("./admission.js");
const { createTree } = require("./tree.js");
const { runJob } = require("./job.js");
const { withWorkspace, assemble } = require("./assembly.js");
const { inspectCandidates } = require("./source-inspection.js");
const { sourceAccess } = require("./source-capture.js");
const { nativePublication } = require("./native-publication.js");
const { workspaceAccess } = require("./workspace-access.js");
const { reclaimWorkspaces } = require("./workspace.js");
function capabilities() {
    return { tree: createTree(globalThis.ObjC, globalThis.$, globalThis.Ref), sources: sourceAccess(globalThis.ObjC, globalThis.$),
        publication: nativePublication(globalThis.ObjC, globalThis.$), storage: workspaceAccess(globalThis.ObjC, globalThis.$) };
}
function prepare(app, input, options) {
    const { interaction } = options;
    const { progress } = interaction;
    progress.phase("Checking required tools");
    const tools = checkTools(app);
    const invocation = interaction.collect(input);
    const access = options.capabilities ?? capabilities();
    if (!access.tree || !access.sources || !access.publication || !access.storage) { throw new OperationError("Required native filesystem capabilities are unavailable."); }
    progress.diagnostics.push(...reclaimWorkspaces(app, access.storage));
    progress.phase("Finding images");
    const selected = collectImageFiles(app, invocation.inputItems, access.tree);
    return { app, tools, invocation, ...access, selection: inspectCandidates(app, selected, { tools, sources: access.sources, progress }) };
}
function execute(app, input, options) {
    const { interaction } = options;
    const { progress } = interaction;
    // Measure the whole use case, including setup, inspection and interactive consent.
    const started = Date.now();
    return executeRun({
        progress,
        prepare: () => prepare(app, input, options),
        process: (prepared, resolved) => withWorkspace(app, prepared, progress, (place) => {
            const job = assemble(prepared, place, resolved);
            progress.summary(job.settings);
            progress.expect(prepared.selection.images.length);
            return runJob(job, prepared.selection.images);
        }),
        interaction: { settings: interaction.settings,
            noImages(rejected) { progress.close(); return interaction.noImages(rejected); },
            present: (result) => interaction.present({ ...result, elapsed: formatDuration(Date.now() - started) }) }
    });
}
function application() { const app = Application.currentApplication(); app.includeStandardAdditions = true; return app; }
module.exports = { execute, application };
