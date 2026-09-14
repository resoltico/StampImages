"use strict";

/*
 * The colour rows, which are the one control that is a list and a field at
 * once. A popup could offer the presets and nothing else; a plain field could
 * take any colour and offer nothing. The row has to do both, in one control,
 * or the form grows a second one to keep in step with the first.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildForm } = require("../../../src/runtime/appkit-form.js");
const { COLOUR_WIDTH } = require("../../../src/runtime/appkit-geometry.js");
const { WIDGETS } = require("../../../src/runtime/appkit.js");
const { formSpec } = require("../../../src/core/form.js");
const { defaultAnswers } = require("../../../src/core/form-defaults.js");
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

test("a colour is a control that is a list and a field at once", () => {
    // A popup could offer the presets and nothing else; a plain field could
    // take any colour and offer nothing. The row has to do both, in one
    // control, or the form grows a second one to keep in step with the first.
    const { controls } = build();
    const { textColour } = controls;

    assert.equal(textColour.kind, "combo");
    assert.deepEqual(
        textColour.items,
        ["#FFFFFF", "#000000", "#FFD400", "#FF3B30"],
        "the presets as the colours they are"
    );
    assert.equal(
        textColour.stringValue,
        "#FFFFFF",
        "and the field showing a value, which is what makes it look like one"
    );
    assert.equal(textColour.editable, true, "and it can be typed into");
    assert.equal(textColour.completes, false, "without finishing the word for you");
    assert.equal(textColour.rect.width, COLOUR_WIDTH, "as wide as a colour needs");
    assert.equal(textColour.accessibilityLabel, "Text colour:");
});

test("a colour that could not be read is marked, keeping what was typed", () => {
    // The raw text stays in the control rather than being replaced by a
    // preset, so correcting it is a correction and not a retype.
    const spec = specFor({ ...defaultAnswers(FONTS), outlineColour: "c7dae" }, [{ key: "outlineColour", message: "Outline colour must be six hex digits." }]);
    const { controls } = build(spec);

    assert.equal(controls.outlineColour.stringValue, "c7dae", "what was typed");
    assert.equal(controls.outlineColour.drawsBackground, true);
    assert.equal(controls.outlineColour.backgroundColor.name, "systemRed");
});

test("the text row is marked too, when there is too much of it", () => {
    // It takes the whole control column and has no hint beside it to mark, so
    // the field itself is the whole of what shows which row is wrong.
    const spec = specFor({ ...defaultAnswers(FONTS), customText: "x".repeat(501) }, [{ key: "customText", message: "Your own text: 500 characters or fewer." }]);
    const { controls } = build(spec);

    assert.equal(controls.customText.text.drawsBackground, true);
    assert.equal(controls.customText.text.backgroundColor.name, "systemRed");
});
