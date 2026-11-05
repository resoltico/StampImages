"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    finderSelection,
    collectInvocation
} = require("../../../src/host/input.js");
const { collectImageFiles } = require("../../../src/host/admission.js");
const { createFakeApp, failing } = require("./fake-app.cjs");

/*
 * Application() is a JavaScriptCore host global, supplied here so the
 * resolution logic can be exercised directly.
 */
globalThis.applicationsAsked = [];
globalThis.Application = (name) => {
    globalThis.applicationsAsked.push(name);

    return { selection: () => globalThis.finderItems ?? [] };
};

test("what cannot be converted is reported, not dropped", () => {
    // A silent filter turned a GIF selected alongside a photo into a report
    // that nothing had failed, so the count described the surviving subset
    // rather than what was asked for.
    const app = createFakeApp([["'/a/missing.png'", failing("1")]]);
    const { images, rejected } = collectImageFiles(app, [
        "/a/photo.JPG",
        "/a/notes.txt",
        "/a/missing.png"
    ]);

    assert.deepEqual(images.map((record) => record.originalName), ["photo.JPG"]);
    assert.deepEqual(rejected.map((entry) => entry.name), ["notes.txt", "missing.png"]);
    assert.match(rejected[0].reason, /not a supported format/u);
    assert.match(rejected[1].reason, /not a readable file/u);
});

test("collectImageFiles keeps only supported, regular files", () => {
    const app = createFakeApp([["'/a/missing.png'", failing("1")]]);
    const { images: records } = collectImageFiles(app, [
        "/a/photo.JPG",
        "/a/notes.txt",
        "/a/missing.png",
        "/a/scan.png"
    ]);

    assert.deepEqual(records.map((record) => record.path), ["/a/photo.JPG", "/a/scan.png"]);
    assert.deepEqual(records.map((record) => record.originalName), ["photo.JPG", "scan.png"]);
});

test("collectImageFiles returns them in natural order", () => {
    const app = createFakeApp();
    const { images: records } = collectImageFiles(app, [
        "/a/page10.png",
        "/a/page2.png",
        "/a/page1.png"
    ]);

    assert.deepEqual(
        records.map((record) => record.originalName),
        ["page1.png", "page2.png", "page10.png"]
    );
});

test("collectImageFiles falls back to the Finder selection", () => {
    const app = createFakeApp();

    globalThis.finderItems = ["/a/fromfinder.png"];
    assert.deepEqual(
        collectImageFiles(app, []).images.map((record) => record.path),
        ["/a/fromfinder.png"]
    );
    globalThis.finderItems = [];
});

test("finderSelection asks Finder, by name, for its selection", () => {
    // Which application is asked is the whole content of this function. A
    // stub that ignores the name would let it ask anything at all.
    globalThis.finderItems = ["/a/x.png"];
    globalThis.applicationsAsked = [];

    assert.deepEqual(finderSelection(), ["/a/x.png"]);
    assert.deepEqual(globalThis.applicationsAsked, ["Finder"]);

    globalThis.finderItems = [];
});



test("an interactive invocation defers its settings", () => {
    const invocation = collectInvocation(createFakeApp(), ["/a/1.png"], false);

    assert.equal(invocation.headless, false);
    assert.equal(invocation.settings, null);
    assert.deepEqual(invocation.inputItems, ["/a/1.png"]);
});

test("every reason a selection item is turned away carries its own stable code", () => {
    // Field regression: inspection refusals carried a code and selection
    // refusals did not, so a receipt reader had to match sentences.
    const { SELECTION_CODES } = require("../../../src/host/admission.js");
    const codes = [...SELECTION_CODES.values()];

    assert.equal(new Set(codes).size, codes.length, "one code per reason");
    assert.ok(codes.every((code) => /^[a-z]+(?:-[a-z]+)*$/u.test(code)));
    assert.ok(!codes.includes("unknown"));
});

test("a refused selection item says why in a code as well as a sentence", () => {
    const app = createFakeApp();

    app.files = ["/a/clip.gif"];

    const { rejected } = collectImageFiles(app, ["/a/clip.gif"]);

    assert.equal(rejected[0].code, "unsupported-format");
    assert.equal(rejected[0].stage, "selection");
});
