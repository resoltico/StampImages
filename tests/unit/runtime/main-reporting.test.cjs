"use strict";

/*
 * How a run answers the host, and how it fails.
 *
 * The two callers are not alike. A person gets a dialog and no answer at all;
 * a headless caller gets the error raised, because there is nobody there to
 * read a dialog and a caller that was told nothing would think it worked.
 *
 * No answer at all rather than an empty one, because the host does something
 * with an answer: a Quick Action's result is the shortcut's result, and
 * Shortcuts writes a text result out as a file beside the photographs.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { run } = require("../../../src/runtime/main.js");
const { createFakeApp } = require("./fake-app.cjs");

const TOOLS = [
    "/opt/homebrew/bin/vips",
    "/opt/homebrew/bin/vipsheader",
    "/opt/homebrew/bin/exiftool"
];

function machine(settings = {}) {
    return Object.assign(createFakeApp(), { installed: TOOLS, ...settings });
}

test("run answers the host with nothing, and shows a failure rather than throwing it", () => {
    const app = machine({ installed: [] });

    globalThis.Application = { currentApplication: () => app };

    assert.equal(run(["/a/one.png"], {}), undefined);
    assert.equal(app.dialogs.length, 1);
    assert.match(app.dialogs[0].message, /Setup needed/u);
    assert.deepEqual(app.dialogs[0].options, {
        withTitle: "Stamp Images",
        buttons: ["OK"],
        defaultButton: "OK"
    });
    assert.equal(app.includeStandardAdditions, true);
});

test("a headless failure is raised, because nobody is there to read a dialog", () => {
    const app = machine({ installed: [] });

    globalThis.Application = { currentApplication: () => app };

    assert.throws(() => run(["--headless", "/a/one.png"], {}), (error) => {
        assert.match(error.message, /Setup needed/u);
        // The failing command travels with it, which is what a log is for.
        assert.ok(error.cause, "the original error is carried, not flattened");

        return true;
    });
    assert.equal(app.dialogs.length, 0);
});
