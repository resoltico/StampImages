"use strict";

/*
 * What a headless caller is told.
 *
 * osascript carries one thing back: the returned value on success, the error
 * on failure. An incomplete run has to be both, so the receipt goes out on
 * its own and then the run fails.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { report, reportHeadless } = require("../../../src/runtime/reporting.js");
const { createFakeApp } = require("./fake-app.cjs");

const FAILED = { name: "two.jpg", message: "vips would not read it", command: "" };

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

test("a headless run that honoured the request answers with the receipt", () => {
    const receipt = JSON.parse(report(createFakeApp(), result(), true));

    assert.deepEqual(receipt.outputs, ["/a/one_stamped.jpg"]);
    assert.deepEqual(receipt.ledger, {
        stamped: 1,
        failed: 0,
        nothing: 0,
        rejected: 0,
        notAttempted: 0
    });
});

test("a headless run that fell short writes the receipt and then fails", () => {
    // osascript carries the value or the error, and a caller needs both: the
    // receipt goes out on its own, newline terminated, and then the run fails.
    const written = [];
    const incomplete = result({ failures: [FAILED], requested: 2 });

    assert.throws(
        () => reportHeadless(incomplete, (line) => written.push(line)),
        /not completely honoured: 1 of 2 stamped, 1 failed\./u
    );
    assert.equal(written.length, 1);
    assert.match(written[0], /"ledger":\{"stamped":1,"failed":1/u);
    assert.ok(written[0].endsWith("\n"), "a caller reads it a line at a time");
});

test("a headless run that honoured everything writes nothing of its own", () => {
    // The receipt is the value osascript prints; writing it as well would
    // print it twice.
    const written = [];

    reportHeadless(result(), (line) => written.push(line));
    assert.deepEqual(written, []);
});
