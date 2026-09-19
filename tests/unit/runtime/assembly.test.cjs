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
const { recorder, prepared, place } = require("./fake-assembly.cjs");
const { catalogueOf } = require("./fake-typefaces.cjs");

const KNOWN = catalogueOf({ Menlo: ["Regular", "Bold"] });

test("finding the faces says nothing, because it takes no time", () => {
    // It used to be the longest thing a run did before it said anything --
    // ten candidates and an impossible name, drawn and compared -- and it
    // announced itself for that reason. The font system answers in one call,
    // and a phase nobody can see is a phase worth not naming.
    const progress = recorder();

    assemble(prepared(createFakeHost()), place(progress), KNOWN);
    assert.deepEqual(progress.said, ["pause"]);
});

test("the report is paused before a question is asked", () => {
    // A panel at the floating window level would otherwise sit over the form,
    // and re-arming means a run quick enough to need no window still gets none.
    const progress = recorder();

    assemble(prepared(createFakeHost()), place(progress), KNOWN);
    assert.equal(progress.said.at(-1), "pause", "nothing is said after it");
});

test("the job carries what the run is invariant in", () => {
    const host = createFakeHost();
    const unpublished = new Set();
    const job = assemble(
        prepared(host),
        place(recorder(), unpublished),
        KNOWN
    );

    assert.equal(job.app, host);
    assert.equal(job.workspace, WORKSPACE);
    assert.equal(job.unpublished, unpublished);
    assert.equal(job.stamps.size, 0, "one drawing per text, for the whole run");
    assert.equal(job.settings.font, "Menlo");
    assert.deepEqual(job.settings.typeface, { family: "Menlo", face: "" });
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
