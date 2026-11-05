"use strict";
const { removeFile } = require("./shell.js");

function removeOwned(job, path) {
    const outcome = removeFile(job.app, path);
    if (outcome.state === "failed") { job.cleanupIssues.push({ ...outcome.issue, source: path }); }
}
module.exports = { removeOwned };
