"use strict";

/*
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
    describe,
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

const FAILED = { name: "two.jpg", message: "vips would not read it", command: "" };
const REJECTED = { name: "notes.txt", reason: "not a supported format" };
const NOTHING = { name: "scan.png", reason: "it does not say when it was taken" };

test("a run that did everything says so in one sentence", () => {
    assert.equal(describe(result()), "1 photograph stamped.");
    assert.equal(
        describe(result({ outputs: ["/a/1.jpg", "/a/2.jpg"], requested: 2 })),
        "2 photographs stamped."
    );
});

test("one photograph is one photograph, not 1 photographs", () => {
    assert.match(describe(result()), /^1 photograph /u);
});

test("what did not work is counted in the same sentence", () => {
    assert.equal(
        describe(result({ failures: [FAILED], rejected: [REJECTED], requested: 3 })),
        "1 photograph stamped, and 2 not."
    );
});

test("a photograph nobody could have stamped is counted with the rest", () => {
    assert.equal(
        describe(result({ nothing: [NOTHING], requested: 2 })),
        "1 photograph stamped, and 1 not."
    );
});

test("a run somebody stopped counts what it never reached", () => {
    // It used to say how many it had saved and nothing about the rest, so a
    // batch of two hundred stopped after one read as a batch of one.
    assert.equal(
        describe(result({ stopped: true, requested: 200 })),
        "Stopped.\n\n1 photograph stamped, and 199 not."
    );
});

test("a run somebody stopped says so before it says what it did", () => {
    assert.match(describe(result({ stopped: true })), /^Stopped\.\n\n1 photograph/u);
});

test("each photograph that did not work is named, with the reason", () => {
    const detail = detailOf(result({
        failures: [FAILED],
        nothing: [NOTHING],
        rejected: [REJECTED]
    }));

    assert.match(detail, /two\.jpg: vips would not read it/u);
    assert.match(detail, /scan\.png: it does not say when it was taken/u);
    assert.match(detail, /notes\.txt: not a supported format/u);
});

test("a margin that could not be honoured is said once, for the run", () => {
    // Not per photograph: it is one fact about the settings, and a hundred
    // copies of it would bury the failures underneath.
    const detail = detailOf(result({ crowded: 3 }));

    assert.match(detail, /^\n\n3 photographs had too little room for the margin/u);
});

test("a run with nothing to explain explains nothing", () => {
    assert.equal(detailOf(result()), "");
});

test("a person gets a dialog and nothing back", () => {
    // Nothing back on purpose. A Quick Action's result is the shortcut's
    // result, and Shortcuts writes a text result out as a file: a run of five
    // photographs left five ":Users:erst:Downloads:IMG_1538_stamped.txt"
    // beside them, each holding the path of a copy. The person has been told
    // in the dialog; there is nothing left to hand back.
    const app = createFakeApp();

    assert.equal(
        report(app, result({ failures: [FAILED], requested: 2 }), false),
        undefined
    );
    assert.equal(app.dialogs.length, 1);
    assert.match(app.dialogs[0].message, /1 photograph stamped, and 1 not\./u);
    assert.match(app.dialogs[0].message, /two\.jpg: /u);
});

test("a report is a notice, not a question", () => {
    // Without the button set macOS supplies a Cancel, and there is nothing
    // here to cancel; an untitled dialog does not say which action produced it.
    const app = createFakeApp();

    report(app, result(), false);
    assert.deepEqual(app.dialogs[0].options, {
        withTitle: "Stamp Images",
        buttons: ["OK"],
        defaultButton: "OK"
    });
});

test("what a walk left alone is said, and is not held against the run", () => {
    const detail = detailOf(result({
        excluded: [{ name: "a_stamped.jpg", reason: "already a stamped copy" }]
    }));

    assert.match(detail, /Left alone: 1 stamped copy from an earlier run/u);
});

test("a colour that could not be moved is said too", () => {
    assert.match(
        detailOf(result({ unconverted: 2 })),
        /2 photographs carried a colour profile/u
    );
});
