"use strict";

/*
 * The ways publication can fail, and how each is told apart from success.
 *
 * Neither mv -n nor cp -n reports declining: both exit zero and do nothing.
 * A copy is not atomic either, so a file at the destination is not evidence
 * that it holds our copy. What the sizes say, and what is left under the
 * staging name, is what settles it.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { publishImage } = require("../../../src/runtime/publish.js");
const { createFakeHost } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

const DENIED = "Operation not permitted";
const DIRECT_CLAIM = "ln' '/a/staged-1.jpg'";

function refusing(...tools) {
    return tools.map((tool) => [tool, new Error(DENIED)]);
}

test("an occupied name is stepped over, not failed on", () => {
    // A name is chosen free and claimed a moment later, and another program
    // can take it in between. The copy is still in the workspace, so the next
    // free name costs a claim rather than the work again.
    const host = createFakeHost({ files: ["/a/staged-1.jpg", "/a/photo_stamped.jpg"] });
    const job = makeJob(host);
    const names = ["/a/photo_stamped.jpg", "/a/photo_stamped_2.jpg"];

    assert.deepEqual(
        publishImage(job, "/a/staged-1.jpg", () => names.shift()),
        { path: "/a/photo_stamped_2.jpg", stopped: false }
    );
    assert.equal(job.unpublished.size, 0, "and the job no longer owns the copy");
    assert.ok(host.files.has("/a/photo_stamped.jpg"), "the other file is intact");
});

test("a name that keeps being taken is not a race any more", () => {
    // Bounded, because the same name refused three times is something else
    // standing there rather than a moment to wait out.
    const host = createFakeHost({ files: ["/a/staged-1.jpg", "/a/photo_stamped.jpg"] });
    const job = makeJob(host);

    assert.throws(
        () => publishImage(job, "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"),
        /the output path was taken/u
    );
    assert.equal(
        host.commands.filter((command) => command.includes("/bin/ln")).length,
        3,
        "three names tried, and no more"
    );
});

test("a link whose target is gone still occupies the name", () => {
    // -e follows the link and finds nothing, so the name reads as free while
    // something is plainly there: measured, mv replaces such a link without
    // complaint. The entry is what the output name is about.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        danglingLinks: ["/a/photo_stamped.jpg"]
    });

    assert.throws(
        () => publishImage(makeJob(host), "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"),
        /the output path was taken/u
    );
    // Setting the copy aside uses mv too, so what matters is that nothing
    // replaced what was standing at the name: ln refuses it, which is the
    // whole point of claiming with ln.
    assert.deepEqual(
        host.commands.filter((command) =>
            (/'\/bin\/(?:mv|cp)'/u).test(command) && command.includes("'/a/photo_stamped.jpg'")),
        [],
        "nothing was renamed or copied over it"
    );
});

test("when the copy cannot be got into the folder at all, every refusal is named", () => {
    // The link message is what made the original failure diagnosable, and the
    // copy message is what says the fallback was tried.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: refusing("/bin/ln", "/bin/cp")
    });

    assert.throws(() => publishImage(makeJob(host), "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"), (error) => {
        assert.match(error.message, /claiming the output name/u);
        assert.match(error.message, /copying the stamped copy into the output folder/u);

        return true;
    });
});

test("a failed publication keeps the finished copy and says where", () => {
    // It has been imported and validated by this point. Deleting it destroys
    // completed work over a failure that has nothing to do with its contents.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: refusing("/bin/ln", "/bin/cp")
    });

    assert.throws(() => publishImage(makeJob(host), "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"), (error) => {
        assert.match(error.message, /The finished copy has been kept here,/u);

        return true;
    });
    assert.equal(
        [...host.files].filter((file) => file.includes("recovered")).length,
        1,
        "the finished copy must survive"
    );
    assert.ok(!host.files.has("/a/photo_stamped.jpg"), "and the output name is untouched");
});

test("a name holding something other than what was published is a failure", () => {
    // The check is which file is there, not whether some file is there: a
    // nonempty regular file at the output name is what another writer's copy
    // looks like too.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        emptyFiles: ["/a/photo_stamped.jpg"]
    });

    assert.throws(
        () => publishImage(makeJob(host), "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"),
        /does not hold the copy this run published/u
    );
});

test("the failure reads as paragraphs, not as one run-on line", () => {
    // It goes in front of a person in a dialog, under a heading sentence.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg"],
        failures: refusing(DIRECT_CLAIM, "/bin/cp")
    });

    assert.throws(() => publishImage(makeJob(host), "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"), (error) => {
        assert.ok(error.message.startsWith(
            "The stamped copy could not be saved where it was meant to go.\n\n"
        ), error.message);

        return true;
    });
});
