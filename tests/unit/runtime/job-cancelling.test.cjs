"use strict";

/*
 * Stopping a run.
 *
 * A stop takes effect wherever the run says what it is about to do, because
 * nothing has been done at any of those places. What was published before the
 * person asked is finished work and is reported as such; the rest was never
 * attempted, and a cancellation is never a photograph that failed.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { runJob } = require("../../../src/runtime/job.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob, imageOf, reporter } = require("./fake-job.cjs");

function jobWith(host, progress) {
    return { ...makeJob(host), workspace: WORKSPACE, progress };
}

test("a person who asks to stop mid-photograph stops the run", () => {
    // Not this photograph's fault, and not this photograph's failure: what
    // was published before they asked is finished work, and the rest was
    // never attempted.
    const cancelled = new Error("User cancelled.");

    cancelled.errorNumber = -128;

    const host = createFakeHost({
        files: ["/a/one.jpg", "/a/two.jpg"],
        failures: [["'/a/two.jpg'", cancelled]]
    });
    const result = runJob(jobWith(host, reporter()), [
        imageOf("/a/one.jpg"),
        imageOf("/a/two.jpg")
    ]);

    assert.deepEqual(result.outputs, ["/a/one_stamped.jpg"]);
    assert.deepEqual(result.failures, [], "a cancellation is not a failed photograph");
    assert.equal(result.stopped, true);
});

test("a cancellation wrapped by the layer that caught it is still one", () => {
    const cancelled = new Error("User cancelled.");

    cancelled.errorNumber = -128;

    const host = createFakeHost({
        files: ["/a/one.jpg"],
        failures: [["autorot", cancelled]]
    });
    const result = runJob(jobWith(host, reporter()), [imageOf("/a/one.jpg")]);

    assert.equal(result.stopped, true);
    assert.deepEqual(result.failures, []);
});

test("a run that is stopped reports what it managed", () => {
    const host = createFakeHost({ files: ["/a/one.jpg", "/a/two.jpg"] });
    const result = runJob(jobWith(host, reporter(1)), [
        imageOf("/a/one.jpg"),
        imageOf("/a/two.jpg")
    ]);

    assert.deepEqual(result.outputs, ["/a/one_stamped.jpg"]);
    assert.equal(result.stopped, true);
    assert.equal(host.files.has("/a/two_stamped.jpg"), false);
});

test("a run nobody stopped says nothing about stopping", () => {
    const host = createFakeHost({ files: ["/a/one.jpg"] });
    const result = runJob(jobWith(host, reporter()), [imageOf("/a/one.jpg")]);

    assert.equal(result.stopped, undefined);
});

test("a stop takes effect at the next thing the run says it is about to do", () => {
    // Between photographs, when that is where it lands: the second one is
    // announced and goes no further, and what the first came to is reported.
    const host = createFakeHost({ files: ["/a/one.jpg", "/a/two.jpg"] });
    const progress = reporter(1);

    const result = runJob(jobWith(host, progress), [
        imageOf("/a/one.jpg"),
        imageOf("/a/two.jpg")
    ]);

    assert.deepEqual(progress.said.slice(-2), ["finished Saved", "beginning 2 two.jpg"]);
    assert.deepEqual(result.outputs, ["/a/one_stamped.jpg"]);
});

test("and inside one, where a photograph is half a dozen vips stages", () => {
    // "Between photographs" bounded a stop by a whole photograph. Nothing has
    // been done at a report of what is about to happen, so nothing is lost by
    // not doing it: the copy was never published and the workspace takes the
    // stages with it.
    const host = createFakeHost({ files: ["/a/one.jpg", "/a/two.jpg"] });
    const progress = reporter(Infinity, "phase Stamping the photograph");

    const result = runJob(jobWith(host, progress), [
        imageOf("/a/one.jpg"),
        imageOf("/a/two.jpg")
    ]);

    assert.equal(result.stopped, true);
    assert.deepEqual(result.outputs, []);
    assert.deepEqual(result.failures, [], "a stop is not a photograph that failed");
    assert.equal(
        progress.said.filter((line) => line.startsWith("finished")).length,
        0,
        "a photograph that came to nothing is not counted as finished with"
    );
    assert.equal(host.files.has("/a/one_stamped.jpg"), false);
});

test("a stop as publication begins leaves nothing at the output path", () => {
    // The first thing publication says is what it is about to do, and it says
    // it before the copy is recorded as the job's or any name is claimed.
    const host = createFakeHost({ files: ["/a/one.jpg"] });
    const progress = reporter(Infinity, "phase Saving the copy");

    const result = runJob(jobWith(host, progress), [imageOf("/a/one.jpg")]);

    assert.equal(result.stopped, true);
    assert.deepEqual(result.outputs, [], "it stopped before the claim was made");
    assert.equal(host.files.has("/a/one_stamped.jpg"), false);
});
