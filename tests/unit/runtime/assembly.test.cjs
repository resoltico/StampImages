"use strict";

/*
 * Everything a run needs before it can stamp anything, in the order the
 * answers depend on each other: which faces this Mac has, then what the person
 * wants drawn with them, then the job that carries both.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { withWorkspace, assemble } = require("../../../src/runtime/assembly.js");
const { defaultSettings } = require("../../../src/core/form-defaults.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");

function recorder() {
    const said = [];

    return {
        said,
        stopped: () => false,
        expect: () => undefined,
        beginning: () => undefined,
        phase: (text) => said.push(text),
        finished: () => undefined,
        pause: () => said.push("pause"),
        close: () => said.push("close")
    };
}

function prepared(host, headless = false) {
    return {
        app: host,
        tools: {
            vips: "/opt/homebrew/bin/vips",
            vipsheader: "/opt/homebrew/bin/vipsheader",
            exiftool: "/opt/homebrew/bin/exiftool"
        },
        invocation: { headless, settings: null },
        selection: { images: [{}, {}], rejected: [] }
    };
}

function place(progress, unpublished = new Set()) {
    return { workspace: WORKSPACE, unpublished, progress };
}

test("the fonts are probed, and the report says so before the wait", () => {
    // Every candidate is drawn with rather than looked up, which is the
    // longest thing a run does before it says anything.
    const host = createFakeHost({ fonts: ["Menlo"] });
    const progress = recorder();

    assemble(prepared(host), place(progress));
    assert.ok(progress.said.includes("Checking which fonts are installed"));
});

test("the report is paused before a question is asked", () => {
    // A panel at the floating window level would otherwise sit over the form,
    // and re-arming means a run quick enough to need no window still gets none.
    const host = createFakeHost({ fonts: ["Menlo"] });
    const progress = recorder();

    assemble(prepared(host), place(progress));

    const asked = progress.said.indexOf("pause");

    assert.ok(asked > 0);
    assert.equal(progress.said.at(-1), "pause", "nothing is said after it");
});

test("the job carries what the run is invariant in", () => {
    const host = createFakeHost({ fonts: ["Menlo"] });
    const unpublished = new Set();
    const job = assemble(prepared(host), place(recorder(), unpublished));

    assert.equal(job.app, host);
    assert.equal(job.workspace, WORKSPACE);
    assert.equal(job.unpublished, unpublished);
    assert.equal(job.stamps.size, 0, "one drawing per text, for the whole run");
    assert.equal(job.settings.font, "Menlo");
});

test("a headless run asks the machine nothing about its fonts", () => {
    const host = createFakeHost();
    const progress = recorder();
    const invocation = {
        headless: true,
        settings: { ...defaultSettings(["Menlo"]), customText: "Riga" }
    };

    assemble({ ...prepared(host, true), invocation }, place(progress));

    assert.deepEqual(progress.said, ["pause"]);
    assert.deepEqual(
        host.commands.filter((command) => command.includes("'text'")),
        []
    );
});

test("a request that would stamp nothing is refused before any work", () => {
    const host = createFakeHost();
    const invocation = {
        headless: true,
        settings: {
            ...defaultSettings(["Menlo"]),
            dateFormat: "none",
            coordinateFormat: "none",
            customText: ""
        }
    };

    assert.throws(
        () => assemble({ ...prepared(host, true), invocation }, place(recorder())),
        (error) => {
            assert.equal(
                error.message,
                "This would stamp nothing.\n\nChoose a date or coordinate " +
                    "format, or write some text of your own."
            );

            return true;
        }
    );
});

test("the workspace goes when the run is over", () => {
    const host = createFakeHost();

    assert.equal(withWorkspace(host, new Set(), (path) => path), WORKSPACE);
    assert.ok(host.commands.some((command) => command.includes("'-rf'")));
});

test("a workspace still holding a copy nobody could publish outlives the run", () => {
    // The message that reported the failure sent the user to it.
    const host = createFakeHost();
    const held = new Set(["/tmp/ws/staged-1.jpg"]);

    assert.throws(() => withWorkspace(host, held, () => {
        throw new Error("could not publish");
    }), /could not publish/u);

    assert.deepEqual(host.commands.filter((command) => command.includes("'-rf'")), []);
});
