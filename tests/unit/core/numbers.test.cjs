"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    utf8Length,
    truncateToBytes,
    parseInteger,
    plural,
    zeroPad,
    formatDuration
} = require("../../../src/core/numbers.js");

test("parseInteger accepts whole numbers inside the range", () => {
    assert.equal(parseInteger(8, 8, 400, "Text size"), 8);
    assert.equal(parseInteger(400, 8, 400, "Text size"), 400);
    assert.equal(parseInteger("36", 8, 400, "Text size"), 36);
});

test("parseInteger rejects anything else", () => {
    for (const invalid of [7, 401, 36.5, "x", Infinity, NaN, null]) {
        assert.throws(
            () => parseInteger(invalid, 8, 400, "Text size"),
            /Text size must be a whole number from 8 to 400/u,
            `expected ${String(invalid)} to be rejected`
        );
    }
});

test("zeroPad pads to width and never truncates", () => {
    assert.equal(zeroPad(1, 6), "000001");
    assert.equal(zeroPad(123456, 6), "123456");
    assert.equal(zeroPad(1234567, 6), "1234567");
});

test("formatDuration reads naturally at each scale", () => {
    assert.equal(formatDuration(-1), "0 second(s)");
    assert.equal(formatDuration(0), "0 second(s)");
    assert.equal(formatDuration(1499), "1 second(s)");
    assert.equal(formatDuration(61000), "1 minute(s), 1 second(s)");
    assert.equal(formatDuration(3600000), "60 minute(s), 0 second(s)");
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

test("a string is measured in the bytes a command line is measured in", () => {
    // String length counts UTF-16 code units: an accented letter is one unit
    // and two bytes, and anything above the basic plane is two units and four
    // bytes. A budget named in bytes and spent in units is about nothing.
    for (const [text, bytes] of [
        ["", 0],
        ["plain.jpg", 9],
        ["wörk", 5],
        ["日本語", 9],
        ["📁", 4],
        ["/tmp/wörk shop 📁/page_000001.jpg", 36],
        // The first character of each width, where a table that compared one
        // step wrong would under-count by a byte.
        ["\u0080", 2],
        ["\u0800", 3],
        ["\u{10000}", 4]
    ]) {
        assert.equal(utf8Length(text), bytes, JSON.stringify(text));
    }
});

test("a text that exactly fills its budget is kept whole", () => {
    // The bound is "fits", not "nearly fits": cutting a character off a name
    // that was exactly long enough is a name nobody asked for.
    assert.equal(truncateToBytes("abcde", 5), "abcde");
    assert.equal(truncateToBytes("abcde", 4), "abcd");
    assert.equal(truncateToBytes("wörk", 5), "wörk", "counted in bytes");
    assert.equal(truncateToBytes("wörk", 4), "wör", "four bytes is w, ö and r");
    assert.equal(truncateToBytes("wörk", 2), "w", "and never half a letter");
    assert.equal(truncateToBytes("📁📁", 4), "📁");
    assert.equal(truncateToBytes("abc", 0), "");
});
