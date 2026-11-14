"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

function boundary(failingRequest = false) {
    const file = path.resolve(__dirname, "../../../src/host/main.js");
    const normalRequire = createRequire(file);
    const raw = Object.assign(new Error("native stop"), { errorNumber: -128 });
    const shown = [];
    const progress = { diagnostics: [], close: () => undefined };
    const overrides = {
        "../application/run.js": { executeRun: () => { throw raw; } },
        "./surfaces.js": { openProgress: () => progress },
        "./reporting.js": { report: (...args) => shown.push(args), reportHeadless: (outcome) => outcome },
        "./cli.js": { cliCommand: () => {
            if (failingRequest) { throw raw; }
            return { kind: "run", invocation: {} };
        } }
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(file, "utf8"), {
        module, require: (name) => overrides[name] ?? normalRequire(name),
        Application: { currentApplication: () => ({}) }
    }, { filename: file });
    return { run: module.exports.run, shown };
}

test("quick-action top boundary translates raw native cancellation and shows no report", () => {
    const { run, shown } = boundary();
    assert.equal(run(undefined), undefined);
    assert.deepEqual(shown, []);
});

test("command-line execution and request boundaries classify raw native stop as cancellation", () => {
    for (const failingRequest of [false, true]) {
        const { run, shown } = boundary(failingRequest);
        const result = run(["--headless", "settings.json", "image.jpg"]);
        assert.equal(result.state, "canceled");
        assert.equal(result.issues[0].code, "canceled");
        assert.deepEqual(shown, []);
    }
});
