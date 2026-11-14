"use strict";
const { formSpec } = require("../../src/host/quick-action/form.js");
const { readAnswers } = require("../../src/host/quick-action/settings-model.js");
const { defaultAnswers } = require("../../src/host/quick-action/settings-model.js");
const { buildForm } = require("../../src/host/quick-action/appkit-form.js");
const { detailsAlert, layoutDetails, runDetailsModal } = require("../../src/host/quick-action/details-dialog.js");
const { allowWindows } = require("../../src/host/quick-action/panel.js");
const { WIDGETS, readControls } = require("../../src/host/quick-action/appkit.js");
const { unbindChoices } = require("../../src/host/quick-action/appkit-choice.js");

const SMALLEST_VISIBLE_HEIGHT = 744;

function assertNativeStamp(condition, message) {
    if (!condition) { throw new Error(message); }
}

function measureStampForm(built, spec) {
    for (const row of spec.rows) {
        const entry = built.controls[row.key];
        const control = row.optional ? entry.popup : entry.text ?? entry;
        assertNativeStamp(ObjC.unwrap(control.accessibilityLabel) === row.label,
            `${row.key}: missing accessible name`);
        if (row.hint) {
            assertNativeStamp(ObjC.unwrap(control.accessibilityHelp) === row.hint,
                `${row.key}: missing accessible constraint`);
        }
        if (row.kind === "choice") {
            const opening = control.titleOfSelectedItem;
            for (let index = 0; index < Number(control.numberOfItems); index += 1) {
                control.selectItemAtIndex(index);
                assertNativeStamp(control.cell.cellSize.width <= control.frame.size.width,
                    `${row.key}: clipped choice ${ObjC.unwrap(control.titleOfSelectedItem)}`);
            }
            control.selectItemWithTitle(opening);
        }
    }
    const children = built.view.subviews;
    for (let index = 0; index < Number(children.count); index += 1) {
        const child = children.objectAtIndex(index);
        if ((child.isKindOfClass($.NSTextField) && !child.editable) ||
            child.isKindOfClass($.NSButton)) {
            assertNativeStamp(child.cell.cellSize.width <= child.frame.size.width,
                `Clipped native label or control at index ${index}`);
        }
    }
}

function checkStampToggle(bridge, spec, built) {
    const { toggle, popup } = built.controls.coordinateFormat;
    const off = "Do not stamp the coordinates";
    assertNativeStamp(Number(toggle.state) === 0 && !popup.enabled, "GPS must start off");
    assertNativeStamp(ObjC.unwrap(toggle.accessibilityLabel) === "Include GPS coordinates",
        "checkbox has no accessible name");
    assertNativeStamp(ObjC.unwrap(toggle.accessibilityHelp).includes("does not remove location data"),
        "checkbox has no metadata warning");
    toggle.performClick(toggle);
    assertNativeStamp(Number(toggle.state) === 1 && popup.enabled, "On did not enable format");
    popup.selectItemAtIndex(1);
    const chosen = String(ObjC.unwrap(popup.titleOfSelectedItem));
    assertNativeStamp(readControls(bridge, spec, built.controls).coordinateFormat === chosen,
        "enabled format was not read");
    toggle.performClick(toggle);
    assertNativeStamp(!popup.enabled && readControls(bridge, spec, built.controls).coordinateFormat === off,
        "Off did not disable the format or suppress its value");
    toggle.performClick(toggle);
    assertNativeStamp(popup.enabled && String(ObjC.unwrap(popup.titleOfSelectedItem)) === chosen,
        "switching off/on forgot the format");
    toggle.performClick(toggle);
}

function checkScrollPositions(view) {
    if (view.isKindOfClass($.NSScrollView)) {
        assertNativeStamp(Number(view.documentView.visibleRect.origin.x) === 0, "Text is horizontally scrolled.");
        assertNativeStamp(Number(view.documentView.visibleRect.origin.y) === 0, "Text does not start at its first line.");
        assertNativeStamp(Number(view.verticalScroller.doubleValue) === 0, "Text scroller does not start at zero.");
    }
    const children = view.subviews;
    for (let index = 0; index < Number(children.count); index += 1) { checkScrollPositions(children.objectAtIndex(index)); }
}

