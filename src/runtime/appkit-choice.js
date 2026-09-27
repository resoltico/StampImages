"use strict";

const { rectOf } = require("./appkit-bridge.js");
const { makeChoice } = require("./appkit-rows.js");

/*
 * A checkbox controls inclusion; its adjacent menu controls formatting.
 * They submit one enum, not two settings that can contradict each other.
 * The checkbox's value binding writes the popup's enabled property directly;
 * no notification from NSButton.state and no custom delegate is required.
 *
 * Made as a plain button turned into a switch rather than with
 * checkboxWithTitle:target:action:, because that has no target or action to
 * give it: the bridge passes null as NSNull and a selector named "null", and
 * the first click sent -null to NSNull and raised. Measured through osascript.
 */
const SWITCH_BUTTON = 3;
function makeSwitch(ns, rect, label) {
    const toggle = ns.NSButton.alloc.initWithFrame(rectOf(ns, rect));

    toggle.setButtonType(SWITCH_BUTTON);
    toggle.title = label;
    toggle.allowsMixedState = false;

    return toggle;
}

function makeToggle(ns, row, rect, popup) {
    const toggle = makeSwitch(ns, rect, row.optional.label);
    const enabled = row.value !== row.optional.offLabel;

    toggle.state = enabled ? 1 : 0;
    toggle.setAccessibilityLabel(row.optional.label);
    toggle.setAccessibilityHelp(row.optional.help);
    popup.enabled = enabled;
    // An empty dictionary, not null: the bridge passes null as NSNull, which
    // AppKit asks for its count and raises on. Measured through osascript.
    toggle.bindToObjectWithKeyPathOptions(
        "value", popup, "enabled", ns.NSDictionary.dictionary
    );

    return toggle;
}

function addOptionalChoice(context, row, rects) {
    const options = row.options.filter((option) => option.label !== row.optional.offLabel);
    const enabled = row.value !== row.optional.offLabel;
    const popup = makeChoice(context, {
        ...row,
        options,
        value: enabled ? row.value : options[0].label
    }, rects.control);
    const toggle = makeToggle(context.ns, row, rects.label, popup);

    context.view.addSubview(toggle);
    context.view.addSubview(popup);

    return { control: popup, popup, toggle };
}

function optionalAnswer(bridge, row, control) {
    return Number(bridge.objc.unwrap(control.toggle.state)) === 1
        ? control.popup.titleOfSelectedItem
        : row.optional.offLabel;
}

function unbindChoices(spec, controls) {
    for (const row of spec.rows) {
        if (row.optional) {
            try {
                controls[row.key].toggle.unbind("value");
            } catch {
                // Teardown must not turn Cancel into a fallback prompt.
            }
        }
    }
}

module.exports = { addOptionalChoice, optionalAnswer, unbindChoices };
