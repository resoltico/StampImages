"use strict";
const { createProgress } = require("../../../src/host/progress.js");
function makeJob(app) {
    return { app, workspace: "/tmp/StampImages.X", artifacts: new Map(), cleanupIssues: [], storage: app.storage,
        progress: createProgress([]), publication: app.publication, sources: app.sources };
}
module.exports = { makeJob };
