"use strict";

/*
 * Publication answers three ways, not two.
 *
 * An outcome used to be published or refused. A cancellation is neither: it is
 * stopped before it could become either, and reading it as a refusal is how a
 * run that was asked to stop went on doing visible work in somebody's folder.
 *
 * Two rules hold this together. A cancellation is not a diagnosis -- the
 * second route exists because a link was judged impossible, and an interrupted
 * link was not judged at all. And an abandoned attempt is not a claim that
 * nothing happened: an interrupted call is no proof the filesystem did
 * nothing, so the claim travels with it and the output path is asked what it
 * holds either way. What publication then does with that is
 * publish-stopped.test.cjs.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { deliver, stagingArea } = require("../../../src/runtime/transfer.js");
const { createFakeHost } = require("./fake-host.cjs");

const FACTS = { identity: "1:2", size: 1024 };
const DENIED = "Operation not permitted";
const DIRECT_CLAIM = "ln' '/a/staged-1.jpg'";
const STAGED_CLAIM = "ln' '/a/.StampImages-";
const COPYING = "'/bin/cp'";
const FINAL = "/a/photo_stamped.jpg";
const PATHS = { staged: "/a/staged-1.jpg", final: FINAL };

// The whole of what publication hands to deliver: the copy, the name, and the
// place beside the name to use if the name cannot be claimed from where the
// copy is.
function pathsWithStaging() {
    return { ...PATHS, area: stagingArea(FINAL) };
}

function cancellation() {
    const stopped = new Error("User cancelled.");

    stopped.errorNumber = -128;

    return stopped;
}

function staging(host) {
    return [...host.files].filter((file) => file.includes(".StampImages-"));
}

test("a cancellation at the link is not a filesystem that cannot make one", () => {
    // The route below the link is chosen because the link was judged
    // impossible -- another volume, a filesystem without hard links. Taking it
    // after a cancellation makes a folder in somebody's photographs and copies
    // the whole picture into it after they said stop.
    const host = createFakeHost({ files: ["/a/staged-1.jpg"] });
    const outcome = deliver(host, PATHS, FACTS, host.renamer);

    assert.equal(outcome.published, true, "nothing is stopping this one");

    const stopping = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: [[DIRECT_CLAIM, cancellation()]]
    });
    const abandoned = deliver(stopping, PATHS, FACTS, stopping.renamer);

    assert.equal(abandoned.abandoned, true);
    assert.equal(abandoned.published, false);
    assert.equal(abandoned.staging, null);
    assert.deepEqual(staging(stopping), [], "nothing was made in the folder");
    assert.equal(
        stopping.commands.some((command) => command.includes(COPYING)),
        false,
        "and the picture was not copied anywhere"
    );
});

test("the claim travels with it, because the link may have been made", () => {
    // A hard link shares the identity of the file it was made from, so what
    // publication asks the output path afterwards needs to know which file was
    // being put there. An abandoned outcome that carried no claim could only
    // answer "not ours" -- which is the one thing this must never guess.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: [[DIRECT_CLAIM, cancellation()]]
    });
    const outcome = deliver(host, PATHS, FACTS, host.renamer);

    assert.equal(outcome.claimedIdentity, FACTS.identity);
    assert.equal(outcome.claimedSize, FACTS.size);
});

test("a cancellation while the copy is being made beside the destination", () => {
    // Here the link really was refused, so the route was a judgement; the stop
    // arrives inside it. The place this attempt made goes with it.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: [
            [DIRECT_CLAIM, new Error(DENIED)],
            [COPYING, cancellation()]
        ]
    });
    const outcome = deliver(host, pathsWithStaging(), FACTS, host.renamer);

    assert.equal(outcome.abandoned, true);
    assert.ok(outcome.staging, "the place was made, so it is this attempt's to clear");
    assert.equal(outcome.claimedIdentity, "", "and nothing was claimed");
});

test("a cancellation claiming the name from beside the destination", () => {
    // The exclusive rename is the other way of creating the name, tried
    // because the link would not. A cancellation did not establish that
    // either, and it gives up the copy it is made from.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: [
            [DIRECT_CLAIM, new Error(DENIED)],
            [STAGED_CLAIM, cancellation()]
        ]
    });
    let renames = 0;
    const rename = {
        rename(from, to) {
            renames += 1;

            return host.renamer.rename(from, to);
        }
    };
    const outcome = deliver(host, pathsWithStaging(), FACTS, rename);

    assert.equal(outcome.abandoned, true);
    assert.equal(outcome.published, false);
    assert.equal(renames, 0, "the other way of creating the name was not tried");
});
