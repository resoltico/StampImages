"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { cliCommand, configurationValues, jsonConfiguration, usage } = require("../../../src/host/cli.js");
const { reportHeadless, exitCode } = require("../../../src/host/reporting.js");
const { runOutcome } = require("../../../src/core/outcomes.js");
const { defaultSettings } = require("../../../src/host/form-defaults.js");
const settings = defaultSettings(["Menlo"]);
test("help/version and strict CLI grammar never read files", () => {
    assert.equal(cliCommand(["--help"]).kind, "help"); assert.equal(cliCommand(["--version"]).kind, "version");
    for (const args of [[], ["photo.png"], ["--unknown"], ["--headless"], ["--headless", "s.json", ""]]) { assert.throws(() => cliCommand(args), /Usage/u); }
    assert.match(usage(), /all ten required/u);
});
test("relative paths are resolved and native reader output uses the canonical validator", () => {
    const read = [];
    const result = cliCommand(["--", "--headless", "settings.json", "photo.png"], {
        absolute: (path) => `/cwd/${path}`,
        read: (path) => { read.push(path); return settings; }
    });
    assert.deepEqual(read, ["/cwd/settings.json"]); assert.deepEqual(result.invocation.inputItems, ["/cwd/photo.png"]);
    assert.deepEqual(result.invocation.settings, settings);
    assert.equal(result.invocation.headless, true);
    assert.throws(() => configurationValues({ ...settings, size: "36", extra: 1 }), (error) => error.issues.length === 2);
    assert.throws(() => configurationValues({ ...settings, dateFormat: "none", customText: " " }), /nothing to stamp/u);
});
test("JSON syntax and object shape are distinct request failures", () => {
    assert.throws(() => jsonConfiguration("{", "/settings.json"), (error) => error.issues[0].stage === "request");
    for (const text of ["null", "[]", "false", "1"]) { assert.throws(() => jsonConfiguration(text, "/settings.json"), /not an object/u); }
    assert.deepEqual(jsonConfiguration("{}", "/settings.json"), {});
});
test("receipts use separate streams and exact statuses without an osascript error wrapper", () => {
    const result = runOutcome([{ source: "/source.png", state: "saved", output: "/out.png", issues: [] }]);
    const written = [];
    assert.equal(reportHeadless(result, (text, ignored, stderr) => written.push({ text, stderr }), (code) => code), 0);
    assert.equal(JSON.parse(written[0].text).images[0].output, "/out.png"); assert.equal(written[1].stderr, true);
    assert.equal(exitCode({ ...result, state: "invalid" }), 2);
    assert.equal(exitCode(runOutcome([], [], [], [{ code: "operation", stage: "setup", message: "missing vips" }])), 3);
    assert.equal(exitCode(runOutcome()), 1);
});

test("field regression: stopped and partial completion expose unfinished counts immediately", () => {
    const { describe, detailOf } = require("../../../src/host/completion.js");
    const stopped = runOutcome([
        { source: "/a", state: "saved", output: "/out", issues: [] },
        { source: "/b", state: "cancelled", issues: [] },
        { source: "/c", state: "not-started", issues: [] }
    ]);
    assert.match(detailOf(stopped).split("\n\n")[0], /1 saved; 1 cancelled; 1 not started/u);
    const partial = runOutcome([{ source: "/a", state: "saved", output: "/out", issues: [], missingMetadata: ["date/time"] }]);
    assert.match(describe(partial), /issues/u);
    assert.match(detailOf(partial).split("\n\n")[0], /1 copy missing requested metadata/u);
});
