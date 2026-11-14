"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const { createRequire } = require("node:module");
const { createProgress } = require("../../../src/host/progress.js");
const { defaultSettings } = require("../../../src/host/quick-action/settings-model.js");
const { OperationError } = require("../../../src/core/errors.js");
const filename = require.resolve("../../../src/host/stamping.js");

function fixture(original, saved, failure = null, planned = false) {
    const removed = [];
    const descriptor = { format: "PNG", width: 600, height: 400, ...original };
    const job = { settings: { ...defaultSettings(["Menlo"]), dateFormat: "none", customText: "Riga" }, workspace: "/work", artifacts: new Map(),
        progress: createProgress([]), storage: { write: () => undefined }, covers: null,
        sources: { capture: (source, path) => ({ path, identity: "original", version: "1" }) } };
    const adapters = {
        "./source-inspection.js": { inspectCaptured: (unused, owned) => ({ ...owned, ...descriptor }) },
        "./owned-cleanup.js": { removeOwned: (unused, path) => removed.push(path) },
        "./preparing.js": { preparePhotograph: () => ({ photograph: { path: "/work/prepared.v", size: { width: 600, height: 400 }, hasAlpha: false,
            interpretation: planned ? "srgb" : original.interpretation, bands: planned ? 3 : original.bands }, profile: { path: "", failed: false }, expanded: planned }) },
        "./render.js": { stampFor: () => ({ path: "/work/stamp.png", size: { width: 200, height: 60 }, moved: true }) },
        "./image.js": { composite: () => "/work/drawn.v", saveCopy(unused, drawn, target) {
            assert.equal(job.artifacts.get(target).state, "validating");
            if (failure) { throw failure; }
            return saved;
        } }
    };
    const loaded = new Module(filename), normal = createRequire(filename);
    loaded.filename = filename;
    loaded.require = (name) => adapters[name] ?? normal(name);
    // eslint-disable-next-line no-underscore-dangle -- Node's compiler isolates the actual stamping module with measurement ports.
    loaded._compile(fs.readFileSync(filename, "utf8"), filename);
    const image = { path: "/in/source.png", extension: ".png", admission: { identity: "original", version: "1", image: descriptor } };
    return { job, removed, make: () => loaded.exports.stampOne(job, image, "1", () => undefined) };
}

test("expanded is observed from saved facts rather than a neutral palette or preparation plan", () => {
    const legacy = fixture({ interpretation: "b-w", bands: 1 }, { interpretation: "srgb", bands: 3 });
    assert.equal(legacy.make().expanded, true, "a neutral request unexpectedly saved RGB must say so");
    assert.equal(legacy.job.artifacts.get("/work/staged-1.png").state, "validated");
    const converted = fixture({ interpretation: "grey16", bands: 1 }, { interpretation: "rgb16", bands: 3 }, null, true);
    assert.equal(converted.make().expanded, true, "original admission facts remain gray after preparation becomes RGB");
    const rgb = fixture({ interpretation: "srgb", bands: 3 }, { interpretation: "rgb16", bands: 3 }, null, true);
    assert.equal(rgb.make().expanded, false, "a gray-looking RGB original is not gray expansion");
});

test("unreadable saved facts cannot become validated success and faults retain unconfirmed work", () => {
    for (const failure of [new OperationError("Saved color facts unreadable."), new TypeError("saved fact adapter bug")]) {
        const sample = fixture({ interpretation: "b-w", bands: 1 }, null, failure);
        assert.throws(sample.make, (error) => error === failure);
        const { state } = sample.job.artifacts.get("/work/staged-1.png");
        assert.equal(state, failure instanceof OperationError ? "building" : "validating");
        assert.equal(sample.removed.includes("/work/staged-1.png"), failure instanceof OperationError);
    }
});
