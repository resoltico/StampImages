"use strict";

/*
 * What comes back out of the form is what the controls hold when the person
 * clicked, not what went into them.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { presentForm } = require("../../../src/runtime/appkit.js");
const { formSpec } = require("../../../src/core/form.js");
const { createFakeObjC } = require("./fake-objc.cjs");

const FONTS = ["Menlo", "Menlo Bold"];
const CONTEXT = { count: 1, fonts: FONTS };
const CREATE = 1000;

function specFor(answers, problems = []) {
    return formSpec(answers, problems, CONTEXT);
}

test("edited values come back out, not the values that went in", () => {
    const bridge = createFakeObjC({ responses: [CREATE] });
    const spec = specFor();

    // Stand in for a person changing the form before clicking Create.
    const original = bridge.ns.NSPopUpButton.alloc.initWithFramePullsDown;

    bridge.ns.NSPopUpButton.alloc.initWithFramePullsDown = (rect, pullsDown) => {
        const popup = original(rect, pullsDown);
        const select = popup.selectItemWithTitle;

        popup.selectItemWithTitle = (title) => select(
            title === "Bottom right" ? "Top left" : title
        );

        return popup;
    };

    const outcome = presentForm(bridge, spec);

    assert.equal(outcome.answers.position, "Top left");
});
