"use strict";

/*
 * Which settings a run uses, and which runs remember.
 *
 * A configuration file is the whole of what a headless run is told and has to
 * mean the same thing every time it is used, so nothing is read from the last
 * run and nothing is written for the next -- and nothing is even opened.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { settingsFor } = require("../../../src/runtime/settings-run.js");
const { defaultAnswers } = require("../../../src/core/form-defaults.js");
const { encode } = require("../../../src/core/preferences.js");
const { createFakeApp } = require("./fake-app.cjs");

const FONTS = ["Menlo", "Menlo Bold"];
const CONTEXT = { count: 1, fonts: FONTS };

const HEADLESS = {
    font: "Menlo",
    size: 24,
    textColour: "#FFFFFF",
    outlineColour: "#000000",
    outlineWidth: 1,
    position: "top-left",
    margin: 8,
    dateFormat: "iso-date",
    coordinateFormat: "none",
    customText: "Riga"
};

function memoryHolding(text) {
    const kept = { text, opened: 0, written: [] };

    return {
        kept,
        open: () => {
            kept.opened += 1;

            return {
                recall: () => kept.text,
                remember: (written) => kept.written.push(written)
            };
        }
    };
}

function interactive(app, injected) {
    return settingsFor(app, { headless: false }, CONTEXT, injected);
}

test("a headless run uses the file it was given, validated", () => {
    const settings = settingsFor(
        createFakeApp(),
        { headless: true, settings: HEADLESS },
        CONTEXT
    );

    assert.deepEqual(settings, HEADLESS);
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

test("an interactive run opens on what the last one confirmed", () => {
    const memory = memoryHolding(encode({ ...HEADLESS, size: 72 }));
    const app = createFakeApp();
    const shown = [];

    interactive(app, {
        openMemory: memory.open,
        bridge: { objc: {}, ns: {} },
        present: (bridge, spec) => {
            shown.push(spec);

            return { answers: defaultAnswers(FONTS) };
        }
    });

    assert.equal(shown[0].rows.find((row) => row.key === "size").value, "72");
});

test("what is confirmed is remembered, and the text typed is not", () => {
    // A preference is not made wrong by a photograph that fails later, so it
    // is kept before any work -- and the text somebody typed is about this
    // job, and is the field most likely to say something private.
    const memory = memoryHolding("");
    const app = createFakeApp();

    interactive(app, {
        openMemory: memory.open,
        bridge: { objc: {}, ns: {} },
        present: () => ({
            answers: { ...defaultAnswers(FONTS), customText: "Riga" }
        })
    });

    const [kept] = memory.kept.written;

    assert.equal(JSON.parse(kept).customText, undefined);
    assert.equal(JSON.parse(kept).font, "Menlo");
});

test("a machine that cannot remember still asks and still stamps", () => {
    const app = createFakeApp();
    const settings = interactive(app, {
        openMemory: () => ({
            recall: () => "",
            remember: () => undefined
        }),
        bridge: { objc: {}, ns: {} },
        present: () => ({ answers: defaultAnswers(FONTS) })
    });

    assert.equal(settings.size, 36);
});
