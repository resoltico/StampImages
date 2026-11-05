"use strict";

/*
 * The color rows, which are the one control that is a list and a field at
 * once. A popup could offer the presets and nothing else; a plain field could
 * take any color and offer nothing. The row has to do both, in one control,
 * or the form grows a second one to keep in step with the first.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildForm } = require("../../../src/host/appkit-form.js");
const { COLOR_WIDTH } = require("../../../src/host/appkit-geometry.js");
const { WIDGETS } = require("../../../src/host/appkit.js");
const { formSpec } = require("../../../src/host/form.js");
const { defaultAnswers } = require("../../../src/host/form-defaults.js");
const { createFakeObjC } = require("./fake-objc.cjs");

const FONTS = ["Menlo", "Menlo Bold"];
const CONTEXT = { count: 1, fonts: FONTS };

function specFor(answers, problems = []) {
    return formSpec(answers, problems, CONTEXT);
}

function build(spec = specFor()) {
    const bridge = createFakeObjC();

    return { bridge, spec, ...buildForm(bridge, spec, WIDGETS) };
}

test("a color is a control that is a list and a field at once", () => {
    // A popup could offer the presets and nothing else; a plain field could
    // take any color and offer nothing. The row has to do both, in one
    // control, or the form grows a second one to keep in step with the first.
    const { controls } = build();
    const { textColor } = controls;

    assert.equal(textColor.kind, "combo");
    assert.deepEqual(
        textColor.items,
        ["#FFFFFF", "#000000", "#FFD400", "#FF3B30"],
        "the presets as the colors they are"
    );
    assert.equal(
        textColor.stringValue,
        "#FFFFFF",
        "and the field showing a value, which is what makes it look like one"
    );
    assert.equal(textColor.editable, true, "and it can be typed into");
    assert.equal(textColor.completes, false, "without finishing the word for you");
    assert.equal(textColor.rect.width, COLOR_WIDTH, "as wide as a color needs");
    assert.equal(textColor.accessibilityLabel, "Text color:");
});

test("a color that could not be read is marked, keeping what was typed", () => {
    // The raw text stays in the control rather than being replaced by a
    // preset, so correcting it is a correction and not a retype.
    const spec = specFor({ ...defaultAnswers(FONTS), outlineColor: "c7dae" }, [{ key: "outlineColor", message: "Outline color must be six hex digits." }]);
    const { controls } = build(spec);

    assert.equal(controls.outlineColor.stringValue, "c7dae", "what was typed");
    assert.equal(controls.outlineColor.drawsBackground, true);
    assert.equal(controls.outlineColor.backgroundColor.name, "systemRed");
});

test("the text row is marked too, when there is too much of it", () => {
    // It takes the whole control column and has no hint beside it to mark, so
    // the field itself is the whole of what shows which row is wrong.
    const spec = specFor({ ...defaultAnswers(FONTS), customText: "x".repeat(501) }, [{ key: "customText", message: "Your own text: 500 characters or fewer." }]);
    const { controls } = build(spec);

    assert.equal(controls.customText.text.drawsBackground, true);
    assert.equal(controls.customText.text.backgroundColor.name, "systemRed");
});