function stampFormSnapshot(folder, scenario, appearance) {
    const bridge = { objc: ObjC, ns: $ };
    const spec = formSpec(scenario.answers, scenario.problems, scenario.context);
    const built = buildForm(bridge, spec, WIDGETS);
    const alert = WIDGETS.makeAlert($, spec);
    try {
        alert.accessoryView = built.view;
        alert.window.appearance = $.NSAppearance.appearanceNamed(appearance);
        alert.layout;
        measureStampForm(built, spec);
        if (scenario.name === "date-only") { checkStampToggle(bridge, spec, built); }
        const content = alert.window.contentView;
        content.layoutSubtreeIfNeeded;
        layoutDetails($, alert, [built.details, ...spec.rows.filter((row) => row.kind === "text").map((row) => built.controls[row.key].control)]);
        checkScrollPositions(built.view);
        // Against the smallest screen a supported Mac has, not the screen this
        // runs on: a CI runner's virtual display is smaller than any Mac's.
        // 1366 x 768 is the 11-inch MacBook Air of early 2015, which macOS 12
        // supports; the menu bar leaves 744 points.
        const height = Number(alert.window.frame.size.height);
        assertNativeStamp(height <= SMALLEST_VISIBLE_HEIGHT,
            `${scenario.name}: the form is ${height} points tall, more than ${SMALLEST_VISIBLE_HEIGHT}`);
        const bitmap = content.bitmapImageRepForCachingDisplayInRect(content.bounds);
        content.cacheDisplayInRectToBitmapImageRep(content.bounds, bitmap);
        const png = bitmap.representationUsingTypeProperties(4, $.NSDictionary.dictionary);
        const path = `${folder}/${scenario.name}-${appearance}.png`;
        assertNativeStamp(png.writeToFileAtomically(path, true), `Could not write ${path}`);
        console.log(`Native stamp form checked: ${path}`);
    } finally {
        unbindChoices(spec, built.controls);
        alert.window.close;
    }
}

const MODAL_SCROLL_DELAY = 0.1;
const SCROLL_TOLERANCE = 0.001;

function modalScrollFixture(form) {
    if (!form) {
        const alert = detailsAlert($, { title: "Native modal scroll check", summary: "Read full details.",
            detail: Array.from({ length: 40 }, (ignored, index) => `${index}: Generated native modal details.`).join("\n"), buttons: ["OK"] });
        return { alert, scrolls: [alert.accessoryView], close: () => undefined };
    }
    const fonts = ["Menlo"];
    const answers = { ...defaultAnswers(fonts), customText: Array.from({ length: 12 }, (ignored, index) => `Draft caption ${index}`).join("\n") };
    const spec = formSpec(answers, [], { count: 80, fonts, folders: Array.from({ length: 80 }, (ignored, index) => `/Pictures/Folder${index}/`) });
    const built = buildForm({ objc: ObjC, ns: $ }, spec, WIDGETS);
    const alert = WIDGETS.makeAlert($, spec);
    alert.accessoryView = built.view;
    alert.window.initialFirstResponder = built.controls.customText.text;
    return { alert, scrolls: [built.details, built.controls.customText.control], close: () => unbindChoices(spec, built.controls) };
}

