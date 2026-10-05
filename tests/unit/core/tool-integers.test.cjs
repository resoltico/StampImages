"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { positiveIntegerFrom } = require("../../../src/core/numbers.js");

test("tool counts are complete positive decimal integers", () => {
    for (const [text, value] of [["1", 1], [" 42\n", 42], ["001", 1], ["9007199254740991", Number.MAX_SAFE_INTEGER]]) {
        assert.equal(positiveIntegerFrom(text), value);
    }
    for (const text of ["", " ", "0", "-1", "+1", "2junk", "1.5", "1e2", "Infinity", "NaN", "9007199254740992"]) {
        assert.equal(positiveIntegerFrom(text), 0, text);
    }
});
