"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

function boundary(front, stage = "execute", fault = { errorNumber: -128 }) {
    const file = path.resolve(__dirname, `../../../src/host/${front}/main.js`);
    const normalRequire = createRequire(file);
    const shown = [];
    const progress = { diagnostics: [{ code: "observer-fault" }], close: () => undefined };
    const overrides = {
        "../progress.js": { createProgress: () => progress },
        "../main.js": { application: () => ({}), execute: () => { throw fault; } },
        "./surfaces.js": { openProgress: () => progress },
        "./completion.js": { showCompletion: (app, result) => shown.push(result) },
        "./reporting.js": { reportHeadless: (outcome) => outcome },
        "./interaction.js": { commandLineInteraction: () => {
            if (stage === "settings") { throw fault; }
            return { progress };
        }, quickActionInteraction: () => ({ progress }) },
        "./cli.js": { cliCommand: () => {
            if (stage === "request") { throw fault; }
            return { kind: "run", invocation: {} };
        } }
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(file, "utf8"), {
        module, require: (name) => overrides[name] ?? normalRequire(name)
    }, { filename: file });
    return { run: front === "quick-action" ? module.exports.runQuickAction : module.exports.runCli, shown, progress };
}

test("quick-action top boundary translates raw native cancellation and shows no report", () => {
    const { run, shown } = boundary("quick-action");
    assert.equal(run(undefined), undefined);
    assert.deepEqual(shown, []);
});

test("command-line execution, eager settings and request boundaries classify native stop", () => {
    for (const stage of ["execute", "settings", "request"]) {
        const { run, shown } = boundary("command-line", stage);
        const result = run(["--headless", "settings.json", "image.jpg"]);
        assert.equal(result.state, "canceled");
        assert.equal(result.issues[0].code, "canceled");
        assert.deepEqual(shown, []);
    }
});

test("quick-action failure reports preserve pre-outcome observer diagnostics", () => {
    const { run, shown, progress } = boundary("quick-action", "execute", new TypeError("fault"));
    run(undefined);
    assert.equal(shown[0].issues[0].code, "fault");
    assert.deepEqual(shown[0].diagnostics, progress.diagnostics);
});


test("command-line pre-outcome failures retain observer diagnostics", () => {
    const { OperationError } = require("../../../src/core/errors.js");
    const { run, progress } = boundary("command-line", "execute", new OperationError("setup failed"));
    const result = run([]);
    assert.equal(result.issues[0].stage, "setup");
    assert.deepEqual(result.diagnostics, progress.diagnostics);
});

test("both boundaries preserve prior-outcome diagnostics without duplicating progress", () => {
    const { IssueError } = require("../../../src/core/errors.js");
    const outcome = { images: [{ state: "saved", issues: [] }], rejected: [], excluded: [], issues: [], diagnostics: [{ code: "observer-fault", message: "already captured" }] };
    for (const front of ["quick-action", "command-line"]) {
        const { run, shown } = boundary(front, "execute", new IssueError("presentation failed", { outcome }));
        const result = run([]) ?? shown[0];
        assert.deepEqual(result.diagnostics, outcome.diagnostics);
        assert.equal(result.diagnostics.length, 1);
    }
});
