"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { runJob, executeImage } = require("../../../src/application/job.js");
const { OperationError, UserCanceled } = require("../../../src/core/errors.js");
const images = [{ path: "/a/photo.png" }, { path: "/b/photo.png" }, { path: "/c/photo.png" }];
function fixture(overrides = {}) {
    const events = [];
    const ports = {
        begin: (image, index) => events.push(["begin", image.path, index]),
        stamp: () => ({ staged: "/work/ready.png", crowded: false, expanded: false, unconverted: false, missing: [] }),
        publish: (path, image) => ({ path: `${image.path  }.stamped`, issues: [] }),
        cleanup: () => [], completed: (record) => events.push(["finished", record.state]), ...overrides
    };
    return { ports, events };
}
test("every saved copy retains its source mapping and metadata omissions", () => {
    const { ports } = fixture({ stamp: () => ({ staged: "/ready", missing: ["GPS coordinates"], crowded: true, expanded: true, unconverted: false }) });
    const result = runJob(ports, images);
    assert.equal(result.state, "incomplete");
    assert.deepEqual(result.images.map((image) => image.source), images.map((image) => image.path));
    assert.equal(result.images[0].output, "/a/photo.png.stamped");
    assert.deepEqual(result.images[0].missingMetadata, ["GPS coordinates"]);
    assert.equal(result.images[0].crowded, true); assert.equal(result.images[0].expanded, true);
});
test("nothing to stamp is an explicit outcome rather than a decoder failure", () => {
    const { ports } = fixture({ stamp: () => ({ nothing: "No capture metadata" }) });
    const result = runJob(ports, images);
    assert.equal(result.state, "incomplete");
    assert.ok(result.images.every((image) => image.state === "nothing-to-stamp" && image.reason === "No capture metadata"));
});
test("ordinary image failures continue; faults, cancellation and cleanup stop subsequent work", () => {
    for (const error of [new OperationError("damaged"), new TypeError("bug"), new UserCanceled()]) {
        let calls = 0;
        const { ports } = fixture({ stamp() { calls += 1; throw error; } });
        const result = runJob(ports, images);
        assert.equal(calls, error instanceof OperationError ? 3 : 1);
        assert.equal(result.images[1].state, error instanceof OperationError ? "failed" : "not-started");
        assert.equal(result.state, error instanceof UserCanceled ? "canceled" : "incomplete");
    }
    const { ports } = fixture({ cleanup: () => [{ code: "cleanup", stage: "cleanup", message: "busy" }] });
    const result = runJob(ports, images);
    assert.equal(result.images[0].state, "saved"); assert.equal(result.images[1].state, "not-started");
});
test("confirmed recovery survives failure and appears as its actual path", () => {
    const error = new OperationError("destination denied"); error.recovery = "/Downloads/photo.png";
    const { ports } = fixture({ publish() { throw error; } });
    const result = runJob(ports, images);
    assert.ok(result.images.every((image) => image.state === "recovered" && image.recovery === error.recovery));
});
test("observer and cleanup exceptions preserve committed outputs", () => {
    const { ports } = fixture({ completed() { throw new TypeError("observer"); }, cleanup() { throw new Error("cleanup"); } });
    const result = runJob(ports, images);
    assert.equal(result.images[0].state, "saved"); assert.equal(result.images[0].output, "/a/photo.png.stamped");
    assert.equal(result.images[0].diagnostics[0].stage, "observer"); assert.equal(result.images[1].state, "not-started");
});
test("complete runs and saved issues have independently derived statuses", () => {
    assert.equal(runJob(fixture().ports, images).state, "complete");
    const { ports } = fixture({ publish: () => ({ path: "/out.png", issues: [{ code: "canceled", message: "Stopped after commit" }] }) });
    const result = runJob(ports, images);
    assert.equal(result.images[0].state, "saved"); assert.equal(result.state, "canceled"); assert.equal(result.images[1].state, "not-started");
    assert.equal(executeImage(fixture().ports, images[0], 0).state, "saved");
});

test("beginning, failure stages and unstarted records have exact accountable shapes", () => {
    const { ports, events } = fixture({ begin() { throw new UserCanceled(); } });
    const result = runJob(ports, images);
    assert.equal(result.images[0].state, "canceled");
    assert.equal(result.images[0].issues[0].stage, "stamping");
    assert.deepEqual(result.images[0].missingMetadata, []);
    assert.deepEqual(result.images[1], { source: "/b/photo.png", state: "not-started", issues: [], missingMetadata: [] });
    assert.deepEqual(events, [["finished", "canceled"]]);
    const healthy = fixture(); runJob(healthy.ports, [images[0]]);
    assert.deepEqual(healthy.events, [["begin", "/a/photo.png", 0], ["finished", "saved"]]);
    const cleanup = executeImage(fixture({ cleanup() { throw new Error("busy"); } }).ports, images[0], 0);
    assert.equal(cleanup.issues[0].stage, "cleanup");
});
test("malformed thrown values still account for this source and stop later work", () => {
    const { ports } = fixture({ stamp() {
        // Deliberate native-style malformed exception.
        // eslint-disable-next-line no-throw-literal
        throw null;
    } });
    const result = runJob(ports, images);
    assert.equal(result.images[0].state, "failed"); assert.equal(result.images[1].state, "not-started");
    assert.equal(Object.hasOwn(result.images[0], "recovery"), false);
    assert.equal(result.images[0].issues[0].message, "Unknown error");
});

test("field regression: publication recovery retains prepared omissions and fidelity notes", () => {
    const error = new OperationError("destination denied"); error.recovery = "/Downloads/recovered.png";
    const { ports } = fixture({
        stamp: () => ({ staged: "/ready", missing: ["date/time"], crowded: true, expanded: true, unconverted: false }),
        publish() { throw error; }
    });
    const result = executeImage(ports, images[0], 0);
    assert.equal(result.state, "recovered");
    assert.deepEqual(result.missingMetadata, ["date/time"]);
    assert.equal(result.crowded, true); assert.equal(result.expanded, true);
});
test("requested metadata is accounted for on every record, and unusable fields are named apart", () => {
    // Field regression: nothing-to-stamp records listed no missing fields
    // although both had been requested.
    const nothing = runJob(fixture({ stamp: () => ({ nothing: "why", missing: ["date/time"], invalid: ["date/time"] }) }).ports, [images[0]]);
    assert.deepEqual(nothing.images[0].missingMetadata, ["date/time"]);
    assert.deepEqual(nothing.images[0].invalidMetadata, ["date/time"]);
    const saved = runJob(fixture().ports, [images[0]]);
    assert.equal(Object.hasOwn(saved.images[0], "invalidMetadata"), false, "only when there is any");
    assert.deepEqual(saved.images[0].missingMetadata, []);
    const unsaid = runJob(fixture({ stamp: () => ({ nothing: "why" }) }).ports, [images[0]]);
    assert.deepEqual(unsaid.images[0].missingMetadata, [], "a port that says nothing omits nothing");
    const invalidSaved = runJob(fixture({ stamp: () => ({ staged: "/ready", missing: ["GPS coordinates"], invalid: ["GPS coordinates"] }) }).ports, [images[0]]);
    assert.deepEqual(invalidSaved.images[0].invalidMetadata, ["GPS coordinates"]);
});
