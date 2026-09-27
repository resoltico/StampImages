"use strict";

const {
    formSize,
    labelRect,
    controlRect
} = require("./appkit-geometry.js");
const { ADD_ROW } = require("./appkit-rows.js");
const { addOptionalChoice } = require("./appkit-choice.js");

/*
 * Turning the form description from src/core/form.js into a view: where each
 * row goes, and what each row becomes -- the second of which is
 * appkit-rows.js.
 *
 * Split from appkit.js so that laying the rows out and presenting the result
 * stay separately readable. The widget primitives arrive as a parameter,
 * which is what lets this be tested without AppKit.
 */

function buildForm(bridge, spec, widgets) {
    const rowCount = spec.rows.length;
    const { width, height } = formSize(rowCount);
    const view = widgets.makeView(bridge.ns, width, height);
    const context = { ns: bridge.ns, widgets, view };
    const controls = {};
    // The one row that is taller than the others, which every row above it
    // has to be lifted over.
    const caption = spec.rows.findIndex((row) => row.kind === "text");

    spec.rows.forEach((row, index) => {
        const at = { index, rowCount, caption };

        if (row.optional) {
            controls[row.key] = addOptionalChoice(context, row, {
                label: labelRect(at), control: controlRect(at)
            });
        } else {
            view.addSubview(widgets.makeLabel(bridge.ns, row.label, labelRect(at)));
            controls[row.key] = ADD_ROW[row.kind](context, row, controlRect(at));
        }
    });

    return { view, controls };
}

module.exports = { buildForm };
