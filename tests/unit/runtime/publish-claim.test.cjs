"use strict";

/*
 * A name that is taken stays taken.
 *
 * ln refuses an occupied name and leaves what is there exactly as it was --
 * measured, for a file, a folder and a link whose target is gone. mv does
 * not: it checks and then renames, and replaces whatever appeared in
 * between. So a refused claim must not quietly become a rename, and what the
 * refusal meant is decided by asking whether the name is taken rather than by
 * reading the words of it.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { publishImage } = require("../../../src/runtime/publish.js");
const { deliver } = require("../../../src/runtime/transfer.js");
const { createFakeHost } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

// What is being put at the name, which every outcome carries so that the
// caller can ask the output path whether it holds it.
const FACTS = { identity: "1:2", size: 1024 };

const DENIED = "Operation not permitted";
const DIRECT_CLAIM = "ln' '/a/staged-1.jpg'";

test("a claim refused because the name is taken does not become a rename", () => {
    // The claim refuses an occupied name and a rename does not: mv checks and
    // then renames, and replaces whatever appeared in between. A refused
    // claim must not quietly turn into that -- so what the refusal meant is
    // decided by asking whether the name is taken, not by reading it.
    const host = createFakeHost({ files: ["/a/staged-1.jpg", "/a/theirs.pdf"] });

    host.sizes.set("/a/theirs.pdf", 99);

    const outcome = deliver(host, {
        staged: "/a/staged-1.jpg",
        final: "/a/theirs.pdf"
    }, FACTS);

    assert.equal(outcome.published, false);
    assert.match(outcome.reasons.at(0), /the output path was taken/u);
    assert.equal(host.sizes.get("/a/theirs.pdf"), 99, "the other file is intact");
    assert.deepEqual(
        host.commands.filter((command) => command.includes("/bin/mv") ||
            command.includes("/bin/cp")),
        [],
        "nothing was renamed or copied"
    );
});

function recovered(host) {
    return [...host.files].filter((file) => file.includes("recovered"));
}

test("another writer's file at the output name is never written to", () => {
    // The name has to be taken before anything is written to it, and taking
    // it is what fails. What used to happen instead: the rename declined,
    // which was right, the inspection that would have said so could not be
    // made, and the run took that for a publication -- reporting their
    // document as ours and deleting both copies of the real one.
    const host = createFakeHost({
        files: ["/a/staged-1.jpg", "/a/photo_stamped.jpg"],
        failures: [
            ["/bin/ln", new Error(DENIED)],
            ["test' '-e' '/a/photo_stamped.jpg' '-o'", new Error("test failed")],
            ["test' '-e' '/a/.StampImages", new Error(DENIED)]
        ]
    });
    const job = makeJob(host);

    host.sizes.set("/a/photo_stamped.jpg", 4096);

    assert.throws(() => publishImage(job, "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"), (error) => {
        assert.match(error.message, /the output name could not be created in one step/u);

        return true;
    });
    assert.equal(host.sizes.get("/a/photo_stamped.jpg"), 4096, "their file is untouched");
    assert.equal(recovered(host).length, 1, "and ours was kept");
});

// A destination that can do neither a hard link nor an exclusive rename,
// which is what exFAT measurably is: there is nowhere further to go, so
// publication stops and the copy is kept.
function withoutExclusiveRename(settings) {
    const host = createFakeHost(settings);

    host.renamer = { rename: () => false };

    return host;
}

test("a name taken while the copy was being made is not renamed over", () => {
    // A copy takes time, and the name it was headed for can be claimed by
    // something else in the meantime. The rename would replace it; the check
    // that decides between them has to be made when the claim fails, not
    // when publication started.
    let asked = 0;
    const host = withoutExclusiveRename({
        files: ["/a/staged-1.jpg"],
        failures: [
            [DIRECT_CLAIM, new Error(DENIED)],
            ["ln' '/a/.StampImages", new Error(DENIED)],
            ["test' '-e' '/a/photo_stamped.jpg' '-o'", () => {
                asked += 1;

                // Free when the name was chosen, taken by the time the claim
                // came to be made.
                return asked > 1 ? "" : new Error("test failed");
            }]
        ]
    });

    assert.throws(() => publishImage(makeJob(host), "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"), (error) => {
        assert.match(error.message, /the output path was taken/u);

        return true;
    });
    assert.deepEqual(
        host.commands.filter((command) => command.includes("/bin/mv") &&
            command.includes("'/a/photo_stamped.jpg'")),
        [],
        "nothing renamed over it"
    );
    assert.deepEqual(
        [...host.files].filter((file) => file.includes(".StampImages")),
        [],
        "and the copy this run made is gone"
    );
});
