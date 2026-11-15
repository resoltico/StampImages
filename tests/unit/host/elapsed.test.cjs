"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const { createRequire } = require("node:module");
const { createProgress } = require("../../../src/host/progress.js");
const { noImagesOutcome } = require("../../../src/core/outcomes.js");
const filename = require.resolve("../../../src/host/main.js");

function controller(images, processing) {
    const selection = { images, rejected: [], excluded: [] };
    const adapters = {
        "./preflight.js": { checkTools: () => ({}) },
        "./admission.js": { collectImageFiles: () => selection },
        "./source-inspection.js": { inspectCandidates: (app, selected) => selected },
        "./workspace.js": { reclaimWorkspaces: () => [] },
        "./assembly.js": { withWorkspace: (app, prepared, progress, use) => use({}), assemble: (prepared, place, resolved) => ({ settings: resolved.settings }) },
        "./job.js": { runJob: processing }
    };
    const loaded = new Module(filename);
    const original = createRequire(filename);
    loaded.filename = filename;
    loaded.require = (name) => adapters[name] ?? original(name);
    // eslint-disable-next-line no-underscore-dangle -- Node’s module compiler isolates the native adapter dependencies.
    loaded._compile(fs.readFileSync(filename, "utf8"), filename);
    return loaded.exports.execute;
}
function interaction(settings) {
    return { progress: createProgress([]), collect: () => ({ inputItems: ["/a.jpg"] }), settings,
        noImages: noImagesOutcome, present: (result) => result };
}
const capabilities = { tree: {}, sources: {}, publication: {}, storage: {} };

test("elapsed starts at image processing and excludes choosing settings", (context) => {
    context.mock.timers.enable({ apis: ["Date"], now: 0 });
    const execute = controller([{ path: "/a.jpg", folder: "/" }], () => {
        context.mock.timers.tick(1000);
        return { images: [{ source: "/a.jpg", output: "/a_stamped.jpg", state: "saved", issues: [], missingMetadata: [] }], issues: [] };
    });
    const result = execute({}, null, { capabilities, interaction: interaction(() => {
        context.mock.timers.tick(120000);
        return { settings: {} };
    }) });
    assert.equal(result.state, "complete");
    assert.equal(result.elapsed, "1 second");
    assert.equal(Date.now(), 121000);
});

test("a refusal before processing has no elapsed field", () => {
    const execute = controller([], () => { throw new Error("no image processing is allowed"); });
    const result = execute({}, null, { capabilities, interaction: interaction(() => { throw new Error("no settings are needed"); }) });
    assert.equal(Object.hasOwn(result, "elapsed"), false);
});
