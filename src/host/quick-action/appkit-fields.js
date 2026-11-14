"use strict";
const { rectOf } = require("./appkit-bridge.js");

/*
 * Build editable native controls through an injected AppKit namespace.
 * Composition tests can inspect calls against a fake; native tests establish
 * that the controls actually render and accept input.
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
 * Use one editable combo box for preset suggestions and custom values. Its list
 * contains strings, so color presets display their canonical hex values rather
 * than a swatch that could disagree with newly typed text.
 *
 * Disable completion so replacing a preset keeps exactly the submitted text,
 * without inserting an automatic suggestion.
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
 * Use a plain text view inside a scroll view for multiline captions. Return
 * starts a new line instead of committing the alert. Read its string property;
 * ordinary fields expose stringValue, so the form distinguishes control kinds.
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
 * Intercept Tab and Shift-Tab to move keyboard focus, while Return continues
 * to insert a caption line break. NSTextView otherwise inserts tabs and requires
 * Control-Tab to leave the field.
 *
 * Register the navigation delegate once per process and retain it with the
 * caption, because a text view does not keep its delegate alive.
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