function checkModalScroll(appearance, initialize, form = false) {
    const restore = allowWindows($);
    const { alert, scrolls, close } = modalScrollFixture(form);
    alert.window.appearance = $.NSAppearance.appearanceNamed(appearance);
    const state = { phase: 0, desired: 0, initial: null, failure: null, callback: null, busy: false };
    let timer = null;
    state.callback = ObjC.block(["void", ["id"]], () => {
        if (state.busy || state.phase === 2) { return; }
        state.busy = true;
        try {
            if (state.phase === 0) {
                state.initial = scrolls.map((scroll) => Number(scroll.verticalScroller.doubleValue));
                if (initialize) { assertNativeStamp(state.initial.every((value) => value === 0), "Shown modal details did not start at zero."); }
                else { assertNativeStamp(state.initial.every((value) => value >= 0 && value <= 1), "The pre-modal-only control did not show a real scroller."); }
                state.phase = 1;
                state.desired = scrolls.map((scroll, index) => {
                    const middle = (Number(scroll.documentView.frame.size.height) - Number(scroll.contentSize.height)) / 2;
                    scroll.contentView.scrollToPoint($.NSMakePoint(0, middle));
                    scroll.reflectScrolledClipView(scroll.contentView);
                    const value = Number(scroll.verticalScroller.doubleValue);
                    assertNativeStamp(value > 0, `Scroll ${index} did not move: value=${value}, doc=${JSON.stringify(scroll.documentView.frame)}, clipHeight=${Number(scroll.contentSize.height)}, vertical=${Boolean(scroll.documentView.verticallyResizable)}`);
                    return value;
                });
            } else {
                assertNativeStamp(scrolls.every((scroll, index) => Math.abs(Number(scroll.verticalScroller.doubleValue) - state.desired[index]) < SCROLL_TOLERANCE), "Initialization fought later user scrolling.");
                state.phase = 2;

                $.NSApplication.sharedApplication.abortModal;
            }
        } catch (error) {
            state.phase = 2;
            state.failure = { error };

            try { $.NSApplication.sharedApplication.abortModal; } catch (abortFailure) { state.failure.abortFailure = abortFailure; }
        } finally { state.busy = false; }
    });
    try {
        timer = $.NSTimer.timerWithTimeIntervalRepeatsBlock(MODAL_SCROLL_DELAY, true, state.callback);
        $.NSRunLoop.currentRunLoop.addTimerForMode(timer, $.NSModalPanelRunLoopMode);
        if (initialize) { runDetailsModal({ objc: ObjC, ns: $ }, alert, scrolls); }
        else {
            // Retired pre-modal reset is a measured control, not a requirement
            // that future AppKit versions must preserve the old defect.
            layoutDetails($, alert, scrolls);
            Number(alert.runModal);
        }
        if (state.failure) { throw state.failure.error; }
        assertNativeStamp(state.phase === 2, "The actual modal lifecycle was not exercised.");

        console.log(JSON.stringify({ modalInitialization: initialize ? "visible-update" : "pre-modal-only", appearance, form, initialScroller: state.initial, laterUserScrollRetained: true }));
    } finally {
        state.phase = 2;

        if (timer) { timer.invalidate; }

        alert.window.close;
        close();
        state.callback = null;
        restore();
    }
}


function run(input) {
    ObjC.import("AppKit");
    $.NSApplication.sharedApplication;
    const fonts = ["Menlo", "Helvetica Neue Bold"];
    const answers = defaultAnswers(fonts);
    const context = { count: 1, fonts };
    const invalid = { ...answers, size: "0", margin: "bad" };
    const scenarios = [
        { name: "date-only", answers, problems: [], context },
        { name: "coordinates", answers: { ...answers, coordinateFormat: "56.9496, 24.1052" },
            problems: [], context: { ...context, count: 12 } },
        { name: "folders", answers, problems: [], context: { ...context, count: 231, selectedFolders: 2 } },
        { name: "corrections", answers: invalid, problems: readAnswers(invalid, fonts).problems, context },
        { name: "caption-only", answers: { ...answers, dateFormat: "Do not stamp the date", customText: "A caption\nAnother line" },
            problems: [], context }
    ];
    for (const symbol of ["NSAppearanceNameAqua", "NSAppearanceNameDarkAqua"]) {
        const appearance = ObjC.unwrap($[symbol]);
        checkModalScroll(appearance, false);
        checkModalScroll(appearance, true);
        checkModalScroll(appearance, true, true);
        for (const scenario of scenarios) { stampFormSnapshot(String(input[0]), scenario, appearance); }
    }
    return "macOS native stamp form integration passed";
};
module.exports = { run };
