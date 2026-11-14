"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { utf8Length, truncateToBytes } = require("../../../src/core/utf8.js");

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
