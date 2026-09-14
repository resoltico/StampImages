"use strict";

/*
 * Where every photograph that was asked for ended up.
 *
 * Five columns, and they add up to the request or the ledger has lost
 * something. The last of them is the one a report without it cannot state: a
 * run somebody stopped said how many it had saved and nothing about the rest.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    ledgerOf,
    describeIncomplete
} = require("../../../src/runtime/receipt.js");

function result(overrides = {}) {
    return {
        outputs: ["/a/one_stamped.jpg"],
        failures: [],
        nothing: [],
        rejected: [],
        requested: 1,
        ...overrides
    };
}

test("the reason names every count that is not zero", () => {
    const reason = describeIncomplete(result({
        failures: [{ name: "b.png", message: "broke", command: "" }],
        nothing: [{ name: "c.png", reason: "it does not say when" }],
        rejected: [{ name: "notes.txt", reason: "not a supported format" }],
        requested: 6
    }));

    assert.match(reason, /1 of 6 stamped/u);
    assert.match(reason, /1 failed/u);
    assert.match(reason, /1 with nothing to stamp/u);
    assert.match(reason, /1 not usable/u);
    assert.match(reason, /2 not attempted/u);
});

test("a column with nothing in it is not named", () => {
    // A run of one photograph that failed should not have to be read past
    // three zeroes to find out.
    const reason = describeIncomplete(result({
        outputs: [],
        failures: [{ name: "b.png", message: "broke", command: "" }]
    }));

    assert.equal(
        reason,
        "The request was not completely honoured: 0 of 1 stamped, 1 failed."
    );
});

test("the ledger accounts for every photograph that was asked for", () => {
    // A run somebody stopped said how many it had saved and nothing about the
    // rest, so a batch of two hundred stopped after three read as three.
    assert.deepEqual(ledgerOf(result({ requested: 10, stopped: true })), {
        stamped: 1,
        failed: 0,
        nothing: 0,
        rejected: 0,
        notAttempted: 9
    });
});

test("the counts are readable as a list, not run together", () => {
    const reason = describeIncomplete(result({
        outputs: [],
        rejected: [{ name: "x", reason: "y" }]
    }));

    assert.match(reason, /^The request was not completely honoured: /u);
    assert.match(reason, /\.$/u);
});
