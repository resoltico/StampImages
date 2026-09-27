"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildForm } = require("../../../src/runtime/appkit-form.js");
const { presentForm, readControls, WIDGETS } = require("../../../src/runtime/appkit.js");
const { unbindChoices } = require("../../../src/runtime/appkit-choice.js");
const { formSpec } = require("../../../src/core/form.js");
const { defaultAnswers } = require("../../../src/core/form-defaults.js");
const { createFakeObjC } = require("./fake-objc.cjs");
const FONTS = ["Menlo"];
const OFF = "Do not stamp the coordinates";
const DMS = "56°56'58.6\"N 24°6'18.7\"E";

function build(coordinateFormat = OFF) {
    const bridge = createFakeObjC();
    const spec = formSpec({ ...defaultAnswers(FONTS), coordinateFormat }, [], { count: 1, fonts: FONTS });

    return { bridge, spec, ...buildForm(bridge, spec, WIDGETS) };
}

test("the native checkbox starts off with a disabled format selector, not an off menu entry", () => {
    const { controls, view } = build();
    const { toggle, popup } = controls.coordinateFormat;

    assert.deepEqual({ title: toggle.title, name: toggle.accessibilityLabel, state: toggle.state,
        mixed: toggle.allowsMixedState, enabled: popup.enabled, formatName: popup.accessibilityLabel },
    { title: "Include GPS coordinates", name: "Include GPS coordinates", state: 0,
        mixed: false, enabled: false, formatName: "Coordinate format:" });
    assert.match(toggle.accessibilityHelp, /does not remove location data already in the image/u);
    assert.deepEqual(popup.items.map((item) => item.title), ["56.9496, 24.1052", DMS]);
    assert.equal(popup.selected, "56.9496, 24.1052", "an off menu has a valid format ready for opt-in");
    // Not null: the bridge hands null to AppKit as NSNull, and binding with
    // NSNull options raised -[NSNull count] and took the whole form down.
    assert.deepEqual(toggle.binding, {
        name: "value", object: popup, key: "enabled", options: { kind: "empty dictionary" }
    });
    assert.ok(view.subviews.indexOf(toggle) < view.subviews.indexOf(popup), "checkbox precedes its format");
    assert.ok(toggle.frame.left + toggle.frame.width <= popup.rect.left);
});

function coordinateState(bridge, spec, controls) {
    const { toggle, popup } = controls.coordinateFormat;

    return { state: toggle.state, enabled: popup.enabled, format: popup.selected,
        answer: readControls(bridge, spec, controls).coordinateFormat };
}

test("off and on preserve the chosen format inside the form but submit only one domain choice", () => {
    const { bridge, spec, controls } = build(DMS);
    const { toggle } = controls.coordinateFormat;

    assert.deepEqual(coordinateState(bridge, spec, controls), { state: 1, enabled: true, format: DMS, answer: DMS });
    toggle.performClick();
    assert.deepEqual(coordinateState(bridge, spec, controls), { state: 0, enabled: false, format: DMS, answer: OFF });
    toggle.performClick();
    assert.deepEqual(coordinateState(bridge, spec, controls), { state: 1, enabled: true, format: DMS, answer: DMS });
});

test("the checkbox is a switch with no target or action to pass through the bridge", () => {
    // Made with checkboxWithTitle:target:action: and nulls, the first click
    // sent -null to NSNull and raised.
    const { toggle } = build().controls.coordinateFormat;

    assert.equal(toggle.buttonType, 3);
    assert.equal(Object.hasOwn(toggle, "target"), false);
    assert.equal(Object.hasOwn(toggle, "action"), false);
});

test("mixed state is not location opt-in, and binding cleanup names its binding", () => {
    const { bridge, spec, controls } = build(DMS);
    const { toggle } = controls.coordinateFormat;

    toggle.state = 2;
    assert.equal(readControls(bridge, spec, controls).coordinateFormat, OFF, "mixed/unknown is not opt-in");
    unbindChoices(spec, controls);
    assert.equal(toggle.unbound, "value");
});

test("ordinary inputs have accessible names and constraints, including the caption", () => {
    const { controls, spec } = build();

    for (const row of spec.rows.filter((item) => !item.optional)) {
        const control = controls[row.key].text ?? controls[row.key];

        assert.equal(control.accessibilityLabel, row.label, row.key);
        if (row.hint) {
            assert.equal(control.accessibilityHelp, row.hint, row.key);
        }
    }
});

test("binding teardown runs on success, Cancel and native abort without overriding the outcome", () => {
    for (const response of [1000, 1001, -1001]) {
        let checkbox = null;
        const bridge = createFakeObjC({ responses: [response], duringModal(alert) {
            checkbox = alert.accessoryView.subviews.find((child) => child.kind === "checkbox");
        } });
        const spec = formSpec(defaultAnswers(FONTS), [], { count: 1, fonts: FONTS });

        presentForm(bridge, spec);
        assert.equal(checkbox.unbound, "value");
    }
    const bridge = createFakeObjC({ responses: [1001], duringModal(alert) {
        const checkbox = alert.accessoryView.subviews.find((child) => child.kind === "checkbox");

        checkbox.unbind = () => { throw new Error("teardown refused"); };
    } });

    assert.deepEqual(presentForm(bridge, formSpec(defaultAnswers(FONTS), [], {
        count: 1, fonts: FONTS
    })), { cancelled: true });
});
