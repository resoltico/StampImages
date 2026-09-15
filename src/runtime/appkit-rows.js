"use strict";

const {
    COLOUR_WIDTH,
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

function addChoice(context, row, rect) {
    const { ns, widgets, view } = context;
    const popup = widgets.makePopup(ns, rect);

    for (const option of row.options) {
        widgets.addPopupItem(popup, option);
    }

    popup.selectItemWithTitle(row.value);
    view.addSubview(popup);

    if (row.invalid) {
        widgets.markInvalid(ns, popup);
    }

    return popup;
}

/*
 * A row that is typed into: the control, only as wide as what it holds, and
 * the space that would have been wasted carrying the rule it accepts.
 *
 * The colour row and the number rows differ in the control and in how wide it
 * is, and in nothing else -- so they differ here in the control and in how
 * wide it is, and in nothing else.
 */
/*
 * The value, and the rule it breaks -- but only where the hint is a rule.
 *
 * "8-400 pt" in red says what the number had to be. "or type a name" in red
 * said, to somebody who had just typed one, that they had not. Reported from
 * use, and the red hint was the loudest thing on the row.
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

function addTyped(context, row, rect, control) {
    const { ns, widgets, view } = context;
    const { width, make } = control;
    const field = make({ ...rect, width });
    const hint = widgets.makeHint(ns, row.hint, hintRect(rect, width));

    view.addSubview(field);
    view.addSubview(hint);

    markRefused(context, row, { field, hint });

    return field;
}

/*
 * A list and a field at once, so what is worth having at hand stays available
 * without a second control to keep in step with it -- and what is not on the
 * list can still be said. A colour and the typeface are both this, and they
 * differ in how wide the field has to be and in nothing else.
 */
function addCombo(width) {
    return (context, row, rect) => addTyped(context, row, rect, {
        width,
        make: (frame) => context.widgets.makeCombo(context.ns, row, frame)
    });
}

/*
 * Free text takes the whole control column and states its rule nowhere: what
 * it accepts is anything, and the only bound is a length nobody reaches by
 * writing a caption. It is taller than the other rows because it is the one
 * that can hold more than a line.
 */
function addText(context, row, rect) {
    const { ns, widgets, view } = context;
    const caption = widgets.makeCaption(ns, row.value, {
        ...rect,
        width: TEXT_WIDTH,
        height: CAPTION_HEIGHT
    });

    view.addSubview(caption.control);

    if (row.invalid) {
        widgets.markInvalid(ns, caption.text);
    }

    return caption;
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
    colour: addCombo(COLOUR_WIDTH),
    text: addText,
    number: addNumber
};

module.exports = { ADD_ROW };
