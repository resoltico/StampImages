"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildForm } = require("../../../src/runtime/appkit-form.js");
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

test("a row named in the problems is marked, and the others are not", () => {
    // Reading which field is wrong and seeing it should not be different jobs.
    const spec = specFor({ ...defaultAnswers(FONTS), size: "nope" }, [{ key: "size", message: "Text size: enter a whole number from 8 to 400." }]);
    const bridge = createFakeObjC();
    const { controls } = buildForm(bridge, spec, WIDGETS);

    assert.equal(controls.size.drawsBackground, true);
    assert.equal(controls.size.backgroundColor.name, "systemRed");
    assert.ok(
        controls.size.backgroundColor.alpha < 0.5,
        "a tint, not a fill: the value must stay readable"
    );

    for (const key of ["margin", "position", "textColour"]) {
        assert.notEqual(
            controls[key].drawsBackground,
            true,
            `${key} is not in the problem list and must not be marked`
        );
    }
});

test("the rule a value breaks is marked along with the value", () => {
    const spec = specFor({ ...defaultAnswers(FONTS), margin: "5000" }, [{ key: "margin", message: "Margin: enter a whole number from 0 to 2000." }]);
    const bridge = createFakeObjC();
    const { view } = buildForm(bridge, spec, WIDGETS);
    const hints = view.subviews.filter((child) => child.editable === false
        && String(child.stringValue).includes("-"));
    const marginHint = hints.find((hint) => hint.stringValue.includes("2000 px"));
    const sizeHint = hints.find((hint) => hint.stringValue.includes("pt"));

    assert.equal(marginHint.textColor.name, "systemRed");
    assert.equal(sizeHint.textColor.name, "secondaryLabel", "the valid rule stays quiet");
});

test("a choice row can be marked too, not only a typed one", () => {
    // Rare, but reachable: an answer that is not one of the options at all.
    const spec = specFor({ ...defaultAnswers(FONTS), position: "Sideways" }, [{ key: "position", message: 'Position: "Sideways" is not one of the choices.' }]);
    const { controls } = buildForm(createFakeObjC(), spec, WIDGETS);

    assert.equal(controls.position.drawsBackground, true);
    assert.equal(controls.position.backgroundColor.name, "systemRed");
});

test("a hint that offers is not marked with the value it did not rule out", () => {
    // "8-400 pt" in red says what the number had to be. "or type a name" in
    // red said, to somebody who had just typed one, that they had not --
    // reported from use, and the loudest thing on the row.
    const { view } = build(specFor(undefined, [
        { key: "font", message: "nothing draws with it" },
        { key: "size", message: "out of range" }
    ]));
    const { hints } = columnsOf(view);
    const colourOf = (text) => hints.find(
        (hint) => hint.stringValue === text
    ).textColor.name;

    assert.equal(
        colourOf("8-400 pt"),
        "systemRed",
        "the rule a number broke is marked with it"
    );
    assert.equal(
        colourOf("or type a name"),
        "secondaryLabel",
        "and an offer is left alone, however wrong the value beside it"
    );
});
