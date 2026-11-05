"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { executeRun } = require("../../../src/application/run.js");
function fixture(images = [{ path: "/source.png" }]) {
    const events = [];
    const ports = { prepare: () => ({ selection: { images, rejected: [], excluded: [] } }),
        progress: { pause: () => events.push("pause"), close: () => events.push("close"), diagnostics: [] },
        noImages: () => "none", process: () => ({ images: [{ source: "/source.png", state: "saved", issues: [] }], issues: [] }),
        present: (result) => { events.push("present"); return result; } };
    return { ports, events };
}
test("application owns ordering, complete outcomes and the empty selection path", () => {
    const { ports, events } = fixture(); assert.equal(executeRun(ports).state, "complete");
    assert.deepEqual(events, ["pause", "close", "present"]);
    assert.equal(executeRun(fixture([]).ports), "none");
});
test("reporting faults retain the complete saved outcome", () => {
    const { ports } = fixture(); ports.present = () => { throw new Error("display failed"); };
    assert.throws(() => executeRun(ports), (error) => error.outcome.images[0].output === undefined && error.outcome.images[0].state === "saved");
});

test("observer diagnostics and malformed presentation faults retain the actual committed output", () => {
    const { ports } = fixture(); ports.progress.diagnostics.push({ code: "observer-fault", message: "paint" });
    ports.process = () => ({ images: [{ source: "/source.png", state: "saved", output: "/actual.png", issues: [] }], issues: [] });
    assert.deepEqual(executeRun(ports).diagnostics, [{ code: "observer-fault", message: "paint" }]);
    ports.present = () => {
        // Deliberate malformed native exception.
        // eslint-disable-next-line no-throw-literal
        throw null;
    };
    assert.throws(() => executeRun(ports), (error) => error.outcome.images[0].output === "/actual.png");
});
