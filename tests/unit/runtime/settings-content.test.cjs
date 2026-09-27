"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { collectViaForm, collectSettings } = require("../../../src/runtime/settings-form.js");
const { collectDialogSettings } = require("../../../src/runtime/dialogs.js");
const { askUntil } = require("../../../src/runtime/prompts.js");
const { defaultAnswers } = require("../../../src/core/form-defaults.js");
const { createFakeApp } = require("./fake-app.cjs");
const { askingContext } = require("./fake-assembly.cjs");
const FONTS = ["Menlo"];
const BRIDGE = { objc: {}, ns: {} };
const empty = () => ({ ...defaultAnswers(FONTS), dateFormat: "Do not stamp the date" });

function opening() {
    return { context: askingContext(FONTS, 2) };
}

test("nothing to stamp is an editable validation problem, not a submitted job", () => {
    const shown = [];
    const responses = [{ answers: empty() }, { answers: { ...empty(), customText: "caption" } }];
    const result = collectViaForm(BRIDGE, (bridge, spec) => {
        shown.push(spec);
        assert.ok(responses.length, "unexpected extra form");

        return responses.shift();
    }, opening());

    assert.equal(result.settings.customText, "caption");
    assert.equal(result.settings.coordinateFormat, "none");
    assert.match(shown[1].detail, /nothing to stamp/u);
    assert.match(shown[1].detail, /You have selected 2 images/u);
    assert.equal(shown[1].rows.find((row) => row.key === "customText").invalid, true);
});

test("native failure after a correction carries the latest answers into the fallback", () => {
    for (const fail of [() => null, () => { throw new Error("native failure"); }]) {
        const app = createFakeApp();
        const typed = { ...defaultAnswers(FONTS), size: "huge", customText: "latest caption", margin: "81" };
        let seen = 0;

        app.displayDialog = (message, options) => {
            app.dialogs.push({ message, options });

            return {
                textReturned: options.defaultAnswer === "huge" ? "48" : options.defaultAnswer,
                buttonReturned: options.defaultButton
            };
        };
        const result = collectSettings(app, opening(), { bridge: BRIDGE, present() {
            seen += 1;

            return seen === 1 ? { answers: typed } : fail();
        } });

        assert.equal(seen, 2);
        assert.deepEqual({ size: result.size, margin: result.margin, caption: result.customText,
            coordinates: result.coordinateFormat },
        { size: 48, margin: 81, caption: "latest caption", coordinates: "none" });
        assert.ok(app.dialogs.some((dialog) => dialog.options.defaultAnswer === "huge"));
    }
});

test("valid answers accompanying native cancellation do not fall back", () => {
    const app = createFakeApp();

    assert.throws(() => collectSettings(app, opening(), {
        bridge: BRIDGE, present: () => ({ cancelled: true, answers: defaultAnswers(FONTS) })
    }), /cancelled/iu);
    assert.equal(app.dialogs.length, 0);
    assert.equal(app.listPrompts.length, 0);
});

test("fallback can validate the typeface even while a later field is invalid", () => {
    const app = createFakeApp();

    app.nextAnswer = ["caption", "Menlo", "36", "#FFFFFF", "2", "#202020", "24"];
    const settings = collectDialogSettings(app, { ...defaultAnswers(FONTS), margin: "bad" }, askingContext(FONTS));

    assert.equal(settings.font, "Menlo");
    assert.equal(settings.margin, 24);
    assert.equal(settings.coordinateFormat, "none");
    assert.equal(app.dialogs.at(-1).options.defaultButton, "Create");
});

test("fallback asks about inclusion first and only asks for format after opt-in", () => {
    const app = createFakeApp();
    const prompts = [];

    app.chooseFromList = (choices, options) => {
        prompts.push({ choices, options });

        return [choices.includes("On") ? "On" : options.defaultItems[0]];
    };
    const settings = collectDialogSettings(app, defaultAnswers(FONTS), askingContext(FONTS));

    assert.equal(settings.coordinateFormat, "decimal");
    assert.deepEqual(prompts[1].options.defaultItems, ["Off"]);
    assert.equal(prompts[2].choices.length, 2);
    assert.ok(!prompts[2].choices.includes("Do not stamp the coordinates"));
});

test("a returned Cancel wins over usable text in an individual fallback field", () => {
    assert.throws(() => askUntil({ displayDialog: () => ({ buttonReturned: "Cancel", textReturned: "36" }) }, {
        prompt: "Text size", defaultAnswer: "36"
    }, () => { throw new Error("the reader must not be reached"); }), /cancelled/iu);
});

test("fallback preserves an enabled submitted coordinate format rather than reopening Off", () => {
    const app = createFakeApp();
    const submitted = { ...defaultAnswers(FONTS), coordinateFormat: "56°56'58.6\"N 24°6'18.7\"E" };
    const settings = collectDialogSettings(app, submitted, askingContext(FONTS));

    assert.equal(settings.coordinateFormat, "sexagesimal");
    assert.deepEqual(app.listPrompts[1].settings.defaultItems, ["On"]);
    assert.deepEqual(app.listPrompts[2].settings.defaultItems, [submitted.coordinateFormat]);
});
