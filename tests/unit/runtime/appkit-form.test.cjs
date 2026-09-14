"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildForm } = require("../../../src/runtime/appkit-form.js");
const {
    FORM_WIDTH,
    ROW_HEIGHT,
    NUMBER_WIDTH,
    CAPTION_HEIGHT,
    CAPTION_LINES,
    PADDING
} = require("../../../src/runtime/appkit-geometry.js");
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

test("every row becomes a label, a control, and a hint where it has one", () => {
    const { spec, view, controls } = build();
    const withHints = spec.rows.filter((row) => row.hint).length;

    assert.equal(view.subviews.length, spec.rows.length * 2 + withHints);
    assert.equal(Object.keys(controls).length, spec.rows.length);
    assert.equal(withHints, 5, "every bounded row states the bound it accepts");

    for (const row of spec.rows) {
        assert.ok(controls[row.key], `${row.key} has no control`);
    }
});

test("rows read top to bottom, which is upside down in AppKit", () => {
    // AppKit's origin is the bottom left, so the first row needs the highest
    // y. Laid out naively the form reads in reverse.
    const { spec, controls } = build();
    const tops = spec.rows.map((row) => {
        const control = controls[row.key];

        return (control.control ?? control).rect.bottom;
    });

    for (let index = 1; index < tops.length; index += 1) {
        assert.ok(
            tops[index] < tops[index - 1],
            `row ${index} must sit below row ${index - 1}`
        );
    }

    assert.equal(
        tops[0],
        PADDING + (spec.rows.length + CAPTION_LINES - 2) * ROW_HEIGHT,
        "the first row clears every row below it, the deep one included"
    );
    assert.equal(
        tops.at(-1),
        PADDING,
        "the last row is inset, not flush against the buttons below"
    );
});

test("a choice row offers every option, in order", () => {
    const { controls } = build();
    const { position } = controls;

    assert.equal(position.kind, "popup");
    assert.deepEqual(position.items.map((item) => item.title), [
        "Bottom right",
        "Bottom left",
        "Top right",
        "Top left",
        "Bottom centre",
        "Top centre"
    ]);
});

test("a menu item is a title and nothing else", () => {
    // The colours used to carry a swatch in a menu. They are in a combo box
    // now, whose list holds strings, so nothing builds an image and no option
    // carries one.
    const { controls } = build();

    for (const item of controls.position.items) {
        assert.equal(item.image, null, `${item.title} needs no image`);
    }
});

test("a number row becomes a narrow editable field holding its value", () => {
    // Only as wide as four digits need; the rest of the column is the hint.
    const { controls } = build(specFor({ ...defaultAnswers(FONTS), size: "150" }));

    assert.equal(controls.size.kind, "field");
    assert.equal(controls.size.stringValue, "150");
    assert.equal(controls.size.rect.width, NUMBER_WIDTH);
    assert.ok(NUMBER_WIDTH < FORM_WIDTH / 2, "a number needs no half the form");
});

test("each numeric field is told the bounds it accepts", () => {
    const { view } = build();
    const hints = view.subviews
        .filter((child) => child.editable === false)
        .map((child) => child.stringValue);

    assert.ok(hints.includes("8-400 pt"), hints.join(" | "));
    assert.ok(hints.includes("0-2000 px"), hints.join(" | "));
    assert.ok(hints.includes("0-20 px, 0 for none"), hints.join(" | "));
});

test("the form is as tall as it has rows, plus the caption's extra depth", () => {
    // The caption is the one row that can hold more than a line, so it is
    // three rows deep and everything above it sits that much higher.
    const { spec, view, controls } = build();

    assert.equal(
        view.rect.height,
        (spec.rows.length + CAPTION_LINES - 1) * ROW_HEIGHT + PADDING * 2
    );
    assert.equal(view.rect.width, FORM_WIDTH);
    assert.equal(controls.customText.control.rect.height, CAPTION_HEIGHT);
    assert.ok(CAPTION_HEIGHT > ROW_HEIGHT, "deeper than a row that holds one line");
});

test("a caption is a text view, because a field cannot take a second line", () => {
    // Return commits the alert rather than starting another line, so the
    // promise that your text keeps its line breaks was one the form could not
    // keep: only a headless caller could.
    const { controls } = build(specFor({ ...defaultAnswers(FONTS), customText: "Riga\nLatvia" }));

    assert.equal(controls.customText.control.kind, "scroll");
    assert.equal(controls.customText.text.kind, "textview");
    assert.equal(controls.customText.text.string, "Riga\nLatvia");
    assert.equal(controls.customText.text.richText, false, "a caption is text");
});
