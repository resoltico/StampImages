"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { settingsFor } = require("../../../src/runtime/settings-run.js");
const { confirmSelection, approve } = require("../../../src/runtime/settings-review.js");
const { collectDialogSettings } = require("../../../src/runtime/dialogs.js");
const { defaultAnswers, defaultSettings } = require("../../../src/core/form-defaults.js");
const { createFakeApp } = require("./fake-app.cjs");
const { askingContext } = require("./fake-assembly.cjs");
const FONTS = ["Menlo"];
const CONTEXT = { ...askingContext(FONTS, 2), rejected: [{ name: "bad.jpg", reason: "Unreadable" }] };
const BRIDGE = { objc: {}, ns: {} };

function memory(events, saved = "") {
    return () => {
        events.push("open memory");

        return {
            recall() { events.push("recall"); return saved; },
            remember(text) { events.push(JSON.parse(text)); }
        };
    };
}

test("selection cancellation stops before settings, preferences or output", () => {
    const events = [];
    const app = createFakeApp();

    app.displayDialog = (message, options) => {
        events.push("review");
        assert.match(message, /bad.jpg: Unreadable/u);
        assert.deepEqual(options.buttons, ["Cancel", "Continue"]);
        assert.equal(options.cancelButton, "Cancel");

        return { buttonReturned: "Cancel" };
    };
    assert.throws(() => settingsFor(app, {}, CONTEXT, {
        openMemory: memory(events), bridge: BRIDGE,
        present: () => { throw new Error("form must not open"); }
    }), /cancelled/iu);
    assert.deepEqual(events, ["review"]);
});

test("selection approval precedes settings, and the approved GPS choice is remembered", () => {
    const events = [];
    const app = createFakeApp();

    app.displayDialog = () => { events.push("review"); return { buttonReturned: "Continue" }; };
    const result = settingsFor(app, {}, CONTEXT, {
        openMemory: memory(events, JSON.stringify({ ...defaultSettings(FONTS), coordinateFormat: "decimal", size: 72 })),
        bridge: BRIDGE,
        present(bridge, spec) {
            events.push("form");
            assert.equal(spec.rows.find((row) => row.key === "coordinateFormat").value, "56.9496, 24.1052");
            assert.equal(spec.rows.find((row) => row.key === "size").value, "72");

            return { answers: { ...defaultAnswers(FONTS), coordinateFormat: "56°56'58.6\"N 24°6'18.7\"E" } };
        }
    });

    assert.deepEqual(events.slice(0, 4), ["review", "open memory", "recall", "form"]);
    assert.equal(result.coordinateFormat, "sexagesimal");
    assert.equal(events[4].coordinateFormat, "sexagesimal", "remembered for the next run");
});

test("headless settings bypass selection consent and all interactive memory", () => {
    const events = [];
    const app = createFakeApp();
    const result = settingsFor(app, { headless: true, settings: defaultSettings(FONTS) }, CONTEXT, {
        openMemory: memory(events)
    });

    assert.equal(result.coordinateFormat, "none");
    assert.deepEqual(events, []);
    assert.deepEqual(app.dialogs, []);
});

test("cancelled fallback approval never remembers settings", () => {
    const events = [];
    const app = createFakeApp();
    const display = app.displayDialog;

    app.displayDialog = (message, options) => options.defaultButton === "Create"
        ? { buttonReturned: "Cancel" }
        : display(message, options);
    assert.throws(() => settingsFor(app, {}, askingContext(FONTS), {
        bridge: null, openMemory: memory(events)
    }), /cancelled/iu);
    assert.deepEqual(events, ["open memory", "recall"]);
});

test("selection review truncation is explicit, with the exact count still visible", () => {
    const app = createFakeApp();

    app.nextButton = "Continue";
    confirmSelection(app, {
        count: 1,
        rejected: Array.from({ length: 14 }, (unused, index) => ({ name: `${index}.jpg`, reason: "Unreadable" }))
    });
    assert.match(app.dialogs[0].message, /^14 items in your selection cannot be included:\n0\.jpg: Unreadable\n/u);
    assert.match(app.dialogs[0].message, /11\.jpg: Unreadable\n\.\.\.and 2 more\.\n\n/u);
    assert.ok(!app.dialogs[0].message.includes("12.jpg"), "stops where it says it does");
    assert.match(app.dialogs[0].message, /Continue with 1 image/u);
    assert.throws(() => approve({ displayDialog: () => ({}) }, "Question", "Create"), /cancelled/iu);
});

test("fallback empty content asks for correction rather than approving a no-op", () => {
    const app = createFakeApp();
    const opening = { ...defaultAnswers(FONTS), dateFormat: "Do not stamp the date" };

    app.nextAnswer = ["", "Menlo", "36", "#FFFFFF", "2", "#202020", "24",
        "caption", "Menlo", "36", "#FFFFFF", "2", "#202020", "24"];
    const result = collectDialogSettings(app, opening, askingContext(FONTS));

    assert.equal(result.customText, "caption");
    assert.equal(result.coordinateFormat, "none");
    assert.ok(app.dialogs.some((dialog) => dialog.message.includes("nothing to stamp")));
});
