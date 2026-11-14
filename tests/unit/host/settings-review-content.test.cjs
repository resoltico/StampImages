"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { reviewSettings, confirmSelection } = require("../../../src/host/quick-action/settings-review.js");
const { defaultSettings } = require("../../../src/host/quick-action/settings-model.js");
const { createFakeApp } = require("./fake-app.cjs");
const { askingContext } = require("./fake-assembly.cjs");

const applyWhitespace = (text) => text.replace(/\s+/gu, " ");
const FONTS = ["Menlo"];

function review() {
    const app = createFakeApp();

    reviewSettings(app, defaultSettings(FONTS), askingContext(FONTS, 2));

    return app.dialogs[0];
}

test("fallback review states every approved setting and does not hide the output contract", () => {
    const { message, options } = review();

    assert.match(message, /^Create 2 stamped copies\?/u);
    assert.ok(applyWhitespace(message).includes("The original files are not changed."));
    assert.match(message, /\n\nDate\/time format: 2026-09-09 14:30\nCoordinate format: Do not stamp the coordinates\n/u);
    assert.match(message, /\nCustom text: ""\n/u);
    assert.match(message, /\nTypeface: Menlo\n/u);
    assert.deepEqual(options, {
        withTitle: "Stamp Images", buttons: ["Cancel", "Create"],
        defaultButton: "Create", cancelButton: "Cancel"
    });
});

test("the exact caption is visibly quoted in the final review, not interpreted as review fields", () => {
    const app = createFakeApp();
    const settings = { ...defaultSettings(FONTS), customText: "Family\nGPS coordinates: Off\t\"A\"" };

    reviewSettings(app, settings, askingContext(FONTS, 1));
    assert.ok(app.dialogs[0].message.includes(
        '\nCustom text: "Family\\nGPS coordinates: Off\\t\\"A\\""\n'
    ));
    assert.match(app.dialogs[0].message, /\nText size: 36\n/u);
});

test("a short selection review shows each refusal and no invented remainder", () => {
    const app = createFakeApp();

    app.nextButton = "Continue";
    confirmSelection(app, { count: 2, rejected: [
        { name: "missing.jpg", reason: "Unreadable" }, { name: "missing.png", reason: "Gone" }
    ] });
    assert.equal(app.dialogs[0].message,
        "2 items in your selection cannot be included.\n\nNot included:\nmissing.jpg: Unreadable\n\nmissing.png: Gone\n\nContinue with 2 images?");
    const pathed = createFakeApp();

    pathed.nextButton = "Continue";
    confirmSelection(pathed, { count: 1, rejected: [{ path: "/Users/u/Trip/clip.gif", name: "clip.gif", reason: "not a supported format" }] });
    assert.match(pathed.dialogs[0].message, /Not included:\nclip\.gif: not a supported format\nin \/Users\/u\/Trip\/\n\n/u, "the name first, its folder after");
    assert.deepEqual(app.dialogs[0].options.buttons, ["Cancel", "Continue"]);
});

test("a review without a count still asks, and no selection problems ask nothing", () => {
    const app = createFakeApp();

    reviewSettings(app, defaultSettings(FONTS), askingContext(FONTS, 0));
    assert.match(app.dialogs[0].message, /^Create the stamped copies\?\n/u);
    confirmSelection(app, { count: 1 });
    assert.equal(app.dialogs.length, 1);
});
