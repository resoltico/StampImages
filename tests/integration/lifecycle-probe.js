"use strict";
const { execute } = require("../../src/host/main.js");
const { sourceAccess } = require("../../src/host/source-capture.js");
const { createTree } = require("../../src/host/tree.js");
const { nativePublication } = require("../../src/host/native-publication.js");
const { workspaceAccess } = require("../../src/host/workspace-access.js");
const { commandLineInteraction } = require("../../src/host/command-line/interaction.js");
const { createProgress } = require("../../src/host/progress.js");
const { cliCommand } = require("../../src/host/command-line/cli.js");
const { CP } = require("../../src/core/executables.js");
const { runArgv } = require("../../src/host/shell.js");
const { UserCanceled } = require("../../src/core/errors.js");
function run(input) {
    const [scenario, replacement, ...argv] = input;
    const nativeApp = Application.currentApplication();
    nativeApp.includeStandardAdditions = true;
    let injected = 0;
    const app = { doShellScript(command) {
        if (scenario === "cleanup-fault" && injected === 0 && command.includes("'/bin/rm'") && command.includes("/source-1.png'")) {
            injected += 1;
            throw new Error("Injected private-copy cleanup failure");
        }
        return nativeApp.doShellScript(command);
    } };
    const sources = sourceAccess(ObjC, $);
    const {capture} = sources;
    sources.capture = (source, destination) => {
        if (scenario === "changed-before-capture") { runArgv(app, [CP, replacement, source]); injected += 1; }
        const owned = capture(source, destination);
        if (scenario === "changed-after-capture") { runArgv(app, [CP, replacement, source]); injected += 1; }
        return owned;
    };
    const publication = nativePublication(ObjC, $);
    const nativeLink = publication.link;
    let publicationAttempts = 0;
    publication.link = (from, to) => {
        publicationAttempts += 1;
        const result = nativeLink(from, to);
        if (result.state === "created" && scenario === "fault-after-commit") { injected += 1; throw new TypeError("Injected fault after native commit"); }
        if (result.state === "created" && scenario === "false-refusal") { injected += 1; return { state: "denied" }; }
        if (scenario === "stop-after-commit" && result.state === "created") { injected += 1; throw new UserCanceled(); }
        return result;
    };
    const {invocation} = cliCommand(argv);
    const progress = createProgress([]);
    const {phase} = progress;
    progress.phase = (text) => {
        if ((scenario === "stop-before-publication" && text === "Saving image") || (scenario === "stop-before-recovery" && text === "Keeping the finished copy")) { injected += 1; throw new UserCanceled(); }
        return phase(text);
    };
    const result = execute(app, invocation, { interaction: commandLineInteraction(invocation, { progress }), capabilities: {
        sources, publication, tree: createTree(ObjC, $, globalThis.Ref), storage: workspaceAccess(ObjC, $)
    } });
    return JSON.stringify({ injected, publicationAttempts, ...result });
}
module.exports = { run };
