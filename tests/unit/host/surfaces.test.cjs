"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { openProgress } = require("../../../src/host/quick-action/surfaces.js");
test("empty interactive surfaces retain isolated diagnostics", () => {
    const first = openProgress([]);
    first.diagnostics.push({ code: "observer-fault" });
    const second = openProgress([]);
    second.phase("Working");
    assert.deepEqual(second.diagnostics, []);
});
test("unavailable surfaces and observer faults remain bounded diagnostics", () => {
    let calls = 0;
    const progress = openProgress([() => null, () => { throw new TypeError("window fault"); }, () => ({ report() { calls += 1; throw new TypeError("paint fault"); }, close() { return undefined; } })]);
    progress.phase("One"); progress.phase("Two"); progress.close();
    assert.equal(calls, 1); assert.equal(progress.diagnostics.length, 2);
});
