"use strict";
const {
    COLOR_WIDTH,
    FONT_WIDTH,
    TEXT_WIDTH,
    CAPTION_HEIGHT,
    NUMBER_WIDTH,
    hintRect
} = require("./appkit-geometry.js");

/*
 * One row of the form, turned into the widget that asks it.
 *
 * Five kinds and one table: a closed list is a menu, an open one is a list and
 * a field at once, a number is a narrow field with its bounds beside it, and a
 * caption is the one control that takes more than a line. Where each of them
 * goes is appkit-form.js; this is what each of them is.
 */

function makeChoice(context, row, rect) {
    const { ns, widgets } = context;
    const popup = widgets.makePopup(ns, rect);

    for (const option of row.options) {
        widgets.addPopupItem(popup, option);
    }

    popup.setAccessibilityLabel(row.label);
    popup.selectItemWithTitle(row.value);

    if (row.invalid) {
        widgets.markInvalid(ns, popup);
    }

    return popup;
}

/*
 * Highlight the invalid value and any hint that states a validation rule.
 * Keep suggestion hints such as "or type a name" neutral: typing a name is
 * allowed even when that particular name cannot be resolved.
 */
function markRefused(context, row, made) {
    if (!row.invalid) {
        return;
    }

    context.widgets.markInvalid(context.ns, made.field);

    if (!row.suggests) {
        context.widgets.markHintInvalid(context.ns, made.hint);
    }
}

/*
 * Compose editable controls at the width their values need, then use the
 * remaining column space for the applicable hint.
 */
function addTyped(context, row, rect, control) {
    const { ns, widgets, view } = context;
    const { width, make } = control;
    const field = make({ ...rect, width });
    const hint = widgets.makeHint(ns, row.hint, hintRect(rect, width));

    field.setAccessibilityLabel(row.label);
    field.setAccessibilityHelp(row.hint);

    view.addSubview(field);
    view.addSubview(hint);

    markRefused(context, row, { field, hint });

    return field;
}

/*
 * A list and a field at once, so what is worth having at hand stays available
 * without a second control to keep in step with it -- and what is not on the
 * list can still be said. A color and the typeface are both this, and they
 * differ in how wide the field has to be and in nothing else.
 */
function addCombo(width) {
    return (context, row, rect) => addTyped(context, row, rect, {
        width,
        make: (frame) => context.widgets.makeCombo(context.ns, row, frame)
    });
}

/*
 * Use the whole column and a taller view for multiline custom text. Show any
 * length or text-validation problem in the form's correction list rather than
 * adding a second hint beside the caption.
 */
function addText(context, row, rect) {
    const { ns, widgets, view } = context;
    const caption = widgets.makeCaption(ns, row.value, {
        ...rect,
        width: TEXT_WIDTH,
        height: CAPTION_HEIGHT
    }, context.objc);

    caption.text.setAccessibilityLabel(row.label);
    view.addSubview(caption.control);

    if (row.invalid) {
        widgets.markInvalid(ns, caption.text);
    }

    return caption;
}

function addChoice(context, row, rect) {
    const popup = makeChoice(context, row, rect);

    context.view.addSubview(popup);

    return popup;
}

function addNumber(context, row, rect) {
    return addTyped(context, row, rect, {
        width: NUMBER_WIDTH,
        make: (frame) => context.widgets.makeField(context.ns, row.value, frame)
    });
}

const ADD_ROW = {
    choice: addChoice,
    font: addCombo(FONT_WIDTH),
    color: addCombo(COLOR_WIDTH),
    text: addText,
    number: addNumber
};

module.exports = { ADD_ROW, makeChoice };
