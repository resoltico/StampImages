"use strict";

/*
 * How the probes are run, rather than what they ask.
 *
 * Each one is expected to fail -- they name a file that cannot exist -- so the
 * output has to be readable rather than recovered from a thrown error, and no
 * question asked here may be able to fail the run on its own.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { checkTools } = require("../../../src/runtime/preflight.js");
const { createFakeApp } = require("./fake-app.cjs");

test("a probe is asked for its output, whether it succeeded or not", () => {
    // The probes are expected to fail: they name a file that cannot exist.
    // Merging stderr and forcing a zero exit is what lets the output be read
    // instead of recovered from a thrown error.
    const app = createFakeApp();

    checkTools(app);

    const probes = app.commands.filter(
        (command) => command.includes("nonexistent-stamp-images-preflight")
    );

    assert.equal(probes.length, 1);
    assert.ok(probes[0].endsWith(" 2>&1 || true"), probes[0]);
});

test("Homebrew is asked about in a way that cannot fail the run", () => {
    const app = createFakeApp({ installed: [] });

    assert.throws(() => checkTools(app), /brew install/u);
    assert.ok(app.commands.some(
        (command) => command === "command -v brew 2>/dev/null || true"
    ));
});

test("a host that refuses to run anything is a machine with nothing on it", () => {
    // Every question here is asked of a shell, and a host that will not run
    // one has answered all of them.
    const app = createFakeApp();

    app.doShellScript = () => {
        throw new Error("not permitted");
    };

    assert.throws(() => checkTools(app), (error) => {
        assert.match(error.message, /Setup needed/u);
        assert.match(error.message, /Install Homebrew first/u);

        return true;
    });
});
