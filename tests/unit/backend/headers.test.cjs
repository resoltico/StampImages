"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildHeaderArgv, buildFieldArgv, headerGroups } = require("../../../src/backend/headers.js");

test("header commands preserve complete paths and field requests", () => {
    assert.deepEqual(buildHeaderArgv("header", ["/a b.png", "/c.jpg"]), ["header", "-a", "/a b.png", "/c.jpg"]);
    assert.deepEqual(buildFieldArgv("header", "orientation", ["/a b.png"]), ["header", "-f", "orientation", "/a b.png"]);
});

test("ordinary paths share a batch, while newline/CR names are isolated", () => {
    assert.deepEqual(headerGroups("header", []), []);
    assert.deepEqual(headerGroups("header", ["/a.png", "/b.jpg"]), [["/a.png", "/b.jpg"]]);
    assert.deepEqual(headerGroups("header", ["/a.png", "/new\nline.png", "/new\rline.jpg", "/b.jpg"]), [["/a.png"], ["/new\nline.png"], ["/new\rline.jpg"], ["/b.jpg"]]);
    assert.deepEqual(headerGroups("header", ["/new\nline.png"]), [["/new\nline.png"]]);
});

test("header budgeting covers optional-field prefixes and refuses an oversized argument", () => {
    assert.throws(() => headerGroups("header", ["/a.png"], 1), /exceeds the command budget/u);
    // Quoted `header -f icc-profile-data` costs 32 bytes before path separators;
    // each quoted /a.png argument plus its joining space costs 9. One fits in 42; two do not.
    assert.deepEqual(headerGroups("header", ["/a.png", "/b.png"], 42), [["/a.png"], ["/b.png"]]);
});

test("a command exactly at the byte budget stays grouped and one oversized path is refused", () => {
    assert.deepEqual(headerGroups("header", ["/a.png", "/b.png"], 51), [["/a.png", "/b.png"]]);
    assert.throws(() => headerGroups("header", ["/long.png"], 42), /exceeds/u);
});

test("exact header byte budgets accept equality without introducing empty groups", () => {
    // Prefix "'header' '-f' 'icc-profile-data'" is 32 ASCII bytes; each joined quoted path adds nine.
    assert.deepEqual(headerGroups("header", ["/a.png"], 41), [["/a.png"]]);
    assert.deepEqual(headerGroups("header", ["/a.png", "/b.png"], 50), [["/a.png", "/b.png"]]);
    assert.deepEqual(headerGroups("header", ["/a.png", "/b.png"], 49), [["/a.png"], ["/b.png"]]);
});

test("header groups respect literal complete-command byte lengths including separators", () => {
    const { Buffer } = require("node:buffer");
    assert.throws(() => headerGroups("header", ["/a.png"], 40), /exceeds/u);
    const groups = headerGroups("header", ["/a.png", "/b.png"], 49);
    assert.deepEqual(groups, [["/a.png"], ["/b.png"]]);
    for (const group of groups) {
        const literal = `'header' '-f' 'icc-profile-data' ${  group.map((path) => `'${path}'`).join(" ")}`;
        assert.ok(Buffer.byteLength(literal, "utf8") <= 49);
    }
});
