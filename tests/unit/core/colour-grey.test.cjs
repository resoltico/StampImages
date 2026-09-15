"use strict";

/*
 * Whether a colour is a grey, which is what decides whether a grey photograph
 * can hold it.
 *
 * A grey photograph stores one number per pixel, and moving a colour into its
 * space leaves one number: measured, #FF3B30 moved into a grey profile is the
 * single value 138, so the caption came out grey and the run said the colour
 * had been handled. White, black and the default outline are greys, so the
 * ordinary run never reaches the question.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    isGrey,
    wantsColour,
    describeExpanded
} = require("../../../src/core/colour.js");

function settings(overrides = {}) {
    return {
        textColour: "#FFFFFF",
        outlineColour: "#202020",
        outlineWidth: 2,
        ...overrides
    };
}

test("a grey is a colour whose three numbers agree", () => {
    for (const grey of ["#FFFFFF", "#000000", "#202020", "#6E6E6E"]) {
        assert.equal(isGrey(grey), true, grey);
    }

    // One number apart in any channel is not a grey, which is the whole point:
    // a photograph storing greys cannot hold it.
    for (const colour of ["#FF3B30", "#FFD400", "#FEFFFF", "#FFFEFF", "#FFFFFE"]) {
        assert.equal(isGrey(colour), false, colour);
    }
});

test("what a run asks the photograph's space to hold is both colours", () => {
    assert.equal(wantsColour(settings()), false, "the defaults are greys");
    assert.equal(wantsColour(settings({ textColour: "#FF3B30" })), true);
    assert.equal(wantsColour(settings({ outlineColour: "#FF3B30" })), true);
});

test("an outline nobody draws is not a colour anybody asked for", () => {
    // Nought pixels of outline is no outline, so its colour is not a reason
    // to read a grey photograph into colour.
    assert.equal(
        wantsColour(settings({ outlineColour: "#FF3B30", outlineWidth: 0 })),
        false
    );
    assert.equal(
        wantsColour(settings({ outlineColour: "#FF3B30", outlineWidth: 1 })),
        true
    );
});

test("how many is said once for the run, not once per photograph", () => {
    // A folder of scans would say it two hundred times.
    assert.match(describeExpanded(1), /^1 photograph stored its greys only/u);
    assert.match(describeExpanded(2), /^2 photographs stored its greys only/u);
    assert.match(describeExpanded(2), /the copy is in colour and the caption keeps/u);
});
