"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { parseInteger, zeroPad } = require("../../../src/core/numbers.js");

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
