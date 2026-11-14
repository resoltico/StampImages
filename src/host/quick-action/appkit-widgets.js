"use strict";
const { rectOf } = require("./appkit-bridge.js");

/*
 * Construct form views, labels, menus and alerts through an injected ObjC
 * namespace. Fakes establish composition and property assignments; native
 * integration checks rendering. Keep domain and answer-validation decisions
 * in the settings model rather than these widget primitives.
 */

const HINT_FONT_SIZE = 11;

// A tint rather than a solid fill, and drawn from the system red so it
// follows the appearance the alert is rendered in. A fixed pink would be
// wrong the moment the form appears in dark mode.
const INVALID_TINT_ALPHA = 0.18;

// NSTextAlignmentRight. On macOS right is 1 and center is 2, which is the
// reverse of UIKit, so the constant is named rather than written inline.
const ALIGN_RIGHT = 1;

/*
 * NSLineBreakByTruncatingTail: show an ellipsis when a label exceeds its
 * column rather than clipping it into a misleading incomplete phrase.
 */

const TRUNCATE_TAIL = 4;

function makeView(ns, width, height) {
    return ns.NSView.alloc.initWithFrame(ns.NSMakeRect(0, 0, width, height));
}

function makeLabel(ns, text, rect) {
    const label = ns.NSTextField.alloc.initWithFrame(
        rectOf(ns, rect)
    );

    label.stringValue = text;
    label.editable = false;
    label.bezeled = false;
    label.drawsBackground = false;
    label.selectable = false;
    // Right against the controls, which is how a macOS form associates a
    // name with the thing it names.
    label.alignment = ALIGN_RIGHT;
    label.lineBreakMode = TRUNCATE_TAIL;

    return label;
}

/*
 * The bounds a field accepts, shown beside it rather than folded into its
 * name: smaller, secondary, and free to be as long as it needs.
 */
function makeHint(ns, text, rect) {
    const hint = ns.NSTextField.alloc.initWithFrame(
        rectOf(ns, rect)
    );

    hint.stringValue = text;
    hint.editable = false;
    hint.bezeled = false;
    hint.drawsBackground = false;
    hint.selectable = false;
    hint.font = ns.NSFont.systemFontOfSize(HINT_FONT_SIZE);
    hint.textColor = ns.NSColor.secondaryLabelColor;
    hint.lineBreakMode = TRUNCATE_TAIL;

    return hint;
}

function makePopup(ns, rect) {
    return ns.NSPopUpButton.alloc.initWithFramePullsDown(
        rectOf(ns, rect),
        false
    );
}

function addPopupItem(popup, option) {
    popup.addItemWithTitle(option.label);

    return popup.lastItem;
}

/*
 * Shows which control the message above the form is talking about. Applied by
 * the layout, which knows whether a row is in the problem list; this only
 * draws it.
 */
function markInvalid(ns, control) {
    control.drawsBackground = true;
    control.backgroundColor = ns.NSColor.systemRedColor
        .colorWithAlphaComponent(INVALID_TINT_ALPHA);
}

function markHintInvalid(ns, hint) {
    hint.textColor = ns.NSColor.systemRedColor;
}

function makeAlert(ns, spec) {
    const alert = ns.NSAlert.alloc.init;

    alert.messageText = spec.title;
    alert.informativeText = spec.detail;

    for (const button of spec.buttons) {
        alert.addButtonWithTitle(button);
    }

    return alert;
}

module.exports = {
    makeView,
    makeLabel,
    makeHint,
    makePopup,
    addPopupItem,
    markInvalid,
    markHintInvalid,
    makeAlert
};
