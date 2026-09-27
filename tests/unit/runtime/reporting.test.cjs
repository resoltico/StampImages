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

test("a run that did everything says what it made and where", () => {
    assert.equal(describe(result()), "Created 1 stamped copy.\nSaved to: /a/");
    assert.equal(
        describe(result({ outputs: ["/a/1.jpg", "/a/2.jpg"], requested: 2 })),
        "Created 2 stamped copies.\nSaved to: /a/"
    );
});

test("one photograph is one photograph, not 1 photographs", () => {
    assert.match(describe(result()), /^Created 1 stamped copy\./u);
});

test("each photograph that did not work is named, with the reason", () => {
    const detail = detailOf(result({
        failures: [FAILED],
        nothing: [NOTHING],
        rejected: [REJECTED]
    }));

    assert.equal(detail, [
        "",
        "Could not stamp 1 image:\ntwo.jpg: vips would not read it",
        "No copy, because there was nothing to stamp:\nscan.png: it does not say when it was taken",
        "Not included from your selection:\nnotes.txt: not a supported format"
    ].join("\n\n"));
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
    assert.match(app.dialogs[0].message, /^Finished with errors\.\n\nCreated 1 stamped copy\.\nSaved to: \/a\/\n\n/u);
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
