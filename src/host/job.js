"use strict";
const { runJob: executeJob } = require("../application/job.js");
const { stampOne } = require("./stamping.js");
const { publishImage } = require("./publish.js");
const { nameFrom, STAMPED } = require("../core/naming.js");
function destinationFor(image) { return `${image.folder}${nameFrom(image.originalName, `${STAMPED}${image.extension}`)}`; }
function runJob(job, images) {
    return executeJob({
        begin: (image, index) => job.progress.beginning(index + 1, image.originalName),
        stamp: (image, index, metadataReady) => stampOne(job, image, String(index + 1), metadataReady),
        publish(path, image) {
            const saved = publishImage(job, path, destinationFor(image));
            saved.issues = [...new Set([...job.cleanupIssues.splice(0), ...saved.issues])];
            return saved;
        },
        cleanup() { return job.cleanupIssues.splice(0); },
        completed: (record) => job.progress.finished(record.state)
    }, images);
}
module.exports = { runJob };
