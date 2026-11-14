"use strict";
const { execute } = require("../../src/host/main.js");
const { sourceAccess } = require("../../src/host/source-capture.js");
const { createTree } = require("../../src/host/tree.js");
const { nativePublication } = require("../../src/host/native-publication.js");
const { workspaceAccess } = require("../../src/host/workspace-access.js");
const { commandLineInteraction } = require("../../src/host/command-line/interaction.js");
const { createProgress } = require("../../src/host/progress.js");
const { cliCommand } = require("../../src/host/command-line/cli.js");
function run(input) {
    const [downloads, ...argv] = input;
    const app = Application.currentApplication();
    app.includeStandardAdditions = true;
    const storage = workspaceAccess(ObjC, $);
    storage.downloads = downloads;
    const publication = nativePublication(ObjC, $);
    const {link} = publication;
    let attemptedDownloads = 0;
    publication.link = (from, to) => {
        if (to.startsWith(downloads)) { attemptedDownloads += 1; }
        return link(from, to);
    };
    const { invocation } = cliCommand(argv);
    const result = execute(app, invocation, { interaction: commandLineInteraction(invocation, { progress: createProgress([]) }), capabilities: {
        sources: sourceAccess(ObjC, $), publication, storage, tree: createTree(ObjC, $, globalThis.Ref)
    } });
    return JSON.stringify({ attemptedDownloads, ...result });
}
module.exports = { run };
