"use strict";

/*
 * What a run says once for the whole of it, rather than per photograph.
 * What a run says when it is over, to the two readers who cannot be told the
 * same way: a person gets a sentence, and a caller reading standard output
 * gets the whole outcome as data.
 *
 * Every photograph that was asked for is in exactly one place in it. A count
 * that does not add up is a report that lost something.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    report,
    detailOf
} = require("../../../src/runtime/reporting.js");
const { createFakeApp } = require("./fake-app.cjs");

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


test("a colour that could not be moved is said too", () => {
    assert.match(
        detailOf(result({ unconverted: 2 })),
        /2 photographs carried a colour profile/u
    );
});

test("a run that had to read photographs into colour says how many", () => {
    const app = createFakeApp();

    report(app, result({ expanded: 2, requested: 2 }), false);

    assert.match(app.dialogs[0].message, /stored its greys only/u);
});
