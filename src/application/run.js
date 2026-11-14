"use strict";
const { IssueError, errorMessage } = require("../core/errors.js");
const { runOutcome } = require("../core/outcomes.js");
function selectionContext(selection) {
    return { count: selection.images.length, selectedFolders: selection.selectedFolders ?? 0,
        folders: [...new Set(selection.images.map((image) => image.folder).filter(Boolean))], rejected: selection.rejected };
}

function executeRun(ports) {
    const request = ports.prepare();
    if (request.selection.images.length === 0) { return ports.interaction.noImages(request.selection.rejected); }
    ports.progress.pause();
    const resolved = ports.interaction.settings(selectionContext(request.selection));
    const result = ports.process(request, resolved);
    const outcome = runOutcome(result.images, request.selection.rejected, request.selection.excluded, result.issues);
    outcome.diagnostics.push(...ports.progress.diagnostics);
    ports.progress.close();
    try { return ports.interaction.present(outcome); }
    catch (cause) {
        throw new IssueError(errorMessage(cause), { cause, outcome });
    }
}
module.exports = { executeRun };
