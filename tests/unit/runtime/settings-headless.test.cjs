"use strict";

/*
 * A configuration file is the whole of what a headless run is told.
 *
 * It has to mean the same thing every time it is used, so nothing is read from
 * the last run and nothing is written for the next -- and nothing is even
 * opened. What it names has still to be usable, which for a typeface means
 * this Mac has it: nothing offered this caller a list.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { settingsFor } = require("../../../src/runtime/settings-run.js");
const { createFakeApp } = require("./fake-app.cjs");
const { askingContext } = require("./fake-assembly.cjs");

const FONTS = ["Menlo", "Menlo Bold"];
const CONTEXT = askingContext(FONTS);

const HEADLESS = {
    font: "Menlo",
    size: 24,
    textColour: "#FFFFFF",
    outlineColour: "#000000",
    outlineWidth: 1,
    position: "top-left",
    margin: 12,
    dateFormat: "iso-date",
    coordinateFormat: "none",
    customText: "Riga"
};

function memoryHolding(text) {
    const kept = { text, opened: 0, written: [] };

    return {
        kept,
        open() {
            kept.opened += 1;

            return {
                recall: () => kept.text,
                remember: (written) => kept.written.push(written)
            };
        }
    };
}

test("a headless run uses the file it was given, validated", () => {
    const settings = settingsFor(
        createFakeApp(),
        { headless: true, settings: HEADLESS },
        CONTEXT
    );

    assert.deepEqual(settings, {
        ...HEADLESS,
        // What the name turned out to mean, worked out once for the run.
        typeface: { family: "Menlo", face: "" }
    });
});

test("a headless configuration that is wrong is refused, naming the setting", () => {
    assert.throws(
        () => settingsFor(
            createFakeApp(),
            { headless: true, settings: { ...HEADLESS, size: 9000 } },
            CONTEXT
        ),
        /Text size/u
    );
});

test("a headless run does not even open the memory", () => {
    // Not "reads it and ignores it": a configuration file means the same thing
    // every time it is used, and this branch returns before anything is opened.
    const memory = memoryHolding("");

    settingsFor(
        createFakeApp(),
        { headless: true, settings: HEADLESS },
        CONTEXT,
        { openMemory: memory.open }
    );

    assert.equal(memory.kept.opened, 0);
});

test("a configuration naming a face this Mac does not draw with is refused", () => {
    // The one thing standing between a name and the renderer: nothing has
    // offered a headless caller a list, and pango answers every name, so this
    // used to stamp the photograph in a default face and report a complete
    // success.
    assert.throws(
        () => settingsFor(
            createFakeApp(),
            { headless: true, settings: { ...HEADLESS, font: "Zapfino" } },
            CONTEXT
        ),
        /This Mac has no typeface called "Zapfino"/u
    );
});
