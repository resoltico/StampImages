"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { basename, dirname, fileStem, sanitizeFilename } = require("../../../src/core/paths.js");

const NUL = String.fromCharCode(0);
const DEL = String.fromCharCode(127);

test("basename and dirname split a POSIX path", () => {
    assert.equal(basename("/a/b/c.png"), "c.png");
    assert.equal(basename("c.png"), "c.png");
    assert.equal(basename("/a/b/"), "b");
    assert.equal(dirname("/a/b/c.png"), "/a/b/");
    assert.equal(dirname("c.png"), "");
});

test("fileStem keeps a leading dot but drops the last extension", () => {
    assert.equal(fileStem(".hidden"), ".hidden");
    assert.equal(fileStem("archive.part.png"), "archive.part");
    assert.equal(fileStem("noextension"), "noextension");
});

test("sanitizeFilename preserves Unicode and strips separators", () => {
    assert.equal(sanitizeFilename("  A:B/C  "), "A_B_C");
    assert.equal(sanitizeFilename("Žalioji byla"), "Žalioji byla");
    assert.equal(sanitizeFilename("/leading"), "leading");
});

test("sanitizeFilename never yields an empty or edge-padded name", () => {
    assert.equal(sanitizeFilename(".."), "image");
    assert.equal(sanitizeFilename(" "), "image");
    assert.equal(sanitizeFilename(""), "image");
    assert.equal(sanitizeFilename(NUL + DEL), "image");
    // A name that begins or ends in whitespace is confusing on disk.
    assert.equal(sanitizeFilename("_ a _"), "a");
});

test("basename and dirname handle a path at the filesystem root", () => {
    // The separator is at index 0 here, so a `> 0` test would miss it.
    assert.equal(basename("/file.png"), "file.png");
    assert.equal(dirname("/file.png"), "/");
});

test("basename ignores any number of trailing separators", () => {
    assert.equal(basename("/a/b//"), "b");
    assert.equal(basename("/a/b///"), "b");
});

test("sanitizeFilename strips dots at both ends, however many", () => {
    assert.equal(sanitizeFilename("..name.."), "name");
    assert.equal(sanitizeFilename(".name"), "name");
    assert.equal(sanitizeFilename("name."), "name");
    assert.equal(sanitizeFilename("a.b"), "a.b", "an interior dot must survive");
});

test("sanitizeFilename collapses runs of underscores, not single ones", () => {
    assert.equal(sanitizeFilename("a___b"), "a_b");
    assert.equal(sanitizeFilename("a_b"), "a_b");
});
