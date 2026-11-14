"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { cliCommand, configurationValues, jsonConfiguration, usage } = require("../../../src/host/cli.js");
const { reportHeadless, exitCode } = require("../../../src/host/reporting.js");
const { runOutcome } = require("../../../src/core/outcomes.js");
const { defaultSettings } = require("../../../src/host/quick-action/settings-model.js");
const settings = defaultSettings(["Menlo"]);
test("help/version and strict CLI grammar never read files", () => {
    assert.equal(cliCommand(["--help"]).kind, "help"); assert.equal(cliCommand(["--version"]).kind, "version");
    for (const args of [[], ["photo.png"], ["--unknown"], ["--headless"], ["--headless", "s.json", ""]]) { assert.throws(() => cliCommand(args), /Usage/u); }
    assert.match(usage(), /all 10 required/u);
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
    const { summarizeRun } = require("../../../src/core/run-summary.js");
    const { headline, reportText } = require("../../../src/core/run-report.js");
    const describe = (result) => headline(summarizeRun(result));
    const detailOf = (result) => reportText(result, false);
    const stopped = runOutcome([
        { source: "/a", state: "saved", output: "/out", issues: [] },
        { source: "/b", state: "canceled", issues: [] },
        { source: "/c", state: "not-started", issues: [] }
    ]);
    assert.match(detailOf(stopped).split("\n\n")[0], /1 saved; 1 canceled; 1 not started/u);
    const partial = runOutcome([{ source: "/a", state: "saved", output: "/out", issues: [], missingMetadata: ["date/time"] }]);
    assert.match(describe(partial), /issues/u);
    assert.match(detailOf(partial).split("\n\n")[0], /1 copy missing requested metadata/u);
});

test("a usage error says what was wrong and the one line that would be right, not the whole help", () => {
    // Shared with Image Files to PDF. The whole help used to be dumped into
    // the receipt and stderr for a mistyped flag.
    const said = (args) => { try { cliCommand(args); } catch (error) { return error.issues[0]; } return null; };
    const cases = [
        [[], "No arguments were given."], [["--bogus"], "Unknown option: --bogus."], [["photo.png"], "Unknown option: photo.png."],
        [["--headless"], "--headless needs a settings file and at least one path."], [["--headless", "s.json", ""], "An argument is empty."],
        [["--help", "x"], "--help and --version take no other arguments."], [["--version", "--help"], "--help and --version take no other arguments."]
    ];
    for (const [args, problem] of cases) {
        const issue = said(args);

        assert.equal(issue.code, "usage");
        assert.equal(issue.message, `${problem}\nUsage: osascript -l JavaScript Stamp-Images.jxa -- --headless <settings.json> <path…>\nRun with --help to see the settings.`, args.join(" "));
    }
});

test("help lists each setting with its values, captions that add something, and its default", () => {
    const help = usage();

    assert.match(help, /\n {2}dateFormat — Date\/time format: iso-minutes \(2026-09-09 14:30\) \| iso-date \(2026-09-09\) \| long-date \(September 9, 2026\) \| none \(Do not stamp the date\); default iso-minutes\n/u);
    assert.match(help, /\n {2}position — Position: bottom-right \| bottom-left \| top-right \| top-left \| bottom-center \| top-center; default bottom-right\n/u);
    assert.match(help, /\n {2}size — Text size: 8–400 pt; default 36\n/u);
    assert.match(help, /\n {2}customText — Custom text: text\n/u);
    assert.match(help, /\n {2}font — Typeface: text; default Helvetica Neue\n/u);
    assert.match(help, /Paths may be absolute or relative to the working directory\./u);
});

test("the command-line report separates sections with one blank line and ends with the elapsed time", () => {
    const written = [];
    const result = { ...runOutcome([{ source: "/a.jpg", state: "saved", output: "/o/a_stamped.jpg", issues: [], missingMetadata: [] }]), elapsed: "2 seconds" };

    reportHeadless(result, (text, unused, stderr) => written.push({ text, stderr }), () => 0);
    assert.equal(JSON.parse(written[0].text).elapsed, "2 seconds");
    assert.equal(written[1].text, "Created 1 stamped copy.\n\n1 saved.\n\nSaved to:\n/o/\na_stamped.jpg\n\nElapsed: 2 seconds\n");
    assert.doesNotMatch(written[1].text, /Stamp Images \d/u, "no version line on the command line");
    const empty = [];

    reportHeadless({ ...runOutcome(), state: "complete", images: [] }, (text) => empty.push(text), () => 0);
    assert.doesNotMatch(empty[1], /0 saved/u, "zero counts are not printed");
});
