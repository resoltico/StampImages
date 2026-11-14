"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Ajv = require("ajv");
const { runJob } = require("../../../src/application/job.js");
const { IssueError, OperationError, UserCanceled } = require("../../../src/core/errors.js");
const { runOutcome, noImagesOutcome, failedRun } = require("../../../src/core/outcomes.js");
const { reportHeadless } = require("../../../src/host/command-line/reporting.js");
const { assertReceipt, parseReceipt } = require("../../integration/lib/receipt.cjs");
const schema = require("../../integration/receipt.schema.json");
const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
const images = [{ path: "/Photos/a.jpg" }, { path: "/Photos/b.jpg" }];
function ports(overrides = {}) {
    return {
        begin: () => undefined,
        stamp: (image, index, metadataReady) => { metadataReady({}); return { staged: "/private/stamp.jpg", crowded: false, expanded: false, unconverted: false, substituted: false, locationRetained: false }; },
        publish: (path, image) => ({ path: image.path.replace(".jpg", "_stamped.jpg"), issues: [] }),
        cleanup: () => [], completed: () => undefined, ...overrides
    };
}
function serialized(outcome) {
    const writes = [];
    reportHeadless(outcome, (text, ignored, stderr) => writes.push({ text, stderr }), code => code);
    const stdout = writes.filter(write => !write.stderr);
    assert.equal(stdout.length, 1);
    assert(stdout[0].text.endsWith("\n"));
    return parseReceipt(stdout[0].text);
}

test("actual saved ledger and serializer satisfy the contract with all appearance booleans", () => {
    const receipt = serialized(runJob(ports(), images));
    assert.equal(receipt.state, "complete"); assert.equal(receipt.images.length, 2);
    assert.deepEqual(receipt.images[0], { source: "/Photos/a.jpg", state: "saved", issues: [], missingMetadata: [], crowded: false, unconverted: false, expanded: false, substituted: false, locationRetained: false, output: "/Photos/a_stamped.jpg" });
});
test("actual nothing-to-stamp retains inclusive omission/invalid lists and no render facts", () => {
    const receipt = serialized(runJob(ports({ stamp: (image, index, metadataReady) => { metadataReady({ missing: ["date/time", "GPS coordinates"], invalid: ["date/time"] }); return { nothing: "The date is recorded but invalid." }; } }), images));
    assert.equal(receipt.images[0].state, "nothing-to-stamp"); assert.equal(receipt.images[0].crowded, undefined);
});
for (const [name, method, error, expected] of [
    ["early failure", "stamp", new OperationError("Decoder refused."), "failed"],
    ["early stop", "begin", new UserCanceled(), "canceled"],
    ["rendered publication failure", "publish", new OperationError("Destination refused."), "failed"],
    ["rendered publication stop", "publish", new UserCanceled(), "canceled"],
    ["recovery", "publish", new OperationError("Kept elsewhere.", { recovery: "/private/recovered.jpg" }), "recovered"]
]) {
    test(`actual producer shape: ${name}`, () => {
        const receipt = serialized(runJob(ports({ [method]() { throw error; } }), images));
        assert.equal(receipt.images[0].state, expected);
        assert.equal(Object.hasOwn(receipt.images[0], "crowded"), method === "publish");
        if (expected === "canceled") { assert.equal(receipt.images[1].state, "not-started"); }
    });
}
test("explicit no-recovery ownership fault serializes failed without fatal or recovery path", () => {
    const error = new IssueError("Original unavailable.", { cause: new UserCanceled(), recovery: null,
        issues: [{ code: "fault", stage: "publication", message: "Original unavailable." }] });
    const receipt = serialized(runJob(ports({ publish() { throw error; } }), images));
    assert.equal(receipt.images[0].state, "failed"); assert.equal(Object.hasOwn(receipt.images[0], "recovery"), false);
    assert.equal(Object.hasOwn(receipt.images[0], "fatal"), false); assert.equal(receipt.images[1].state, "not-started");
});
test("actual observer image diagnostics and open surface/workspace diagnostics are stack-free", () => {
    const result = runJob(ports({ completed() { throw new TypeError("Observer failed."); } }), images);
    result.diagnostics.push({ code: "observer-fault", message: "Optional surface failed.", stack: "private", nested: [{ stack: "private", text: "stack is ordinary text", zero: 0, flag: false, empty: null }] });
    result.diagnostics.push({ code: "workspace-retained", stage: "workspace", message: "Retained work.", diagnostic: { path: "/private/StampImages.A123" } });
    result.elapsed = "2 seconds";
    const receipt = serialized(result);
    assert.equal(receipt.state, "complete"); assert.equal(receipt.images[0].diagnostics[0].stage, "observer");
    assert.deepEqual(receipt.diagnostics[0].nested, [{ text: "stack is ordinary text", zero: 0, flag: false, empty: null }]);
    assert.equal(Object.hasOwn(result.diagnostics[0], "stack"), true, "serialization must not mutate internal diagnostics");
});
test("actual run constructors serialize no-images, request, setup and stop outcomes", () => {
    for (const result of [noImagesOutcome([]), failedRun(new OperationError("Tool unavailable.")),
        runOutcome([], [], [], [{ code: "usage", stage: "request", message: "Invalid request." }]),
        runOutcome([], [], [], [{ code: "canceled", stage: "setup", message: "Stopped." }])]) { assertReceipt(serialized(result)); }
});

