"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { imageFacts, colorFacts } = require("../../../src/host/fidelity.js");
const { sizeOf } = require("../../../src/host/tinting.js");
const { readPhotograph } = require("../../../src/host/preparing.js");
const { saveCopy } = require("../../../src/host/image.js");
const { UserCanceled, isUserCanceled } = require("../../../src/core/errors.js");
const { issuesOf } = require("../../../src/core/outcomes.js");
const { createFakeHost, WORKSPACE } = require("./fake-host.cjs");
const { makeJob } = require("./fake-job.cjs");
function fixture(options = {}) {
    const host = createFakeHost({ files: ["/photo.png"], ...options });
    return { host, job: { ...makeJob(host), workspace: WORKSPACE } };
}
function headerCalls(host) { return host.commands.filter((command) => command.includes("vipsheader")); }
function alterDump(host, change) {
    const run = host.doShellScript;
    host.doShellScript = (command) => {
        const value = run(command);
        return command.includes("'-a'") ? change(value) : value;
    };
}

test("decoded photograph facts use one fresh dump after unchanged predecode checks, without loader/problem leakage", () => {
    const { host, job } = fixture();
    const read = readPhotograph(job, "/photo.png", "1");
    assert.deepEqual(read, { path: `${WORKSPACE}/oriented-1.v`, size: { width: 600, height: 400 }, bands: 3, interpretation: "srgb", hasAlpha: false });
    const calls = headerCalls(host);
    assert.equal(calls.length, 3);
    assert(calls[0].includes("'-f' 'interpretation' '/photo.png'"));
    assert(calls[1].includes("'-f' 'n-pages' '/photo.png'"));
    assert(calls[2].includes("'-a'") && calls[2].includes("oriented-1.v"));
});

test("the same path is remeasured at a later immutable boundary instead of cached", () => {
    const { host, job } = fixture();
    assert.deepEqual(imageFacts(job, "/copy.v"), { size: { width: 600, height: 400 }, bands: 3, interpretation: "srgb", hasAlpha: false });
    host.headerFacts.set("/copy.v", { width: 900, height: 500, bands: 4 });
    assert.deepEqual(imageFacts(job, "/copy.v"), { size: { width: 900, height: 500 }, bands: 4, interpretation: "srgb", hasAlpha: true });
    assert.equal(headerCalls(host).length, 2);
});

test("ambiguous or unexpected batch text falls back to independent scalar dimensions", () => {
    const corruptions = [
        () => "unknown response",
        (text) => text.replace("/mask.png: ", "/other.png: "),
        (text) => text.replace("600x400", "not-a-summary"),
        (text) => text.split("\n").slice(0, 2).join("\n"),
        (text) => `${text.replace("width: 600\n", "")}width: 999\n`,
        (text) => `${text}width: 999\n`,
        (text) => `${text}interpretation: cmyk\n`,
        (text) => `${text}image-description: harmless\nnot a field\n`,
        (text) => `${text}image-description: harmless\nwidth: 999\n`
    ];
    for (const change of corruptions) {
        const { host, job } = fixture();
        alterDump(host, change);
        assert.deepEqual(sizeOf(job, "/mask.png"), { width: 600, height: 400 });
        const calls = headerCalls(host);
        assert.equal(calls.length, 3);
        assert(calls[1].includes("'-f' 'width'"));
        assert(calls[2].includes("'-f' 'height'"));
    }
});

test("newline filenames use scalar reads; colon filenames can use their exact structural prefix", () => {
    const { host, job } = fixture();
    assert.deepEqual(sizeOf(job, "/mask\nwidth: 999.png"), { width: 600, height: 400 });
    assert(headerCalls(host).every((command) => command.includes("'-f'")));
    host.commands.length = 0;
    assert.deepEqual(sizeOf(job, "/mask: with colon.png"), { width: 600, height: 400 });
    assert.equal(headerCalls(host).length, 1);
    assert(headerCalls(host)[0].includes("'-a'"));
});

