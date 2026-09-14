"use strict";

/*
 * What a value may be made of, before anything asks what it means.
 *
 * A headless configuration is JSON, and JSON has lists and objects and true
 * in it. Read by coercion, every one of them is a value: `[36]` is a text
 * size of 36, `true` is an outline a pixel wide, and `{}` is the caption
 * "[object Object]" -- which somebody would have found on their photographs.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { readNumeric, readWords } = require("../../../src/core/reading.js");

test("a number is a number, or text that is one", () => {
    assert.equal(readNumeric(36, "Text size"), 36);
    assert.equal(readNumeric("36", "Text size"), "36");
    assert.equal(readNumeric(0, "Margin"), 0);
});

test("anything else is not a number, and says which setting it was not", () => {
    for (const value of [[36], true, false, null, undefined, {}, [], () => 36]) {
        assert.throws(
            () => readNumeric(value, "Text size"),
            /^Error: Text size must be a number\.$/u,
            JSON.stringify(value) ?? String(value)
        );
    }
});

test("text is text", () => {
    assert.equal(readWords("Riga", "Your own text"), "Riga");
    assert.equal(readWords("", "Your own text"), "");
});

test("anything else is not text, however readily it would print", () => {
    for (const value of [["a"], {}, 36, true, null, undefined, []]) {
        assert.throws(
            () => readWords(value, "Your own text"),
            /^Error: Your own text must be text\.$/u,
            JSON.stringify(value) ?? String(value)
        );
    }
});
