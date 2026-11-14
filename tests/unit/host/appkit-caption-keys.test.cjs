"use strict";

/*
 * Tab leaves the caption, as it leaves every other field.
 *
 * Field regression (2026-11-05, unreleased main): Tab and Shift-Tab inside the
 * caption inserted tab characters, so a person working by keyboard could not
 * reach the controls after it, and the tabs were stamped as gaps.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { makeCaption, moveFocus } = require("../../../src/host/quick-action/appkit-fields.js");
const { createFakeObjC } = require("./fake-objc.cjs");

const RECT = { left: 0, bottom: 0, width: 200, height: 60 };

test("the caption is given its keyboard navigation, registered once and kept alive", () => {
    const { ns, objc, state } = createFakeObjC();
    const first = makeCaption(ns, "", RECT, objc);
    const second = makeCaption(ns, "", RECT, objc);

    assert.equal(state.registered.length, 1);
    assert.equal(state.registered[0].methods["textView:doCommandBySelector:"].implementation, moveFocus);
    assert.equal(first.text.delegate, first.navigation, "held by the caption: a text view does not retain its delegate");
    assert.ok(second.navigation);
    assert.equal(makeCaption(ns, "", RECT).navigation, null, "without a bridge nothing is registered");
});

test("Tab and Shift-Tab move between controls; everything else is the text view's", () => {
    const moved = [];
    const window = {
        isNil: () => false,
        selectNextKeyView: (from) => moved.push(["next", from]),
        selectPreviousKeyView: (from) => moved.push(["previous", from])
    };
    const view = { window };

    assert.equal(moveFocus(view, "insertTab:"), true);
    assert.equal(moveFocus(view, "insertBacktab:"), true);
    assert.equal(moveFocus(view, "insertNewline:"), false, "Return still starts a line");
    assert.deepEqual(moved, [["next", view], ["previous", view]]);
    assert.equal(moveFocus({ window: { isNil: () => true } }, "insertTab:"), false);
    assert.equal(moveFocus({ window: null }, "insertTab:"), false);
});
