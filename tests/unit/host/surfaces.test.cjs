"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { openProgress } = require("../../../src/host/surfaces.js");
test("headless progress builds no windows and retains isolated diagnostics", () => {
    let called = false;
    const progress = openProgress(true, [() => { called = true; }]);
    progress.phase("Working"); assert.equal(called, false); assert.deepEqual(progress.diagnostics, []);
});
test("unavailable surfaces and observer faults remain bounded diagnostics", () => {
    let calls = 0;
    const progress = openProgress(false, [() => null, () => { throw new TypeError("window fault"); }, () => ({ report() { calls += 1; throw new TypeError("paint fault"); }, close() { return undefined; } })]);
    progress.phase("One"); progress.phase("Two"); progress.close();
    assert.equal(calls, 1); assert.equal(progress.diagnostics.length, 2);
});