test("batch cancellation and programmer faults do not enter scalar fallback", () => {
    for (const failure of [new UserCanceled(), new TypeError("broken adapter"), new ReferenceError("missing binding")]) {
        const { host, job } = fixture({ failures: [["'-a'", failure]] });
        assert.throws(() => sizeOf(job, "/mask.png"), (error) => {
            assert.equal(isUserCanceled(error), failure instanceof UserCanceled);
            if (!(failure instanceof UserCanceled)) {
                assert.equal(error.cause, failure);
                assert.equal(issuesOf(error, "stamping")[0].code, "fault");
            }
            return true;
        });
        assert.equal(headerCalls(host).length, 1);
    }
});

test("a failed batch read retains independent scalar failure wording and label", () => {
    const { host, job } = fixture({ failures: [["'-a'", new Error("batch unavailable")], ["'height'", new Error("height unavailable")]] });
    assert.throws(() => sizeOf(job, "/mask.png"), /Command failed while measuring the stamp\.\n\nheight unavailable/u);
    assert.equal(headerCalls(host).length, 3);
});

test("saved geometry is measured after metadata and takes precedence over bad color facts", () => {
    const { host, job } = fixture();
    const run = host.doShellScript;
    host.doShellScript = (command) => {
        const value = run(command);
        if (command.includes("'-userParam'")) { host.headerFacts.set("/copy.jpg", { width: 599, bands: 4, stored: "print" }); }
        return value;
    };
    assert.throws(() => saveCopy(job, "/stamped.v", "/copy.jpg", { metadataSource: "/source.jpg", hasAlpha: false, size: { width: 600, height: 400 } }), /is 599 by 400 pixels where 600 by 400 were expected/u);
    const calls = headerCalls(host);
    assert.equal(calls.length, 1);
    assert(calls[0].includes("'-a'"));
});

test("batch color facts still reject impossible band/model combinations and keep alpha exact", () => {
    for (const [bands, stored, hasAlpha] of [[1, "gray", false], [2, "gray", true], [3, "color", false], [4, "color", true]]) {
        const { host, job } = fixture({ bands, stored });
        assert.equal(colorFacts(job, "/image.v").hasAlpha, hasAlpha);
        assert.equal(headerCalls(host).length, 1);
    }
    const { job } = fixture({ bands: 2, stored: "color" });
    assert.throws(() => imageFacts(job, "/image.v"), /color representation could not be confirmed/u);
});

test("ambiguous color headers keep independent scalar bands/interpretation and their failure label", () => {
    const { host, job } = fixture({ bands: 2, stored: "gray" });
    alterDump(host, () => "unusable batch");
    assert.deepEqual(colorFacts(job, "/image.v"), { bands: 2, interpretation: "b-w", hasAlpha: true });
    const calls = headerCalls(host);
    assert.equal(calls.length, 3);
    assert(calls[1].includes("'-f' 'bands'"));
    assert(calls[2].includes("'-f' 'interpretation'"));
    const broken = fixture({ failures: [["'-a'", new Error("batch unavailable")], ["'bands'", new Error("bands unavailable")]] });
    assert.throws(() => colorFacts(broken.job, "/image.v"), /Command failed while measuring the image\.\n\nbands unavailable/u);
});

test("saveCopy returns only final color/retention facts after one post-metadata header", () => {
    const { host, job } = fixture();
    const result = saveCopy(job, "/stamped.v", "/copy.jpg", { metadataSource: "/source.jpg", hasAlpha: false, size: { width: 600, height: 400 } });
    assert.deepEqual(result, { bands: 3, interpretation: "srgb", hasAlpha: false, locationRetained: false });
    assert.equal(headerCalls(host).length, 1);
});

test("saveCopy cannot silently skip mandatory geometry when its source description lacks size", () => {
    const { job } = fixture();
    assert.throws(() => saveCopy(job, "/stamped.v", "/copy.jpg", { metadataSource: "/source.jpg", hasAlpha: false }), TypeError);
});
