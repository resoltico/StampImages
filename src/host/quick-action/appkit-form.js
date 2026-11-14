"use strict";
const {
    formSize,
    labelRect,
    controlRect
} = require("./appkit-geometry.js");
const { ADD_ROW } = require("./appkit-rows.js");
const { addOptionalChoice } = require("./appkit-choice.js");

/*
 * Lay out the quick-action form description and compose each row through
 * appkit-rows.js. Keep layout separate from modal presentation in appkit.js;
 * injected widget primitives let tests inspect composition without AppKit.
 */

const DETAILS_HEIGHT = 110;
const DETAILS_GAP = 10;
function buildForm(bridge, spec, widgets) {
    const rowCount = spec.rows.length;
    const { width, height } = formSize(rowCount);
    const view = widgets.makeView(bridge.ns, width, height + DETAILS_HEIGHT + DETAILS_GAP);
    const details = widgets.makeDetails(bridge.ns, spec.fullDetail, { left: 0, bottom: height + DETAILS_GAP, width, height: DETAILS_HEIGHT });
    view.addSubview(details);
    const context = { ns: bridge.ns, objc: bridge.objc, widgets, view };
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

    return { view, controls, details };
}

module.exports = { buildForm };
