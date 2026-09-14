"use strict";

/*
 * What an abandoned publication leaves behind, and what it does not.
 *
 * Nothing of this run is at the destination, so there is nothing to report and
 * nothing to hand back -- which is only true because the output path was asked
 * what it holds. An interrupted call is no proof the filesystem did nothing:
 * the same question that settles a successful claim settles this one. Where an
 * outcome becomes abandoned in the first place is publish-abandoned.test.cjs.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { UserCancelled } = require("../../../src/core/errors.js");
const { publishImage } = require("../../../src/runtime/publish.js");
const { createFakeHost } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

const DENIED = "Operation not permitted";
const DIRECT_CLAIM = "ln' '/a/staged-1.jpg'";
const COPYING = "'/bin/cp'";

function cancellation() {
    const stopped = new Error("User cancelled.");

    stopped.errorNumber = -128;

    return stopped;
}

function staging(host) {
    return [...host.files].filter((file) => file.includes(".StampImages-"));
}

function recovered(host) {
    return [...host.files].filter((file) => file.includes("recovered"));
}

test("an abandoned publication leaves nothing of itself in the folder", () => {
    // Nothing of this run is at the destination, so there is nothing to
    // report and nothing to hand back: the copy is dropped from the
    // unpublished set, which says the workspace may take it on the way out.
    // That is the difference from a refusal, which keeps it because the person
    // needs it back.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: [
            [DIRECT_CLAIM, new Error(DENIED)],
            [COPYING, cancellation()]
        ]
    });
    const job = makeJob(host);

    assert.throws(
        () => publishImage(job, "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"),
        UserCancelled
    );
    assert.equal(job.unpublished.size, 0);
    assert.deepEqual(staging(host), []);
    assert.deepEqual(recovered(host), [], "a stop is not a failure to report");
    assert.equal(host.files.has("/a/photo_stamped.jpg"), false);

    // The place itself, and not merely what was put in it: a directory left
    // in somebody's photographs is the visible half of what stopping costs.
    assert.ok(
        host.commands.some((command) => command.includes("'/bin/rmdir'")),
        `the staging place was not taken away again:\n${host.commands.join("\n")}`
    );
});

test("an interrupted call is not proof the filesystem did nothing", () => {
    // The call completed and then raised, which is what an Apple Event does
    // when somebody presses stop. The link is there, so the copy was
    // published -- and a run that reported nothing about it would have lost
    // the one thing it had produced.
    const host = createFakeHost({ files: ["/a/staged-1.jpg"] });
    const answering = host.doShellScript;

    host.doShellScript = (command) => {
        const answer = answering(command);

        if (command.includes(DIRECT_CLAIM)) {
            throw cancellation();
        }

        return answer;
    };

    const job = makeJob(host);
    const saved = publishImage(job, "/a/staged-1.jpg", () => "/a/photo_stamped.jpg");

    assert.equal(saved.path, "/a/photo_stamped.jpg");
    assert.equal(saved.stopped, true, "published, and then the run stops");
    assert.equal(job.unpublished.size, 0, "the job has let go of it");
    assert.equal(host.files.has("/a/photo_stamped.jpg"), true);
});
