"use strict";

/*
 * Whether a color is a gray, which is what decides whether a gray photograph
 * can hold it.
 *
 * A gray photograph stores one number per pixel, and moving a color into its
 * space leaves one number: measured, #FF3B30 moved into a gray profile is the
 * single value 138, so the caption came out gray and the run said the color
 * had been handled. White, black and the default outline are grays, so the
 * ordinary run never reaches the question.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
    isGray,
    wantsColor,
    describeExpanded
} = require("../../../src/core/color.js");

function settings(overrides = {}) {
    return {
        textColor: "#FFFFFF",
        outlineColor: "#202020",
        outlineWidth: 2,
        ...overrides
    };
}

test("a gray is a color whose three numbers agree", () => {
    for (const gray of ["#FFFFFF", "#000000", "#202020", "#6E6E6E"]) {
        assert.equal(isGray(gray), true, gray);
    }

    // One number apart in any channel is not a gray, which is the whole point:
    // a photograph storing grays cannot hold it.
    for (const color of ["#FF3B30", "#FFD400", "#FEFFFF", "#FFFEFF", "#FFFFFE"]) {
        assert.equal(isGray(color), false, color);
    }
});

test("what a run asks the photograph's space to hold is both colors", () => {
    assert.equal(wantsColor(settings()), false, "the defaults are grays");
    assert.equal(wantsColor(settings({ textColor: "#FF3B30" })), true);
    assert.equal(wantsColor(settings({ outlineColor: "#FF3B30" })), true);
});

test("an outline nobody draws is not a color anybody asked for", () => {
    // Nought pixels of outline is no outline, so its color is not a reason
    // to read a gray photograph into color.
    assert.equal(
        wantsColor(settings({ outlineColor: "#FF3B30", outlineWidth: 0 })),
        false
    );
    assert.equal(
        wantsColor(settings({ outlineColor: "#FF3B30", outlineWidth: 1 })),
        true
    );
});

test("how many is said once for the run, not once per photograph", () => {
    // A folder of scans would say it two hundred times.
    assert.match(describeExpanded(1), /^1 image stored its grays only/u);
    assert.match(describeExpanded(2), /^2 images stored its grays only/u);
    assert.match(describeExpanded(2), /the copy is in color and the caption keeps/u);
});
