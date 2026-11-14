"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { assemble } = require("../../../src/host/assembly.js");
const { commandLineInteraction } = require("../../../src/host/command-line/interaction.js");
const { chooseSettings } = require("../../../src/host/quick-action/settings-form.js");
const { defaultSettings, defaultAnswers } = require("../../../src/host/quick-action/settings-model.js");
const { createFakeHost } = require("./fake-host.cjs");
const { recorder, prepared, place } = require("./fake-assembly.cjs");
const { catalogOf } = require("./fake-typefaces.cjs");
const KNOWN = catalogOf({ Menlo: ["Regular", "Italic", "Bold"] });
function configured(font, known = KNOWN) {
    return commandLineInteraction({ settings: { ...defaultSettings([font]), customText: "Riga" } }, { known }).settings();
}

test("assembly carries the chosen typeface and glyph capability without re-reading settings", () => {
    const host = createFakeHost();
    const progress = recorder();
    const resolved = configured("Menlo Bold");
    const job = assemble(prepared(host), place(progress), resolved);
    assert.equal(job.settings, resolved.settings);
    assert.equal(job.covers, resolved.covers);
    assert.deepEqual(job.settings.typeface, { family: "Menlo", face: "Bold" });
    assert.deepEqual(progress.said, []);
    assert.deepEqual(host.commands, []);
});

test("a configuration asking for a style the family lacks is told which", () => {
    assert.throws(() => configured("Menlo Heavy"), /Menlo has no style called "Heavy".*Regular, Italic and Bold/su);
});

test("interactive suggestions come from the catalog without drawing candidates", () => {
    const asked = [];
    const known = { families: KNOWN.families, facesOf: (family) => { asked.push(family); return KNOWN.facesOf(family); } };
    const host = createFakeHost();
    const result = chooseSettings(host, { count: 2, rejected: [] }, { known,
        openMemory: () => ({ recall: () => "", remember: () => undefined }),
        bridge: { objc: {}, ns: {} }, present: () => ({ answers: defaultAnswers(["Menlo"]) }) });
    assert.deepEqual(asked, ["Menlo"]);
    assert.deepEqual(result.settings.typeface, { family: "Menlo", face: "" });
    assert.deepEqual(host.commands, []);
});

test("the command line never builds a suggestion list", () => {
    const asked = [];
    const known = { families: KNOWN.families, facesOf: (family) => { asked.push(family); return KNOWN.facesOf(family); } };
    assert.deepEqual(configured("Menlo", known).settings.typeface, { family: "Menlo", face: "" });
    assert.deepEqual(asked, []);
});

test("unavailable catalogs refuse interactive settings before consent or memory", () => {
    const host = createFakeHost();
    assert.throws(() => chooseSettings(host, {}, { known: null, openMemory: () => { throw new Error("memory must not open"); } }), /could not be verified/u);
    assert.deepEqual(host.dialogs, []);
    assert.deepEqual(host.commands, []);
});
