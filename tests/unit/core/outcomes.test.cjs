"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { runOutcome, ledgerOf, issuesOf } = require("../../../src/core/outcomes.js");
const { OperationError, UserCancelled } = require("../../../src/core/errors.js");
test("outcomes account for states without reconstructing missing sources from counts", () => {
    const states = ["saved", "recovered", "failed", "nothing-to-stamp", "cancelled", "not-started"];
    const result = runOutcome(states.map((state) => ({ source: state, state, issues: [] })), [{ path: "/refused" }]);
    assert.deepEqual(ledgerOf(result), { saved: 1, recovered: 1, failed: 1, nothing: 1, cancelled: 1, notStarted: 1, rejected: 1 });
    assert.equal(result.state, "cancelled"); assert.equal(runOutcome().state, "incomplete");
    assert.equal(runOutcome([{ state: "saved", issues: [] }]).state, "complete");
    assert.equal(runOutcome([], [], [], [{ code: "cancelled" }]).state, "cancelled");
});
test("expected operational errors differ from software faults, including wrapped faults", () => {
    assert.equal(issuesOf(new OperationError("image"), "decode")[0].code, "operation");
    assert.equal(issuesOf(new OperationError("wrapped", { cause: new TypeError("bug") }), "decode")[0].code, "fault");
    assert.equal(issuesOf(new ReferenceError("bug"), "decode")[0].code, "fault");
    assert.equal(issuesOf(new UserCancelled(), "decode")[0].code, "cancelled");
    assert.equal(issuesOf(null, "decode")[0].message, "Unknown error");
    const issues = [{ code: "cleanup" }]; assert.equal(issuesOf({ issues }, "decode"), issues);
});

test("mixed saved outcomes never conceal omissions, issues, or refusals", () => {
    const saved = { source: "/saved", state: "saved", issues: [], missingMetadata: [] };
    const failed = { source: "/failed", state: "failed", issues: [] };
    assert.equal(runOutcome([saved, failed]).state, "incomplete");
    assert.equal(runOutcome([saved], [{ path: "/refused" }]).state, "incomplete");
    assert.equal(runOutcome([saved], [], [], [{ code: "operation" }]).state, "incomplete");
    assert.equal(runOutcome([saved, { ...saved, issues: [{ code: "operation" }] }]).state, "incomplete");
    assert.equal(runOutcome([saved, { ...saved, missingMetadata: ["date/time"] }]).state, "incomplete");
    const result = runOutcome([saved]); assert.deepEqual(result.excluded, []); assert.deepEqual(result.diagnostics, []);
    assert.equal(result.state, "complete");
});
test("error details are preserved without allowing diagnostic getters to lose prior work", () => {
    const error = new OperationError("decode"); error.command = "vips copy"; error.stack = "trace";
    assert.deepEqual(issuesOf(error, "decode"), [{ code: "operation", stage: "decode", message: "decode", diagnostic: { command: "vips copy", stack: "trace" } }]);
    assert.deepEqual(issuesOf(null, "decode"), [{ code: "fault", stage: "decode", message: "Unknown error", diagnostic: { command: "", stack: "" } }]);
    const malformed = Object.defineProperty({}, "issues", { get() { throw new Error("getter fault"); } });
    assert.deepEqual(issuesOf(malformed, "decode"), [{ code: "fault", stage: "decode", message: "The failure details could not be read." }]);
});
