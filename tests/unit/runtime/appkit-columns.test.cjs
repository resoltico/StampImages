"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildForm } = require("../../../src/runtime/appkit-form.js");
const { FORM_WIDTH } = require("../../../src/runtime/appkit-geometry.js");
const { WIDGETS } = require("../../../src/runtime/appkit.js");
const { formSpec } = require("../../../src/core/form.js");
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

function columnsOf(view) {
    const editable = view.subviews.filter((child) => child.kind === "popup"
        || child.kind === "combo"
        || (child.kind === "field" && child.editable !== false));
    const [first] = editable;

    return {
        editable,
        first,
        labels: view.subviews.filter((child) => child.editable === false
            && child.rect.left < first.rect.left),
        hints: view.subviews.filter((child) => child.editable === false
            && child.rect.left > first.rect.left)
    };
}

test("labels end before the controls begin", () => {
    const { spec, view } = build();
    const { labels, first } = columnsOf(view);

    assert.equal(labels.length, spec.rows.length);

    for (const label of labels) {
        assert.ok(
            label.rect.left + label.rect.width <= first.rect.left,
            `${label.stringValue} runs into its control`
        );
    }
});

test("a hint sits past the control it belongs to, whatever its width", () => {
    // The rows that are typed into are not all the same width, so a hint
    // placed a fixed distance along would sit on top of one of them.
    const { view, controls, spec } = build();
    const { hints } = columnsOf(view);

    assert.equal(
        hints.length,
        6,
        "the typeface, the two colours and the three numbers"
    );

    for (const row of spec.rows.filter((candidate) => candidate.hint)) {
        const control = controls[row.key];
        const hint = hints.find((candidate) => candidate.stringValue === row.hint);

        assert.ok(hint, `${row.key} has no hint on the form`);
        assert.ok(
            hint.rect.left >= control.rect.left + control.rect.width,
            `${row.key}: the hint overlaps the control it describes`
        );
        assert.ok(
            hint.rect.left + hint.rect.width <= FORM_WIDTH,
            `${row.key}: the hint runs off the form`
        );
    }
});

test("no control runs off the edge of the form", () => {
    const { view } = build();

    for (const control of columnsOf(view).editable) {
        assert.ok(control.rect.left + control.rect.width <= FORM_WIDTH);
    }
});

test("a hint is centred against the field it describes", () => {
    // Off-centre by a few points reads as a misalignment rather than as a
    // caption, and the sign of the offset decides whether it sits above or
    // below the value it qualifies.
    const { view, controls } = buildForm(createFakeObjC(), specFor(), WIDGETS);
    const hints = view.subviews.filter((child) => child.editable === false
        && String(child.stringValue).includes("pt"));
    const [hint] = hints;
    const field = controls.size;

    const centreOf = (rect) => rect.bottom + (rect.height / 2);

    assert.equal(centreOf(hint.rect), centreOf(field.rect));
    assert.ok(hint.rect.height < field.rect.height, "the hint is the smaller of the two");
});
