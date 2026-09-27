"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { reviewSettings, confirmSelection } = require("../../../src/runtime/settings-review.js");
const { defaultSettings } = require("../../../src/core/form-defaults.js");
const { createFakeApp } = require("./fake-app.cjs");
const { askingContext } = require("./fake-assembly.cjs");

const FONTS = ["Menlo"];

function review() {
    const app = createFakeApp();

    reviewSettings(app, defaultSettings(FONTS), askingContext(FONTS, 2));

    return app.dialogs[0];
}

test("fallback review states every approved setting and does not hide the output contract", () => {
    const { message, options } = review();

    assert.match(message, /^Create 2 stamped copies\?\nEach image gets a stamped copy, saved in each folder you selected or beside each image you selected\. The original files are not changed\.\n/u);
    assert.match(message, /\n\nDate\/time format: 2026-09-09 14:30\nCoordinate format: Do not stamp the coordinates\n/u);
    assert.match(message, /\nCustom text \(optional\): ""\n/u);
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
        '\nCustom text (optional): "Family\\nGPS coordinates: Off\\t\\"A\\""\n'
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
        "2 items in your selection cannot be included:\nmissing.jpg: Unreadable\nmissing.png: Gone\n\nContinue with 2 images?");
    assert.deepEqual(app.dialogs[0].options.buttons, ["Cancel", "Continue"]);
});

test("a review without a count still asks, and no selection problems ask nothing", () => {
    const app = createFakeApp();

    reviewSettings(app, defaultSettings(FONTS), askingContext(FONTS, 0));
    assert.match(app.dialogs[0].message, /^Create the stamped copies\?\n/u);
    confirmSelection(app, { count: 1 });
    assert.equal(app.dialogs.length, 1);
});
