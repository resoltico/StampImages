"use strict";
const { isUserCanceled, OperationError } = require("../core/errors.js");
const { isCliInput } = require("../core/invocation.js");
const { runOutcome, issuesOf } = require("../core/outcomes.js");
const { formatDuration } = require("../core/numbers.js");
const { executeRun } = require("../application/run.js");
const { checkTools } = require("./preflight.js");
const { collectInvocation } = require("./input.js");
const { collectImageFiles } = require("./admission.js");
const { createTree } = require("./tree.js");
const { runJob } = require("./job.js");
const { withWorkspace, assemble } = require("./assembly.js");
const { openProgress } = require("./surfaces.js");
const { report, reportNothing, reportHeadless } = require("./reporting.js");
const { inspectCandidates } = require("./source-inspection.js");
const { sourceAccess } = require("./source-capture.js");
const { nativePublication } = require("./native-publication.js");
const { workspaceAccess } = require("./workspace-access.js");
const { reclaimWorkspaces } = require("./workspace.js");
const { cliCommand, showCliCommand } = require("./cli.js");
function capabilities() {
    return { tree: createTree(globalThis.ObjC, globalThis.$, globalThis.Ref), sources: sourceAccess(globalThis.ObjC, globalThis.$),
        publication: nativePublication(globalThis.ObjC, globalThis.$), storage: workspaceAccess(globalThis.ObjC, globalThis.$) };
}
function prepare(app, input, options) {
    const { headless, progress, capabilities: injected } = options;
    progress.phase("Checking required tools");
    const tools = checkTools(app);
    const invocation = headless ? input : collectInvocation(app, input);
    const access = injected ?? capabilities();
    if (!access.tree || !access.sources || !access.publication || !access.storage) { throw new OperationError("Required native filesystem capabilities are unavailable."); }
    progress.diagnostics.push(...reclaimWorkspaces(app, access.storage));
    progress.phase("Finding images");
    const selected = collectImageFiles(app, invocation.inputItems, access.tree);
    return { app, tools, invocation, ...access, selection: inspectCandidates(app, selected, { tools, sources: access.sources, progress }) };
}
function execute(app, input, options) {
    const { headless, progress = openProgress(headless) } = options;
    const started = Date.now();
    return executeRun({
        progress,
        prepare: () => prepare(app, input, { ...options, progress }),
        noImages: (selection) => { progress.close(); return reportNothing(app, headless, selection.rejected); },
        process: (prepared) => withWorkspace(app, prepared, progress, (place) => {
            const job = assemble(prepared, place);
            progress.summary(job.settings);
            progress.expect(prepared.selection.images.length);
            return runJob(job, prepared.selection.images);
        }),
        // Elapsed is the whole run as the person waited for it, as Image Files to PDF reports it.
        present: (result) => report(app, { ...result, elapsed: formatDuration(Date.now() - started) }, headless)
    });
}
function application() { const app = Application.currentApplication(); app.includeStandardAdditions = true; return app; }
function handled(app, input, headless) {
    const progress = openProgress(headless);
    try { return execute(app, input, { headless, progress }); }
    catch (error) {
        const outcome = error.outcome ?? runOutcome();
        outcome.issues.push(...issuesOf(error, error.outcome ? "reporting" : "setup"));
        const failed = runOutcome(outcome.images, outcome.rejected, outcome.excluded, outcome.issues);
        failed.diagnostics.push(...progress.diagnostics);
        if (error.issues?.some((issue) => ["settings", "request"].includes(issue.stage))) { failed.state = "invalid"; }
        if (headless) { return failed; }
        if (!isUserCanceled(error)) { report(app, failed, false); }
        return undefined;
    } finally { progress.close(); }
}
function request(input) {
    try { return cliCommand(input); }
    catch (error) { return { kind: "invalid", issues: issuesOf(error, "request") }; }
}
function runCli(input) {
    const command = request(input);
    if (command.kind === "invalid") {
        const outcome = runOutcome([], [], [], command.issues); outcome.state = "invalid";
        return reportHeadless(outcome);
    }
    if (command.kind !== "run") { return showCliCommand(command.kind); }
    return reportHeadless(handled(application(), command.invocation, true));
}
// eslint-disable-next-line no-unused-vars
function run(input, parameters) { return isCliInput(input) ? runCli(input) : handled(application(), input, false); }
module.exports = { run, execute };
