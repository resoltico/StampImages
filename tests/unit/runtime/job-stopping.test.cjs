"use strict";

/*
 * Stopping, counting, and what the workspace is left holding.
 *
 * What the run says as it goes, and what a photograph leaves behind. Where a
 * stop lands is job-cancelling.test.cjs.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { runJob } = require("../../../src/runtime/job.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob, imageOf, reporter } = require("./fake-job.cjs");

function jobWith(host, progress) {
    return { ...makeJob(host), workspace: WORKSPACE, progress };
}

test("what is happening is said, photograph by photograph", () => {
    const host = createFakeHost({ files: ["/a/one.jpg"] });
    const progress = reporter();

    runJob(jobWith(host, progress), [imageOf("/a/one.jpg")]);

    assert.deepEqual(progress.said, [
        "beginning 1 one.jpg",
        "phase Drawing the stamp",
        "phase Stamping the photograph",
        "phase Saving the copy",
        "finished Saved"
    ]);
});

test("a photograph that failed is still one the run is finished with", () => {
    // The count used to move only on publication, so a run of three whose
    // second failed ended saying two of three.
    const host = createFakeHost({
        files: ["/a/one.jpg"],
        failures: [["autorot", new Error("no")]]
    });
    const progress = reporter();

    runJob(jobWith(host, progress), [imageOf("/a/one.jpg")]);
    assert.ok(progress.said.includes("finished Failed"));
});


test("what a photograph needed on the way through does not outlive it", () => {
    // The stages between the file and the copy are uncompressed: kept until
    // the end of the run, a batch of two hundred would ask the disk for tens
    // of gigabytes it was never told about.
    const host = createFakeHost({ files: ["/a/one.jpg", "/a/two.jpg"] });

    runJob(jobWith(host, reporter()), [imageOf("/a/one.jpg"), imageOf("/a/two.jpg")]);

    const left = [...host.files].filter((path) => path.startsWith(WORKSPACE));

    assert.deepEqual(
        left.filter((path) => (/\/(?:oriented|stamped|staged)-/u).test(path)),
        []
    );
    assert.ok(
        left.some((path) => path.endsWith("stamp-1.png")),
        "the stamp itself stays, because the next photograph wants it"
    );
});

test("a copy that failed its own check does not wait for the workspace", () => {
    // Everything a photograph made is swept, the copy included; the copy is
    // spared only once there is one to hand back. A copy vips wrote and that
    // then failed -- the wrong size, unreadable -- is not a copy of anything,
    // and a batch of failures used to hold one apiece.
    const host = createFakeHost({ files: ["/a/one.jpg"], savedWidth: 599 });
    const result = runJob(jobWith(host, reporter()), [imageOf("/a/one.jpg")]);

    assert.equal(result.failures.length, 1, "the copy is not the photograph");

    const left = [...host.files].filter((path) => path.startsWith(WORKSPACE));

    assert.deepEqual(left.filter((path) => path.includes("/staged-")), []);
});
