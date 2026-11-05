"use strict";
const { errorMessage } = require("../core/errors.js");
const { runOutcome } = require("../core/outcomes.js");
function executeRun(ports) {
    const request = ports.prepare();
    if (request.selection.images.length === 0) { return ports.noImages(request.selection); }
    ports.progress.pause();
    const result = ports.process(request);
    const outcome = runOutcome(result.images, request.selection.rejected, request.selection.excluded, result.issues);
    outcome.diagnostics.push(...ports.progress.diagnostics);
    ports.progress.close();
    try { return ports.present(outcome); }
    catch (cause) {
        const error = new Error(errorMessage(cause), { cause });
        error.outcome = outcome;
        throw error;
    }
}
module.exports = { executeRun };
