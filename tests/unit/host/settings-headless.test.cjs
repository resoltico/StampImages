"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { commandLineInteraction } = require("../../../src/host/command-line/interaction.js");
const { askingContext } = require("./fake-assembly.cjs");
const KNOWN = askingContext(["Menlo", "Menlo Bold"]).known;
const SETTINGS = { font: "Menlo", size: 24, textColor: "#FFFFFF", outlineColor: "#000000", outlineWidth: 1,
    position: "top-left", margin: 12, dateFormat: "iso-date", coordinateFormat: "none", customText: "Riga" };

test("a command-line run uses and validates only its explicit settings", () => {
    const interaction = commandLineInteraction({ settings: SETTINGS }, { known: KNOWN });
    assert.deepEqual(interaction.settings().settings, { ...SETTINGS, typeface: { family: "Menlo", face: "" } });
    assert.equal(interaction.settings().covers, null);
    assert.throws(() => commandLineInteraction({ settings: { ...SETTINGS, size: 9000 } }, { known: KNOWN }), /Text size/u);
});

test("configured unknown faces are refused when the interaction is built", () => {
    assert.throws(() => commandLineInteraction({ settings: { ...SETTINGS, font: "Zapfino" } }, { known: KNOWN }), /This Mac has no typeface called "Zapfino"/u);
    assert.throws(() => commandLineInteraction({ settings: { ...SETTINGS, font: "Absent" } }, { known: KNOWN }),
        (error) => error.issues[0].code === "typeface" && error.issues[0].stage === "settings" && error.issues[0].field === "font");
    assert.throws(() => commandLineInteraction({ settings: SETTINGS }, { known: null }), /could not be verified/u);
});

test("drawing capabilities stay outside settings and are resolved once", () => {
    const asked = [];
    const covers = () => true;
    const known = { ...KNOWN, coverageOf: (typeface) => { asked.push(typeface); return covers; } };
    const invocation = { settings: SETTINGS, inputItems: ["/a/photo.jpg"] };
    const interaction = commandLineInteraction(invocation, { known });
    assert.equal(interaction.collect(), invocation);
    const first = interaction.settings();
    assert.equal(interaction.settings(), first);
    assert.equal(first.covers, covers);
    assert.equal(Object.hasOwn(first.settings, "covers"), false);
    assert.deepEqual(asked, [{ family: "Menlo", face: "" }]);
    assert.equal(interaction.present("result"), "result");
    assert.equal(interaction.noImages([]).issues[0].code, "no-images");
});
