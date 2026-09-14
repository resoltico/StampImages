"use strict";

/*
 * Nothing to stamp, which is a different message depending on whether anything
 * was asked for. Selecting only a text file is not the same as selecting
 * nothing, and saying "no photographs selected" to somebody who selected one
 * is how a rejection becomes invisible.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    reportNothing,
    describeNothing
} = require("../../../src/runtime/reporting.js");
const { createFakeApp } = require("./fake-app.cjs");

const REJECTED = { name: "notes.txt", reason: "not a supported format" };

test("nothing selected at all says what would have been accepted", () => {
    const message = describeNothing([]);

    assert.match(message, /No photographs selected/u);
    assert.match(message, /JPEG, PNG, HEIC, TIFF, WebP or AVIF/u);
    assert.match(
        message,
        /or a folder containing them/u,
        "a folder is a selection too, and saying so saves a second try"
    );
});

test("nothing usable is a different message from nothing selected", () => {
    // Selecting only a text file is not the same as selecting nothing, and
    // saying "no photographs selected" is how a rejection becomes invisible.
    const message = describeNothing([REJECTED]);

    assert.match(message, /^Nothing to stamp\./u);
    assert.match(message, /notes\.txt: not a supported format/u);
});

test("a person is shown that message, and a caller is given it to fail on", () => {
    const app = createFakeApp();

    assert.equal(reportNothing(app, false, []), undefined);
    assert.match(app.dialogs[0].message, /No photographs selected/u);
    assert.throws(
        () => reportNothing(createFakeApp(), true, [REJECTED]),
        /Nothing to stamp/u
    );
});
