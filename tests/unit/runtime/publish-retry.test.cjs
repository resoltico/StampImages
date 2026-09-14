"use strict";

/*
 * Why a name was not created, and whether another one would answer it.
 *
 * Something else standing at the name is the one refusal a second name fixes.
 * A filesystem that cannot create the name at all is not, and trying again
 * would only be the same refusal twice.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { deliver } = require("../../../src/runtime/transfer.js");
const { publishImage } = require("../../../src/runtime/publish.js");
const { createFakeHost } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");

const FACTS = { identity: "1:2", size: 1024 };
const DENIED = "Operation not permitted";
const DIRECT_CLAIM = "ln' '/a/staged-1.jpg'";

function withoutExclusiveRename(settings) {
    const host = createFakeHost(settings);

    host.renamer = { rename: () => false };

    return host;
}

test("a refusal says whether another name would answer it", () => {
    // Something else at the name is the one refusal a second name fixes; a
    // filesystem that cannot make the name at all is not.
    const taken = createFakeHost({ files: ["/a/staged-1.jpg", "/a/theirs.jpg"] });

    assert.equal(
        deliver(taken, { staged: "/a/staged-1.jpg", final: "/a/theirs.jpg" }, FACTS).taken,
        true
    );

    const refusing = withoutExclusiveRename({
        files: ["/a/staged-1.jpg"],
        failures: [[DIRECT_CLAIM, new Error(DENIED)], ["ln' '/a/.StampImages", new Error(DENIED)]]
    });

    assert.equal(
        deliver(
            refusing,
            { staged: "/a/staged-1.jpg", area: { directory: "/a/.StampImages-x", file: "/a/.StampImages-x/ready.jpg" }, final: "/a/photo_stamped.jpg" },
            FACTS,
            refusing.renamer
        ).taken,
        false
    );
});

test("a refusal another name cannot answer is not tried again", () => {
    // A filesystem that can make neither the link nor the exclusive rename is
    // not a race to wait out: trying a second name would be the same refusal
    // twice, and the copy is set aside instead.
    const host = withoutExclusiveRename({
        files: ["/a/staged-1.jpg"],
        failures: [
            [DIRECT_CLAIM, new Error(DENIED)],
            ["ln' '/a/.StampImages", new Error(DENIED)]
        ]
    });

    assert.throws(
        () => publishImage(makeJob(host), "/a/staged-1.jpg", () => "/a/photo_stamped.jpg"),
        /could not be created in one step/u
    );
    assert.equal(
        host.commands.filter((command) => command.includes("'/bin/ln' '/a/staged-1.jpg'")).length,
        1,
        "one attempt, because another name would fail the same way"
    );
});

test("a copy that cannot be measured is not published, and is kept", () => {
    const host = createFakeHost({ files: ["/a/staged-1.jpg"] });

    host.sizes.set("/a/staged-1.jpg", 0);

    assert.throws(
        () => publishImage(
            makeJob(host),
            "/a/absent-1.jpg",
            () => "/a/photo_stamped.jpg"
        ),
        /could not be measured/u
    );
});
