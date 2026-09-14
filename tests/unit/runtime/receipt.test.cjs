"use strict";

/*
 * The machine-readable outcome of a headless run.
 *
 * A caller needs two things that cannot travel on the same channel: the
 * receipt, and an exit status that says whether the request was honoured.
 * osascript returns the script's value on success and its error on failure, so
 * an incomplete run writes the receipt itself and then fails.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    foundation,
    writeReceipt,
    isCompleteSuccess
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

test("a run is complete when every photograph asked for came back", () => {
    assert.equal(isCompleteSuccess(result()), true);
    assert.equal(isCompleteSuccess(result({ outputs: [], requested: 0 })), true);
});

test("a photograph that failed is one that did not come back", () => {
    assert.equal(
        isCompleteSuccess(result({
            failures: [{ name: "b.png", message: "broke", command: "" }],
            requested: 2
        })),
        false
    );
});

test("a file rejected before any work is one that did not come back", () => {
    assert.equal(
        isCompleteSuccess(result({
            rejected: [{ name: "notes.txt", reason: "not a supported format" }],
            requested: 2
        })),
        false
    );
});

test("a run somebody stopped half way is not a success either", () => {
    // Stated as one count against another rather than as a list of the ways a
    // run can fall short, so a way nobody thought of here is still caught.
    assert.equal(
        isCompleteSuccess(result({ stopped: true, requested: 4 })),
        false
    );
});



test("the receipt goes to standard output, as UTF-8", () => {
    const written = [];
    const ns = (text) => ({
        dataUsingEncoding: (encoding) => ({ text, encoding })
    });

    ns.NSFileHandle = {
        fileHandleWithStandardOutput: { writeData: (data) => written.push(data) }
    };

    assert.equal(writeReceipt('{"outputs":[]}\n', ns), true);
    assert.deepEqual(written, [{ text: '{"outputs":[]}\n', encoding: 4 }]);
});

test("a caller is never told a receipt exists when it does not", () => {
    assert.equal(writeReceipt("anything", null), false);
});

test("a bridge that will not load Foundation is no namespace", () => {
    assert.equal(foundation({ import: () => null }, null), null);
    assert.equal(
        foundation({
            import: () => {
                throw new Error("no Foundation");
            }
        }, {}),
        null
    );
});

test("a bridge that loads Foundation is the namespace to write through", () => {
    const ns = () => null;

    assert.equal(foundation({ import: () => null }, ns), ns);
});
