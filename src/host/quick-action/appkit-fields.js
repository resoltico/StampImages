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
 * What it costs is the color swatch the four presets carried in their menu.
 * A combo box list holds strings, and a swatch beside the field instead would
 * be telling the truth only until the next keystroke -- so the colors
 * themselves are the whole of what the list shows now, and what they are
 * called is said in the form around it.
 *
 * Completion is off deliberately. With it on, typing over a selected preset
 * offers to finish the word, and what the field holds is then something the
 * user did not type.
 */
function makeCombo(ns, row, rect) {
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

/*
 * Tab moves on, as it does in every other field of the form. A text view
 * inserts a tab character by default, so a person working by keyboard could
 * not leave the caption except with Control-Tab -- measured, Tab and Shift-Tab
 * both stayed inside it, and the tab characters typed were stamped as gaps.
 * Return still starts a new line: that is what the caption is for.
 *
 * Registered once per process, and held by the caption that uses it because a
 * text view does not keep its delegate alive.
 */
const NAVIGATION_CLASS = "StampImagesCaptionNavigation";
const MOVES = { "insertTab:": "selectNextKeyView", "insertBacktab:": "selectPreviousKeyView" };

function moveFocus(view, selector) {
    const move = MOVES[String(selector)];
    const { window } = view;
    if (!move || !window || window.isNil()) { return false; }
    window[move](view);
    return true;
}

function tabNavigation(objc, ns) {
    if (ns.NSClassFromString(NAVIGATION_CLASS).isNil()) {
        objc.registerSubclass({
            name: NAVIGATION_CLASS,
            superclass: "NSObject",
            protocols: ["NSTextViewDelegate"],
            methods: { "textView:doCommandBySelector:": { types: ["bool", ["id", "SEL"]], implementation: moveFocus } }
        });
    }
    return ns[NAVIGATION_CLASS].alloc.init;
}

function makeCaption(ns, text, rect, objc = null) {
    const scroll = ns.NSScrollView.alloc.initWithFrame(rectOf(ns, rect));
    const view = plainTextView(ns, text, rect);

    scroll.documentView = view;
    scroll.hasVerticalScroller = true;
    scroll.borderType = BEZEL_BORDER;
    const navigation = objc ? tabNavigation(objc, ns) : null;
    if (navigation) { view.delegate = navigation; }

    return { control: scroll, text: view, navigation };
}

module.exports = { makeField, makeCombo, makeCaption, moveFocus };
