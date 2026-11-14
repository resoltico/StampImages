"use strict";
const { OperationError } = require("../core/errors.js");
const { buildMetadataArgv, captureProjection } = require("../backend/queries.js");
const { captureFacts } = require("./capture-facts.js");
const { runArgv } = require("./shell.js");

// The private typed carrier is checked before normalizing raw capture claims.
// Version/association fields never become core facts or receipt diagnostics.
function factsFor(job, imagePath) {
    const answer = runArgv(job.app,
        buildMetadataArgv(job.tools.exiftool, imagePath, job.settings),
        "reading the image's metadata");
    try { return captureFacts(captureProjection(answer, imagePath)); }
    catch (error) {
        throw new OperationError(`The image's metadata could not be read: ${error.message}`, { cause: error });
    }
}
module.exports = { factsFor };
