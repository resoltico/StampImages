"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { plural, formatDuration } = require("../../../src/core/formatting.js");

test("formatDuration reads naturally at each scale", () => {
    assert.equal(formatDuration(-1), "0 seconds");
    assert.equal(formatDuration(0), "0 seconds");
    assert.equal(formatDuration(1499), "1 second");
    assert.equal(formatDuration(2500), "3 seconds");
    assert.equal(formatDuration(61000), "1 minute, 1 second");
    assert.equal(formatDuration(3600000), "60 minutes, 0 seconds");
});

test("plural says one thing in the singular", () => {
    // "1 PDFs" is exactly the sloppiness the "(s)" placeholder was replaced to
    // avoid, so the singular case has to be pinned.
    assert.equal(plural(1, "photograph"), "1 photograph");
    assert.equal(plural(1, "image"), "1 image");
    assert.equal(plural(0, "photograph"), "0 photographs");
    assert.equal(plural(2, "photograph"), "2 photographs");
});

test("plural accepts an irregular plural", () => {
    assert.equal(plural(1, "entry", "entries"), "1 entry");
    assert.equal(plural(3, "entry", "entries"), "3 entries");
});
