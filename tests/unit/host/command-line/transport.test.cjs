"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { writeReceipt, writeStdout } = require("../../../../src/host/command-line/receipt.js");
const { reportHeadless } = require("../../../../src/host/command-line/reporting.js");
const { showCliCommand } = require("../../../../src/host/command-line/cli.js");
const { runOutcome } = require("../../../../src/core/outcomes.js");
const brokenPipe = require("../../../../src/host/command-line/broken-pipe.js");
const { withBridge } = require("./signal-bridge.cjs");

function namespace(output, failure = null) {
    const ns = (text) => ({ dataUsingEncoding(encoding) { assert.equal(encoding, 4); return text; } });
    ns.NSFileHandle = {
        fileHandleWithStandardOutput: { writeData(text) { if (failure) { throw failure; } output.push({ text, stderr: false }); } },
        fileHandleWithStandardError: { writeData(text) { output.push({ text, stderr: true }); } }
    };
    ns.exit = (code) => code;
    return ns;
}

test("native SDK transport encodes both streams inside the scoped signal guard", (context) => {
    const output = [];
    let calls = 0, guarded = false;
    context.mock.method(brokenPipe, "withoutSigpipe", (write) => {
        calls += 1; guarded = true;
        try { return write(); } finally { guarded = false; }
    });
    const ns = namespace(output);
    const native = ns.NSFileHandle.fileHandleWithStandardOutput.writeData;
    ns.NSFileHandle.fileHandleWithStandardOutput.writeData = (text) => { assert.equal(guarded, true); native(text); };
    assert.equal(writeReceipt("Rīga\n", ns), true);
    assert.equal(writeReceipt("Reason\n", ns, true), true);
    assert.deepEqual(output, [{ text: "Rīga\n", stderr: false }, { text: "Reason\n", stderr: true }]);
    assert.equal(calls, 2);
    assert.equal(writeReceipt("not written", null), false);
    assert.equal(calls, 2);
});

test("help and version stdout failures get one plain line and nonzero status", (context) => {
    context.mock.method(brokenPipe, "withoutSigpipe", (write) => write());
    for (const kind of ["help", "version"]) {
        const output = [];
        const ns = namespace(output, new Error("broken stdout"));
        withBridge({ objc: { import: () => undefined }, ns }, () => {
            assert.equal(showCliCommand(kind), 1);
        });
        assert.deepEqual(output, [{ text: "Standard output could not be completed.\n", stderr: true }]);
    }
});

test("transport attempts prose first then one receipt and preserves the first stderr throw", () => {
    const choices = [{ kind: "ok" }, { kind: "false" }, { kind: "throw", value: new Error("stream failed") }, { kind: "throw", value: null }, { kind: "throw", value: undefined }];
    for (const prose of choices) {
        for (const json of choices) {
            const calls = [], result = runOutcome([{ state: "saved", source: "/source.png", output: "/out.png", issues: [] }]);
            const before = JSON.stringify(result);
            let exited = null, thrown = false;
            const write = (text, unused, stderr) => {
                calls.push({ text, stderr: Boolean(stderr) });
                const choice = stderr ? prose : json;
                if (choice.kind === "throw") { throw choice.value; }
                return choice.kind !== "false";
            };
            try {
                const code = reportHeadless(result, write, (status) => { exited = status; return status; });
                assert.equal(code, prose.kind === "ok" && json.kind === "ok" ? 0 : 1);
            } catch (error) { thrown = true; assert.equal(prose.kind, "throw"); assert.equal(error, prose.value); }
            assert.equal(thrown, prose.kind === "throw");
            if (thrown) { assert.equal(exited, null); }
            assert.equal(calls[0].stderr, true); assert.match(calls[0].text, /^Created 1 stamped copy/u);
            assert.equal(calls[1].stderr, false); assert.equal(JSON.parse(calls[1].text).state, "complete");
            assert.equal(calls.length, json.kind === "ok" ? 2 : 3);
            if (json.kind !== "ok") { assert.deepEqual(calls[2], { text: "Standard output could not be completed.\n", stderr: true }); }
            assert.equal(JSON.stringify(result), before);
        }
    }
});

test("stdout false or a falsy exception remains a failure even when best-effort stderr also fails", () => {
    for (const failure of [false, null, undefined, 0]) {
        let calls = 0;
        assert.equal(writeStdout("payload", (text, unused, stderr) => {
            calls += 1;
            if (stderr) { throw new Error("stderr also failed"); }
            if (failure === false) { return false; }
            throw failure;
        }), false);
        assert.equal(calls, 2);
    }
});
