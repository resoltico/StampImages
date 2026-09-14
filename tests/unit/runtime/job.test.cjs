"use strict";

/*
 * The batch: what each photograph is called when it is finished, and what
 * becomes of the ones that go wrong.
 *
 * The unit of work is one photograph and so is the unit of failure. There is
 * no rollback, because the copies already published are finished work and
 * deleting them would be the failure.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { runJob } = require("../../../src/runtime/job.js");
const { destinationFor } = require("../../../src/runtime/attempt.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob, imageOf } = require("./fake-job.cjs");

function jobOn(host, settings) {
    return { ...makeJob(host, settings), workspace: WORKSPACE };
}

function photographs(...paths) {
    return paths.map(imageOf);
}

test("every photograph gets a copy beside it, named for the original", () => {
    const host = createFakeHost({ files: ["/a/one.jpg", "/a/two.png"] });
    const result = runJob(jobOn(host), photographs("/a/one.jpg", "/a/two.png"));

    assert.deepEqual(result.outputs, ["/a/one_stamped.jpg", "/a/two_stamped.png"]);
    assert.deepEqual(result.failures, []);
});

test("a name that is taken is numbered rather than overwritten", () => {
    const host = createFakeHost({
        files: ["/a/one.jpg", "/a/one_stamped.jpg", "/a/one_stamped_2.jpg"]
    });

    assert.equal(
        destinationFor(jobOn(host), imageOf("/a/one.jpg")),
        "/a/one_stamped_3.jpg"
    );
});

test("one photograph that fails does not take the others with it", () => {
    const host = createFakeHost({
        files: ["/a/one.jpg", "/a/two.jpg", "/a/three.jpg"],
        failures: [["'/a/two.jpg'", new Error("vips: unable to load")]]
    });
    const result = runJob(
        jobOn(host),
        photographs("/a/one.jpg", "/a/two.jpg", "/a/three.jpg")
    );

    assert.deepEqual(result.outputs, [
        "/a/one_stamped.jpg",
        "/a/three_stamped.jpg"
    ]);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].name, "two.jpg");
    assert.match(result.failures[0].message, /unable to load/u);
});

test("the command that failed travels with the failure, for the log", () => {
    const host = createFakeHost({
        files: ["/a/one.jpg"],
        failures: [["autorot", new Error("vips: unable to load")]]
    });
    const result = runJob(jobOn(host), photographs("/a/one.jpg"));

    assert.match(result.failures[0].command, /autorot/u);
});

test("every photograph ends in exactly one of the two places", () => {
    // A run that reported neither for a file would be a run that lost it.
    const host = createFakeHost({
        files: ["/a/one.jpg", "/a/two.jpg"],
        failures: [["'/a/two.jpg'", new Error("no")]]
    });
    const result = runJob(jobOn(host), photographs("/a/one.jpg", "/a/two.jpg"));

    assert.equal(result.outputs.length + result.failures.length, 2);
});

test("the original is never opened for writing", () => {
    const host = createFakeHost({ files: ["/a/one.jpg"] });

    runJob(jobOn(host), photographs("/a/one.jpg"));

    for (const command of host.commands) {
        assert.doesNotMatch(
            command,
            /'\/bin\/(?:mv|rm|cp)'[^\n]*'\/a\/one\.jpg'/u,
            command
        );
    }
});
