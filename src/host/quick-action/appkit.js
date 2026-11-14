"use strict";
const {
    makeView,
    makeLabel,
    makeHint,
    makePopup,
    addPopupItem,
    markInvalid,
    markHintInvalid,
    makeAlert
} = require("./appkit-widgets.js");
const { makeField, makeCombo, makeCaption } = require("./appkit-fields.js");
const { buildForm } = require("./appkit-form.js");
const { perform } = require("./appkit-bridge.js");
const { optionalAnswer, unbindChoices } = require("./appkit-choice.js");

// Gathered into one object so a test can substitute the whole widget layer.
const { makeDetails } = require("./details-dialog.js");
const WIDGETS = {
    makeDetails,
    makeView,
    makeLabel,
    makeHint,
    makePopup,
    addPopupItem,
    makeField,
    makeCombo,
    makeCaption,
    markInvalid,
    markHintInvalid,
    makeAlert
};

/*
 * One window instead of ten sequential prompts.
 *
 * The ObjC namespace and the widget primitives are both parameters, so the
 * composition here — which rows become which controls, and what comes back
 * out of them — is unit tested against fakes. Only appkit-widgets.js touches
 * AppKit for real.
 *
 * A form that never appears would leave the user with nothing, so a modal
 * that ends any way other than by one of its buttons is reported as "could
 * not present" rather than as an answer. The caller then falls back to the
 * stepwise dialogs, which need no AppKit at all.
 */

/*
 * A modal response other than a form button makes the form unavailable, so
 * stepwise dialogs can ask instead. Do not impose a timeout on working forms:
 * choosing settings can take arbitrarily long. Native abort is -1001; -1000
 * is the distinct stop response.
 */
const RESPONSE_ABORT = -1001;
const FIRST_BUTTON = 1000;

/*
 * What one control holds. A menu answers with the title it is showing, a
 * caption with the text of its view, and everything else with the value its
 * cell last committed -- which is why the editor is asked to commit first.
 */
function heldBy(bridge, row, control) {
    if (row.optional) {
        return optionalAnswer(bridge, row, control);
    }

    if (row.kind === "choice") {
        return control.titleOfSelectedItem;
    }

    if (row.kind === "text") {
        return control.text.string;
    }

    return control.stringValue;
}

function readControls(bridge, spec, controls) {
    const answers = {};

    for (const row of spec.rows) {
        const control = controls[row.key];

        if (row.kind !== "choice" && row.kind !== "text") {
            /*
             * What is being typed lives in the window's field editor until
             * something commits it, and stringValue is what was last
             * committed. Clicking a button usually ends editing first, which
             * is not the same as always: a value typed and submitted without
             * leaving the field would otherwise be read as the one before it.
             * validateEditing copies the editor's contents into the cell, and
             * is documented to do exactly that.
             *
             * A zero-argument ObjC method, which JXA invokes on property
             * access -- written with parentheses it would call the result.
             */
            // eslint-disable-next-line no-unused-expressions
            control.validateEditing;
        }

        answers[row.key] = String(bridge.objc.unwrap(heldBy(bridge, row, control)));
    }

    return answers;
}

function editorFor(row, control) {
    if (row.kind === "text") { return control.text; }
    if (row.optional) { return control.toggle; }
    return control;
}

function presentForm(bridge, spec, widgets = WIDGETS) {
    const { view, controls, details } = buildForm(bridge, spec, widgets);

    try {
        const alert = widgets.makeAlert(bridge.ns, spec);

        alert.accessoryView = view;
        const focus = spec.rows.find((row) => row.invalid) ?? spec.rows[0];
        alert.window.initialFirstResponder = editorFor(focus, controls[focus.key]);
        // Measured: laid out inside a running alert, the note opened two lines
        // down, hiding the outcome line that leads it. It is laid out first and
        // put back at its start.
        perform(alert, "layout");
        details.contentView.scrollToPoint(bridge.ns.NSMakePoint(0, 0));
        details.reflectScrolledClipView(details.contentView);

        const response = Number(alert.runModal);

        if (response === RESPONSE_ABORT) {
            return null;
        }

        return response === FIRST_BUTTON
            ? { answers: readControls(bridge, spec, controls) }
            : { canceled: true };
    } finally {
        unbindChoices(spec, controls);
    }
}

module.exports = { presentForm, readControls, WIDGETS };
