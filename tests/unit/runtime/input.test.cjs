"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    inputItemToPosixPath,
    collectInvocation
} = require("../../../src/runtime/input.js");
const { createFakeApp } = require("./fake-app.cjs");

/*
 * Turning a selected item into a path, or deciding it is not one.
 */

test("a POSIX path is used as-is", () => {
    assert.equal(inputItemToPosixPath("/a/b.png"), "/a/b.png");
});

test("a file URL is decoded to a POSIX path", () => {
    assert.equal(inputItemToPosixPath("file:///a/b%20c.png"), "/a/b c.png");
});

test("an item that is not a path resolves to nothing", () => {
    // Not an error: Shortcuts appends a parameters object to every Quick
    // Action input, so this is the ordinary case, and one unrecognisable item
    // must not discard the images beside it.
    assert.equal(inputItemToPosixPath("not-a-path"), "");
    assert.equal(inputItemToPosixPath({}), "");
    assert.equal(inputItemToPosixPath(""), "");
});

test("valid JSON is not yet a configuration", () => {
    // `null`, `false`, `0`, a bare string and a list all parse, and asking any
    // of them for a setting fails somewhere further along in words about the
    // failure rather than about the file.
    for (const text of ["null", "false", "0", '"words"', "[]", "[{}]"]) {
        const app = createFakeApp();

        app.textFiles = { "/a/settings.json": text };

        assert.throws(
            () => collectInvocation(
                app,
                ["--headless", "/a/settings.json", "/a/one.jpg"],
                true
            ),
            /must be a JSON object of settings/u,
            text
        );
    }
});
