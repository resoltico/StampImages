"use strict";

const { rectOf } = require("./appkit-bridge.js");

/*
 * The controls a person types into. AppKit is touched here and in
 * appkit-widgets.js and nowhere else; the namespace arrives as a parameter so
 * the composition above can be driven by a fake, and what a fake cannot prove
 * is that any of it renders.
 */

// NSBezelBorder, so the caption looks like something to type in.
const BEZEL_BORDER = 2;
const FIELD_FONT_SIZE = 13;

function makeField(ns, text, rect) {
    const field = ns.NSTextField.alloc.initWithFrame(
        rectOf(ns, rect)
    );

    field.stringValue = text;

    return field;
}

/*
 * A list to choose from and a field to type in, as one control in one row.
 *
 * NSComboBox is the only control that is both, which is what keeps the form
 * at six rows and keeps the background a single setting: there is no second
 * field to reconcile with a menu, and no "Custom..." step that makes a row
 * appear.
 *
 * What it costs is the colour swatch the four presets carried in their menu.
 * A combo box list holds strings, and a swatch beside the field instead would
 * be telling the truth only until the next keystroke -- so the colours
 * themselves are the whole of what the list shows now, and what they are
 * called is said in the form around it.
 *
 * Completion is off deliberately. With it on, typing over a selected preset
 * offers to finish the word, and what the field holds is then something the
 * user did not type.
 */
function makeColourCombo(ns, row, rect) {
    const combo = ns.NSComboBox.alloc.initWithFrame(
        rectOf(ns, rect)
    );

    combo.usesDataSource = false;
    combo.editable = true;
    combo.completes = false;
    combo.numberOfVisibleItems = row.options.length;
    combo.addItemsWithObjectValues(
        ns(row.options.map((option) => option.label))
    );
    combo.stringValue = row.value;
    combo.setAccessibilityLabel(row.label);

    return combo;
}

/*
 * The one control a caption can actually be typed into.
 *
 * A text field is one line: Return commits the alert rather than starting
 * another, so the promise that your text keeps its line breaks was a promise
 * the form could not keep -- only a headless caller could. A text view in a
 * scroll view takes as many lines as somebody types, and is read back through
 * `string` rather than `stringValue`, which is why the form asks each control
 * what it is rather than assuming.
 */
function plainTextView(ns, text, rect) {
    const view = ns.NSTextView.alloc.initWithFrame(rectOf(ns, rect));

    view.string = text;
    // A caption is text. Rich text, smart quotes and smart dashes all change
    // what somebody typed into something else on its way to the photograph.
    view.richText = false;
    view.automaticQuoteSubstitutionEnabled = false;
    view.automaticDashSubstitutionEnabled = false;
    view.font = ns.NSFont.systemFontOfSize(FIELD_FONT_SIZE);

    return view;
}

function makeCaption(ns, text, rect) {
    const scroll = ns.NSScrollView.alloc.initWithFrame(rectOf(ns, rect));
    const view = plainTextView(ns, text, rect);

    scroll.documentView = view;
    scroll.hasVerticalScroller = true;
    scroll.borderType = BEZEL_BORDER;

    return { control: scroll, text: view };
}

module.exports = { makeField, makeColourCombo, makeCaption };
