"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { runOutcome, noImagesOutcome, failedRun, issuesOf } = require("../../../src/core/outcomes.js");
const { IssueError, OperationError, UserCanceled } = require("../../../src/core/errors.js");
test("outcomes account for states without reconstructing missing sources from counts", () => {
    const states = ["saved", "recovered", "failed", "nothing-to-stamp", "canceled", "not-started"];
    const result = runOutcome(states.map((state) => ({ source: state, state, issues: [] })), [{ path: "/refused" }]);
    assert.deepEqual(result.images.map((image) => image.source), states);
    assert.equal(result.rejected.length, 1);
    assert.equal(result.state, "canceled"); assert.equal(runOutcome().state, "incomplete");
    assert.equal(runOutcome([{ state: "saved", issues: [] }]).state, "complete");
    assert.equal(runOutcome([], [], [], [{ code: "canceled" }]).state, "canceled");
});
test("expected operational errors differ from software faults, including wrapped faults", () => {
    assert.equal(issuesOf(new OperationError("image"), "decode")[0].code, "operation");
    assert.equal(issuesOf(new OperationError("wrapped", { cause: new TypeError("bug") }), "decode")[0].code, "fault");
    assert.equal(issuesOf(new ReferenceError("bug"), "decode")[0].code, "fault");
    assert.equal(issuesOf(new UserCanceled(), "decode")[0].code, "canceled");
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

test("invalid request classification belongs to core and requires no admitted work", () => {
    for (const stage of ["settings", "request"]) {
        const issue = { code: "invalid", stage, message: "Refused" };
        assert.equal(runOutcome([], [], [], [issue]).state, "invalid");
        assert.equal(runOutcome([{ state: "saved", issues: [] }], [], [], [issue]).state, "incomplete");
    }
    assert.equal(runOutcome([], [], [], [{ code: "operation", stage: "setup" }]).state, "incomplete");
    assert.deepEqual(noImagesOutcome([]).issues, [{ code: "no-images", stage: "selection", message: "None of the selected items can be stamped." }]);
    const rejected = [{ path: "/no.gif" }];
    assert.equal(noImagesOutcome(rejected).rejected, rejected);
});
test("failed runs preserve prior work, diagnostics and reporting cancellation", () => {
    const invalid = new IssueError("Refused", { issues: [{ code: "text", stage: "settings", message: "Refused" }] });
    assert.equal(failedRun(invalid).state, "invalid");
    const failed = failedRun(new OperationError("Missing"));
    assert.equal(failed.state, "incomplete");
    assert.equal(failed.issues[0].stage, "setup");
    const prior = { ...runOutcome([{ state: "saved", source: "/in.jpg", output: "/out.jpg", issues: [] }], [{ path: "/no.gif" }], ["/old.jpg"], [{ code: "note" }]), diagnostics: [{ code: "observer-fault" }] };
    assert.equal(failedRun(new UserCanceled(), prior), prior);
    const reported = failedRun(new Error("report"), prior);
    assert.deepEqual(reported.images, prior.images);
    assert.deepEqual(reported.excluded, prior.excluded);
    assert.deepEqual(reported.rejected, prior.rejected);
    assert.deepEqual(reported.diagnostics, prior.diagnostics);
    assert.deepEqual(reported.issues.slice(0, -1), prior.issues);
    assert.equal(reported.issues.at(-1).stage, "reporting");
    assert.equal(failedRun(new UserCanceled()).state, "canceled");
});

test("empty and failed requests have explicit empty ledgers", () => {
    assert.deepEqual(noImagesOutcome([]), { state: "incomplete", images: [], rejected: [], excluded: [], issues: [{ code: "no-images", stage: "selection", message: "None of the selected items can be stamped." }], diagnostics: [] });
    const failed = failedRun(new Error("fault"));
    assert.deepEqual(failed.images, []);
    assert.deepEqual(failed.rejected, []);
    assert.deepEqual(failed.excluded, []);
    assert.deepEqual(failed.diagnostics, []);
});
