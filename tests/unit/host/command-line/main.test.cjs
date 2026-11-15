"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { createProgress } = require("../../../../src/host/progress.js");
const { runOutcome } = require("../../../../src/core/outcomes.js");
const { OperationError } = require("../../../../src/core/errors.js");
const { exitCode } = require("../../../../src/host/command-line/reporting.js");
const filename = require.resolve("../../../../src/host/command-line/main.js");

function fixture(options = {}) {
    const events = [], reports = [];
    let closed = false;
    const monitor = { poll: options.poll ?? (() => false), close() { events.push("monitor-close"); closed = true; if (options.closeError) { throw options.closeError; } } };
    const adapters = {
        "../progress.js": { createProgress(...args) {
            const progress = createProgress(...args);
            const { close } = progress;
            progress.close = () => { events.push("progress-close"); close(); };
            return progress;
        } },
        "./signal-controller.js": { createSignalController() { events.push("monitor-start"); if (options.monitorError) { throw options.monitorError; } return monitor; } },
        "./cli.js": { cliCommand() { if (options.requestError) { throw options.requestError; } return { kind: options.kind ?? "run", invocation: {} }; }, showCliCommand: (kind) => kind },
        "./interaction.js": { commandLineInteraction(invocation, { progress }) { events.push("settings"); if (options.settingsError) { throw options.settingsError; } return { progress }; } },
        "../main.js": { application: () => ({}), execute(app, invocation, { interaction }) {
            events.push("execute"); interaction.progress.expect(1); interaction.progress.beginning(1, "source.png");
            return runOutcome([{ state: "saved", source: "/source.png", output: "/out.png", issues: [] }]);
        } },
        "./reporting.js": { reportHeadless(result) { events.push("report"); assert.equal(closed, false); reports.push(result); if (options.reportError) { throw options.reportError; } return exitCode(result); } }
    };
    const moduleUnderTest = { exports: {} }, normalRequire = createRequire(filename);
    vm.runInNewContext(fs.readFileSync(filename, "utf8"), { module: moduleUnderTest, require: (name) => adapters[name] ?? normalRequire(name) }, { filename });
    return { run: moduleUnderTest.exports.runCli, events, reports };
}

test("monitor starts after settings, survives progress close and closes after returning transport", () => {
    const context = fixture();
    assert.equal(context.run([]), 0);
    assert.deepEqual(context.events, ["settings", "monitor-start", "execute", "progress-close", "report", "monitor-close"]);
});

test("invalid settings, request refusals and help never install signal handlers", () => {
    const settingsError = new OperationError("Typeface invalid.", { issues: [{ code: "typeface", stage: "settings", field: "font", message: "Typeface invalid." }] });
    const invalid = fixture({ settingsError });
    assert.equal(invalid.run([]), 2); assert.ok(!invalid.events.includes("monitor-start"));
    const requestError = new OperationError("Bad request.", { issues: [{ code: "usage", stage: "request", message: "Bad request." }] });
    const request = fixture({ requestError });
    assert.equal(request.run([]), 2); assert.deepEqual(request.events, ["report"]);
    const help = fixture({ kind: "help" });
    assert.equal(help.run([]), "help"); assert.deepEqual(help.events, []);
});

test("unavailable monitoring is a handled setup refusal after settings validation", () => {
    const context = fixture({ monitorError: new OperationError("Signal monitoring unavailable.") });
    assert.equal(context.run([]), 3); assert.equal(context.reports[0].state, "invalid");
    assert.deepEqual(context.events, ["settings", "monitor-start", "progress-close", "report"]);
});

test("a latched native signal uses the existing canceled state and exit1", () => {
    const context = fixture({ poll: () => true });
    assert.equal(context.run([]), 1); assert.equal(context.reports[0].state, "canceled");
    assert.equal(context.reports[0].issues[0].code, "canceled");
    assert.equal(context.events.at(-1), "monitor-close");
});

test("an abort remains primary when monitor cleanup also fails, with no second receipt", () => {
    const primary = new Error("transport aborted");
    const context = fixture({ reportError: primary, closeError: new Error("cleanup also failed") });
    assert.throws(() => context.run([]), (error) => error === primary);
    assert.equal(context.reports.length, 1); assert.equal(context.events.at(-1), "monitor-close");
});

test("a returning test transport observes a close failure without a second receipt", () => {
    const failure = new OperationError("monitor close refused");
    const context = fixture({ closeError: failure });
    assert.throws(() => context.run([]), (error) => error === failure);
    assert.equal(context.reports.length, 1);
});


test("a required monitoring fault remains a fault instead of disabling an optional observer", () => {
    const context = fixture({ poll() { throw new TypeError("required native monitoring failed"); } });
    assert.equal(context.run([]), 3, "the existing no-outcome setup status is preserved");
    assert.equal(context.reports[0].state, "incomplete");
    assert.equal(context.reports[0].issues[0].code, "fault");
    assert.deepEqual(context.reports[0].diagnostics, []);
});
