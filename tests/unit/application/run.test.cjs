"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { executeRun } = require("../../../src/application/run.js");
function fixture(images = [{ path: "/source.png" }]) {
    const events = [];
    const ports = { prepare: () => ({ selection: { images, rejected: [], excluded: [] } }),
        progress: { pause: () => events.push("pause"), close: () => events.push("close"), diagnostics: [] },
        interaction: { noImages: () => "none", settings: () => ({ settings: {}, covers: null }), present: (result) => { events.push("present"); return result; } }, process: () => ({ images: [{ source: "/source.png", state: "saved", issues: [] }], issues: [] }) };
    return { ports, events };
}
test("application owns ordering, complete outcomes and the empty selection path", () => {
    const { ports, events } = fixture(); assert.equal(executeRun(ports).state, "complete");
    assert.deepEqual(events, ["pause", "close", "present"]);
    assert.equal(executeRun(fixture([]).ports), "none");
});
test("reporting faults retain the complete saved outcome", () => {
    const { ports } = fixture(); ports.interaction.present = () => { throw new Error("display failed"); };
    assert.throws(() => executeRun(ports), (error) => error.outcome.images[0].output === undefined && error.outcome.images[0].state === "saved");
});

test("observer diagnostics and malformed presentation faults retain the actual committed output", () => {
    const { ports } = fixture(); ports.progress.diagnostics.push({ code: "observer-fault", message: "paint" });
    ports.process = () => ({ images: [{ source: "/source.png", state: "saved", output: "/actual.png", issues: [] }], issues: [] });
    assert.deepEqual(executeRun(ports).diagnostics, [{ code: "observer-fault", message: "paint" }]);
    ports.interaction.present = () => {
        // Deliberate malformed native exception.
        // eslint-disable-next-line no-throw-literal
        throw null;
    };
    assert.throws(() => executeRun(ports), (error) => error.outcome.images[0].output === "/actual.png");
});

test("consent receives selection facts and processing receives the opaque resolved envelope", () => {
    const { ports, events } = fixture();
    const rejected = [{ path: "/bad", code: "not-an-image" }];
    const selection = { images: [{ folder: "/a/" }, { folder: "/a/" }, { folder: "/b/" }, {}], selectedFolders: 2, rejected, excluded: [] };
    const resolved = { settings: { font: "chosen" }, covers: () => true };
    ports.prepare = () => ({ selection });
    ports.interaction.settings = (context) => {
        events.push("settings");
        assert.deepEqual(context, { count: 4, selectedFolders: 2, folders: ["/a/", "/b/"], rejected });
        return resolved;
    };
    ports.process = (request, envelope) => {
        events.push("process");
        assert.equal(request.selection, selection);
        assert.equal(envelope, resolved);
        return { images: [], issues: [] };
    };
    executeRun(ports);
    assert.deepEqual(events, ["pause", "settings", "process", "close", "present"]);
    ports.interaction.settings = (context) => { assert.equal(context.selectedFolders, 0); assert.deepEqual(context.folders, []); return resolved; };
    ports.prepare = fixture().ports.prepare;
    ports.process = fixture().ports.process;
    executeRun(ports);
});
