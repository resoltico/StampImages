"use strict";

/*
 * The paragraph a person reads first when a run is over: what was made, where
 * it went, and -- for a run that fell short or was stopped -- that it did.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { describe } = require("../../../src/runtime/completion.js");

function result(overrides = {}) {
    return {
        outputs: ["/a/one_stamped.jpg"],
        failures: [],
        nothing: [],
        rejected: [],
        excluded: [],
        crowded: 0,
        unconverted: 0,
        requested: 1,
        ...overrides
    };
}

const FAILED = { name: "two.jpg", message: "vips would not read it", command: "" };
const REJECTED = { name: "notes.txt", reason: "not a supported format" };
const NOTHING = { name: "scan.png", reason: "it does not say when it was taken" };

test("copies spread across folders name every folder, one per line", () => {
    assert.equal(
        describe(result({ outputs: ["/a/1.jpg", "/b/2.jpg", "/a/3.jpg"], requested: 3 })),
        "Created 3 stamped copies.\nSaved to: 2 folders:\n/a/\n/b/"
    );
});

test("a failure is announced first; a refusal is not a failure", () => {
    assert.equal(
        describe(result({ failures: [FAILED], requested: 2 })),
        "Finished with errors.\n\nCreated 1 stamped copy.\nSaved to: /a/"
    );
    assert.equal(
        describe(result({ rejected: [REJECTED], nothing: [NOTHING], requested: 3 })),
        "Created 1 stamped copy.\nSaved to: /a/"
    );
});

test("a run that made nothing says so, and names no folder", () => {
    assert.equal(
        describe(result({ outputs: [], failures: [FAILED] })),
        "Finished with errors.\n\nNo stamped copy was created."
    );
});

test("a run somebody stopped counts what it never reached", () => {
    // It used to say how many it had saved and nothing about the rest, so a
    // batch of two hundred stopped after one read as a batch of one.
    assert.equal(
        describe(result({ stopped: true, requested: 200 })),
        "Created 1 stamped copy.\nStopped. 199 images not stamped.\nSaved to: /a/"
    );
});

test("a stop does not count selected items that were never images", () => {
    assert.match(
        describe(result({ stopped: true, rejected: [REJECTED], requested: 3 })),
        /Stopped\. 1 image not stamped\./u
    );
});