// Literal independent contract fixture: expectations do not come from producers.
function example() {
    return { state: "incomplete", images: [{ source: "/Photos/a.jpg", state: "saved", issues: [], missingMetadata: ["date/time", "GPS coordinates"], invalidMetadata: ["date/time"], output: "/Photos/a_stamped.jpg", crowded: false, expanded: false, unconverted: false, substituted: false, locationRetained: false }],
        rejected: [{ path: "", name: "https://example.invalid/a.jpg", reason: "Remote URL refused.", code: "remote-url", stage: "selection" }],
        excluded: [{ path: "/Photos/old_stamped.jpg", name: "old_stamped.jpg", reason: "Earlier copy.", code: "already-stamped", stage: "selection" }],
        issues: [{ code: "operation", stage: "cleanup", message: "Useful failure.", diagnostic: { retained: false, count: 0, empty: null } }],
        diagnostics: [{ code: "observer-fault", message: "Optional display." }], elapsed: "1 second" };
}
function refused(name, change, keyword) {
    test(`independent schema rejection: ${name}`, () => {
        const value = example(); assertReceipt(value); change(value);
        assert.equal(validate(value), false, name);
        assert(validate.errors.some(error => error.keyword === keyword), JSON.stringify(validate.errors));
    });
}
refused("undocumented top-level field", value => { value.internal = true; }, "additionalProperties");
refused("undocumented fatal image flag", value => { value.images[0].fatal = true; }, "additionalProperties");
refused("rejected reason replaced with message", value => { value.rejected[0].message = value.rejected[0].reason; delete value.rejected[0].reason; }, "required");
refused("excluded path strings instead of real entries", value => { value.excluded = ["/Photos/old_stamped.jpg"]; }, "type");
refused("issue reason instead of message", value => { value.issues[0].reason = value.issues[0].message; delete value.issues[0].message; }, "required");
refused("saved path absent", value => { delete value.images[0].output; }, "required");
refused("relative source", value => { value.images[0].source = "a.jpg"; }, "pattern");
refused("relative output", value => { value.images[0].output = "a_stamped.jpg"; }, "pattern");
refused("recovered path absent", value => { value.images[0].state = "recovered"; delete value.images[0].output; }, "required");
refused("null recovered path", value => { value.images[0].state = "recovered"; delete value.images[0].output; value.images[0].recovery = null; }, "type");
refused("failed record claims output", value => { value.images[0].state = "failed"; }, "not");
refused("nothing-to-stamp reason absent", value => { value.images[0] = { source: "/a.jpg", state: "nothing-to-stamp", issues: [], missingMetadata: [] }; }, "required");
refused("saved record carries reason", value => { value.images[0].reason = "Competing reason."; }, "not");
refused("internal building state", value => { value.images[0].state = "building"; delete value.images[0].output; }, "enum");
refused("misspelled canceled run state", value => { value.state = "cancelled"; }, "enum");
refused("metadata field typo", value => { value.images[0].missingMetadata = ["GPS coordinates", "date"]; }, "enum");
refused("empty invalid metadata array", value => { value.images[0].invalidMetadata = []; }, "minItems");
refused("invalid field not in inclusive omitted list", value => { value.images[0].missingMetadata = ["GPS coordinates"]; }, "contains");
refused("duplicate metadata fields", value => { value.images[0].missingMetadata.push("date/time"); }, "uniqueItems");
refused("appearance note wrong type", value => { value.images[0].expanded = "yes"; }, "type");
refused("required finished appearance note absent", value => { delete value.images[0].crowded; }, "required");
refused("unbuilt record carries appearance", value => { value.images[0] = { source: "/a.jpg", state: "not-started", issues: [], missingMetadata: [], crowded: false }; }, "not");
refused("stack nested inside issue array data", value => { value.issues[0].diagnostic.more = [{ stack: "private" }]; }, "not");
refused("stack nested inside global diagnostics", value => { value.diagnostics[0].nested = { inner: { stack: "private" } }; }, "not");
refused("privacy flag wrong type", value => { value.images[0].locationRetained = 1; }, "type");
refused("privacy fact on unbuilt record", value => { value.images[0] = { source: "/a.jpg", state: "not-started", issues: [], missingMetadata: [], locationRetained: false }; }, "not");
refused("privacy fact without completed render notes", value => { value.images[0] = { source: "/a.jpg", state: "failed", issues: [], missingMetadata: [], locationRetained: true }; }, "required");

test("validated retention proof permits validated-copy facts even after publication failure/stop", () => {
    for (const state of ["saved", "recovered", "failed", "canceled"]) {
        const value = example(); value.images[0].state = state;
        if (state !== "saved") { delete value.images[0].output; }
        if (state === "recovered") { value.images[0].recovery = "/private/kept.jpg"; }
        value.images[0].locationRetained = true; assertReceipt(value);
    }
});
test("schema complete invariant matches the documented transport contract without banning optional diagnostics", () => {
    const value = serialized(runJob(ports(), images)); assertReceipt(value);
    value.images[0].state = "failed"; delete value.images[0].output;
    assert.equal(validate(value), false); assert(validate.errors.some(error => error.keyword === "const"));
});
test("parse helper rejects invalid JSON and scalar receipts", () => {
    assert.throws(() => parseReceipt("not JSON")); assert.throws(() => parseReceipt("null"));
});

refused("finished copy retention proof absent", value => { delete value.images[0].locationRetained; }, "required");
refused("rendered failure retention proof absent", value => { value.images[0].state = "failed"; delete value.images[0].output; delete value.images[0].locationRetained; }, "required");
test("known input invalidity remains serialized after later copy refusal without rendered-copy facts", () => {
    const receipt = serialized(runJob(ports({ stamp(image, index, metadataReady) {
        metadataReady({ missing: ["GPS coordinates"], invalid: ["GPS coordinates"] }); throw new OperationError("Raw copy refused.");
    } }), images));
    assert.equal(receipt.images[0].state, "failed"); assert.deepEqual(receipt.images[0].invalidMetadata, ["GPS coordinates"]);
    assert.equal(Object.hasOwn(receipt.images[0], "locationRetained"), false);
});
