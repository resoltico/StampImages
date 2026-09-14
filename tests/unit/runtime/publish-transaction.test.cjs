"use strict";

/*
 * Publication as one transaction.
 *
 * The output name is claimed, never written into: ln creates the directory
 * entry in one step, or fails and leaves the name alone. Measured, including
 * that what is already at the name is left exactly as it was.
 *
 * This is why the finished copy is not simply renamed to its final name.
 * Across volumes Apple's mv copies to the pathname it is given, and an
 * interrupted move on an attached test volume left 3,211,264 bytes of a
 * 1,258,291,200-byte file under exactly that name.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { publishImage } = require("../../../src/runtime/publish.js");
const { createFakeHost } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

const DENIED = "Operation not permitted";
const DIRECT_CLAIM = "ln' '/a/staged-1.jpg'";
// The check publishImage makes before it starts, stubbed away so the name can
// be taken between that check and the claim.
const FREE_UNTIL_CLAIMED = ["test' '-e' '/a/photo_stamped.jpg' '-o'", new Error("test failed")];

function recovered(host) {
    return [...host.files].filter((file) => file.includes("recovered"));
}

function touching(host, path) {
    return host.commands.filter((command) =>
        (/'\/bin\/(?:mv|cp|ln)'/u).test(command) && command.includes(`'${path}'`));
}

test("one operation touches the output name, and it is the claim", () => {
    const host = createFakeHost({ files: ["/a/staged-1.jpg"] });

    publishImage(makeJob(host), "/a/staged-1.jpg", () => "/a/photo_stamped.jpg");

    const writes = touching(host, "/a/photo_stamped.jpg");

    assert.equal(writes.length, 1, writes.join("\n"));
    assert.equal(writes[0], "'/bin/ln' '/a/staged-1.jpg' '/a/photo_stamped.jpg'");
});

test("the staging copy is only reached when the link cannot be made", () => {
    const linked = createFakeHost({ files: ["/a/staged-1.jpg"] });

    publishImage(makeJob(linked), "/a/staged-1.jpg", () => "/a/photo_stamped.jpg");
    assert.equal(
        linked.commands.filter((command) => command.includes(".StampImages")).length,
        0,
        "nothing about a staging name is even asked"
    );

    const copied = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: [[DIRECT_CLAIM, new Error(DENIED)]]
    });

    publishImage(makeJob(copied), "/a/staged-1.jpg", () => "/a/photo_stamped.jpg");
    assert.match(
        copied.commands.find((command) => command.includes("/bin/cp")),
        /'\/a\/\.StampImages-[^']+\/ready\.jpg'/u
    );
});

test("a claim that landed inside a folder leaves nothing of ours in it", () => {
    // ln puts the file inside a directory standing at the output path rather
    // than refusing the name. The link is this run's own, so it goes; the copy
    // is in the workspace, where it always was.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        directories: ["/a/photo_stamped.jpg"],
        // The folder has to appear between the check and the claim.
        failures: [["test' '-e' '/a/photo_stamped.jpg' '-o'", new Error("test failed")]]
    });
    const job = makeJob(host);

    assert.throws(() => publishImage(job, "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"), (error) => {
        assert.match(error.message, /does not hold the copy this run published/u);
        assert.match(error.message, /restart:\n\n\S+recovered/u);

        return true;
    });
    assert.deepEqual(
        [...host.files].filter((file) => file.startsWith("/a/photo_stamped.jpg/")),
        [],
        "the link inside the folder was this run's to remove"
    );
    assert.equal(recovered(host).length, 1);
});

test("a directory at the output name does not become a publication", () => {
    // ln puts the file inside a directory rather than refusing the name, so
    // what is at the output path is checked afterwards for what it is.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        directories: ["/a/photo_stamped.jpg"],
        failures: [FREE_UNTIL_CLAIMED]
    });

    assert.throws(
        () => publishImage(makeJob(host), "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"),
        /does not hold the copy this run published/u
    );
});
