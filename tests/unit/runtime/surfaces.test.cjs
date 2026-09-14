"use strict";

/*
 * Where a report is displayed, and how a run acquires somewhere to display it.
 *
 * The action used to write to one surface and assume it was seen. A Shortcut
 * is not Script Editor, not an applet and not the script menu, so the
 * assignments succeeded and nobody saw anything.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    jxaProgress,
    openProgress
} = require("../../../src/runtime/surfaces.js");
const { SILENT } = require("../../../src/runtime/progress.js");

function fakeHost() {
    return {
        totalUnitCount: -1,
        completedUnitCount: -1,
        description: "",
        additionalDescription: ""
    };
}

function sink(said, name) {
    return () => ({
        stopped: () => false,
        start: () => said.push(`${name} start`),
        report: () => said.push(`${name} report`),
        pause: () => said.push(`${name} pause`),
        close: () => said.push(`${name} close`)
    });
}

test("the host's own object is written in its own words", () => {
    const host = fakeHost();
    const surface = jxaProgress(host);

    surface.start(12);
    assert.equal(host.totalUnitCount, 12);
    assert.equal(host.completedUnitCount, 0);

    surface.report(3, "Stamping", "3 of 12 — c.png");
    assert.equal(host.completedUnitCount, 3);
    assert.equal(host.description, "Stamping");
    assert.equal(host.additionalDescription, "3 of 12 — c.png");
});

test("a bar left part-filled goes on saying there is work outstanding", () => {
    const host = fakeHost();
    const surface = jxaProgress(host);

    surface.start(12);
    surface.close();
    assert.equal(host.totalUnitCount, 0);
});

test("pausing the host's object is nothing to do", () => {
    assert.equal(jxaProgress(fakeHost()).pause(), undefined);
});

test("a host with no Progress object of its own is left out", () => {
    assert.equal(jxaProgress(undefined), null);
    assert.equal(jxaProgress(null), null);
});

test("a headless run builds nothing and reports to silence", () => {
    // It must not touch AppKit, must not raise an activation policy, and has
    // nothing to tear down.
    const said = [];

    assert.equal(openProgress(true, [sink(said, "panel")]), SILENT);
    assert.deepEqual(said, []);
});

test("the surfaces that can be established are all written to", () => {
    const said = [];
    const progress = openProgress(false, [sink(said, "panel"), sink(said, "host")]);

    progress.expect(2);
    assert.deepEqual(said, ["panel start", "host start"]);
});

test("a surface that cannot be established is left out, not waited for", () => {
    const said = [];
    const progress = openProgress(false, [() => null, sink(said, "host")]);

    progress.expect(1);
    assert.deepEqual(said, ["host start"]);
});

test("a host that can establish none of them reports to silence", () => {
    assert.equal(openProgress(false, [() => null, () => null]), SILENT);
});

test("anything thrown while opening a surface is a run with no report", () => {
    // This is called before the try that reports errors, so it has to be the
    // one thing here that cannot throw at all.
    assert.equal(
        openProgress(false, [() => {
            throw new Error("no window server");
        }]),
        SILENT
    );
});

test("asked for nothing in particular, a run reports to the host's own object", () => {
    // The default build list is the two real surfaces. Under Node there is no
    // AppKit, so the panel is the one that cannot be established -- and the
    // host's object is still written to.
    globalThis.Progress = fakeHost();

    try {
        const progress = openProgress(false);

        progress.expect(5);
        assert.equal(globalThis.Progress.totalUnitCount, 5);
    } finally {
        globalThis.Progress = undefined;
    }
});

test("the host's own object has no cancel of its own to offer", () => {
    assert.equal(jxaProgress(fakeHost()).stopped(), false);
});
